const {createHash}=require('node:crypto');
const {z}=require('zod');
const {postExpense}=require('./ledger.cjs');
const {Decimal,id,money,label,fixed,sum,invalid}=require('./pricing.cjs');

const statuses=['draft','approved','rejected','reversed'];
const shape=fields=>z.object(fields).strict();
const payment=shape({amount:money,method:z.enum(['cash','card','upi','bank']),reference:label.optional()});
const voucher=shape({
  date:z.iso.date(),due:z.iso.date().optional(),note:z.string().trim().max(500).optional(),
  partyId:id.optional(),customerId:id.optional(),partyName:label.optional(),
  lines:z.array(shape({description:label,categoryId:id.optional(),amount:money})).min(1).max(100)
});
function notFound(){throw Object.assign(new Error('Expense voucher not found'),{status:404});}

async function mutate(ctx,type,key,pk,input){
  z.uuid().parse(key);
  const branch=ctx.branch.id;
  const body=type==='create'?voucher.parse(input):type==='pay'||type==='refund'?payment.parse(input):shape({reason:label}).parse(input);
  ctx.require(type==='create'?'expense.write':type==='pay'||type==='refund'?'expense.pay':'expense.approve');
  if(type!=='create') id.parse(pk);
  const digest=createHash('sha256').update(JSON.stringify([type,pk,body])).digest('hex');
  return ctx.db.transaction(async trx=>{
    await trx.raw('select pg_advisory_xact_lock(hashtextextended(?,0))',['expense:'+branch+':'+key]);
    const prior=await trx('sdj_expense_events').where({branch_id:branch,request_id:key}).first();
    if(prior){
      if(prior.hash!==digest || prior.actor_id!==ctx.user.id) invalid('Request ID already used');
      return {id:prior.voucher_id};
    }
    let record;
    if(type==='create'){
      if([body.customerId,body.partyId,body.partyName].filter(Boolean).length>1) invalid('Select only one party');
      if(body.due && body.due<body.date) invalid('Due date precedes expense date');
      let partyName=body.partyName;
      if(body.partyId){
        const party=await trx('sdj_parties').where({branch_id:branch,id:body.partyId,active:true}).select('name').first();
        if(!party) invalid('Party not available in this branch');
        partyName=party.name;
      }
      if(body.customerId){
        const customer=await trx('customers').where({organization_id:ctx.branch.organization_id,id:body.customerId})
          .andWhere(q=>q.whereNull('branch_id').orWhere('branch_id',branch)).select('name').first();
        if(!customer) invalid('Customer not available in this branch');
        partyName=customer.name;
      }
      const total=fixed(sum(body.lines.map(line=>line.amount)));
      [record]=await trx('sdj_expense_vouchers').insert({branch_id:branch,expense_date:body.date,due_date:body.due,
        party_id:body.partyId,customer_id:body.customerId,manual_party:body.partyName,party_name:partyName,note:body.note,status:'draft',total}).returning('id');
      const ids=[...new Set(body.lines.map(line=>line.categoryId).filter(Boolean))];
      const categories=new Map((await trx('sdj_expense_categories').where({branch_id:branch,active:true}).whereIn('id',ids)).map(row=>[row.id,row.name]));
      if(categories.size!==ids.length) invalid('Category not available in this branch');
      if(body.lines.some(line=>new Decimal(line.amount).lte(0))) invalid('Expense line amount must be positive');
      await trx('sdj_expense_lines').insert(body.lines.map(line=>({voucher_id:record.id,description:line.description,amount:line.amount,
        category_id:line.categoryId,category_name:categories.get(line.categoryId)})));
    } else {
      record=await trx('sdj_expense_vouchers').where({branch_id:branch,id:pk}).forUpdate().first();
      if(!record) notFound();
      record.expense_date=await trx('sdj_expense_vouchers').where({id:record.id}).first(trx.raw('expense_date::text as date')).then(row=>row.date);
      const expected=['approve','reject'].includes(type)?'draft':'approved';
      if(record.status!==expected) invalid('Expense is in the wrong state');
      let patch;
      if(type==='pay'||type==='refund') {
        const amount=new Decimal(body.amount);
        const refund=type==='refund';
        const available=refund?new Decimal(record.paid):new Decimal(record.total).minus(record.paid);
        if(amount.lte(0)||amount.gt(available)) invalid(refund?'Refund exceeds paid total':'Payment exceeds outstanding expense');
        const lines=await trx('sdj_expense_lines').where({voucher_id:record.id}).orderBy('id',refund?'desc':'asc');
        let remaining=amount;
        const allocations=[];
        for(const line of lines){
          const max=refund?new Decimal(line.paid):new Decimal(line.amount).minus(line.paid);
          const allocated=Decimal.min(remaining,max);
          if(!allocated.gt(0)) continue;
          const paid=new Decimal(line.paid).plus(refund?allocated.negated():allocated);
          await trx('sdj_expense_lines').where({id:line.id}).update({paid:fixed(paid)});
          allocations.push({id:line.id,amount:fixed(allocated)});
          remaining=remaining.minus(allocated);
        }
        if(!remaining.isZero()) invalid('Inconsistent expense allocations');
        body.allocations=allocations;
        patch={paid:fixed(new Decimal(record.paid).plus(refund?amount.negated():amount))};
      } else {
        if(type==='reverse' && new Decimal(record.paid).gt(0)) invalid('Refund posted payments before reversing');
        patch={status:{approve:'approved',reject:'rejected',reverse:'reversed'}[type]};
      }
      await trx('sdj_expense_vouchers').where({id:record.id}).update(patch);
    }
    const [event]=await trx('sdj_expense_events').insert({branch_id:branch,voucher_id:record.id,actor_id:ctx.user.id,request_id:key,hash:digest,type,details:body}).returning(['id','created_at','type','details']);
    if (!['create','reject'].includes(type)) await postExpense(trx,ctx,event,record);
    return {id:record.id};
  });
}

async function detail(ctx,pk){
  ctx.require('expense.read');
  const row=await ctx.db('sdj_expense_vouchers').where({branch_id:ctx.branch.id,id:id.parse(pk)}).first();
  if(!row) notFound();
  const [lines,events]=await Promise.all([
    ctx.db('sdj_expense_lines').where({voucher_id:row.id}).orderBy('id'),
    ctx.db('sdj_expense_events').where({voucher_id:row.id,branch_id:ctx.branch.id}).select('id','type','details','created_at','actor_id').orderBy('id','desc').limit(100)
  ]);
  return {row,lines,events};
}

const filters=shape({from:z.iso.date(),to:z.iso.date(),status:z.enum(statuses).optional(),payment:z.enum(['unpaid','partial','paid']).optional(),
  category:z.union([id,z.literal('uncategorized')]).optional(),party:id.optional(),before:id.optional()
}).refine(f=>f.from<=f.to,'End date must follow start date');
function filtered(db,branch,f){
  const q=db('sdj_expense_vouchers as v').join('sdj_expense_lines as l','l.voucher_id','v.id')
    .where('v.branch_id',branch).whereBetween('v.expense_date',[f.from,f.to]);
  if(f.status) q.where('v.status',f.status);
  if(f.party) q.where('v.party_id',f.party);
  if(f.category==='uncategorized') q.whereNull('l.category_id');
  else if(f.category) q.where('l.category_id',f.category);
  if(f.payment==='unpaid') q.where('v.paid',0);
  if(f.payment==='paid') q.whereRaw('v.paid = v.total');
  if(f.payment==='partial') q.where('v.paid','>',0).whereRaw('v.paid < v.total');
  return q;
}
function lines(query){
  return query.select('l.id','v.id as voucher_id','v.party_name','v.status','l.description','l.amount','l.paid')
    .select(query.client.raw("v.expense_date::text as expense_date, coalesce(l.category_name,'Uncategorized') as category"));
}
async function report(ctx,input,limit=30){
  ctx.require('expense.read');
  const f=filters.parse(input);
  return ctx.db.transaction(async trx=>{
    await trx.raw('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const query=filtered(trx,ctx.branch.id,f);
    const totals=await query.clone().where('v.status','approved').first(
      trx.raw('coalesce(sum(l.amount),0)::text as incurred, coalesce(sum(l.paid),0)::text as paid, coalesce(sum(l.amount-l.paid),0)::text as outstanding'));
    const page=lines(query.clone()).orderBy('l.id','desc').limit(limit+1);
    if(f.before) page.where('l.id','<',f.before);
    const rows=await page;
    const more=rows.length>limit;
    if(more) rows.pop();
    return {rows,totals,more,cursor:more?rows.at(-1).id:null};
  });
}

function expenseRoutes(router){
  router.get('/expense-categories',async(req,res)=>{
    const ctx=req.context;ctx.require('expense.read');
    res.json(await ctx.db('sdj_expense_categories').where({branch_id:ctx.branch.id}).orderBy('name').limit(500));
  });
  router.post('/expense-categories',async(req,res)=>{
    const ctx=req.context;ctx.require('expense.write');
    const {name}=shape({name:label}).parse(req.body);
    const [row]=await ctx.db('sdj_expense_categories').insert({name,branch_id:ctx.branch.id}).returning('*');
    res.status(201).json(row);
  });
  router.post('/expenses',async(req,res)=>{
    res.status(201).json(await mutate(req.context,'create',req.get('idempotency-key'),null,req.body));
  });
  router.get('/expenses/:id',async(req,res)=>res.json(await detail(req.context,req.params.id)));
  router.post('/expenses/:id/:action',async(req,res)=>{
    const type=z.enum(['approve','reject','pay','refund','reverse']).parse(req.params.action);
    res.status(201).json(await mutate(req.context,type,req.get('idempotency-key'),req.params.id,req.body));
  });
  router.get('/reports/expenses',async(req,res)=>res.json(await report(req.context,req.query)));
  router.get('/reports/expenses.csv',async(req,res)=>{
    const result=await report(req.context,req.query,5000);
    if(result.more) invalid('Narrow your filters to export up to 5,000 lines');
    const csvCell=value=>{
      let s=String(value??'');
      if(/^[\s]*[=+@-]/.test(s)||/^[\t\r\n]/.test(s)) s="'"+s;
      return '"'+s.replaceAll('"','""')+'"';
    };
    const columns=['voucher_id','expense_date','party_name','status','category','description','amount','paid'];
    const body=[columns.join(','),...result.rows.map(row=>columns.map(key=>csvCell(row[key])).join(','))];
    res.type('text/csv').attachment('expenses.csv').send(body.join('\r\n'));
  });
}
module.exports={expenseRoutes};
