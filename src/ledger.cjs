const {z}=require('zod');
const {Decimal,fixed,sum,invalid}=require('./pricing.cjs');

const codes={
  cash:'SDJ_CASH',upi:'SDJ_UPI_CLEARING',card:'SDJ_CARD_CLEARING',bank:'SDJ_BANK',
  receivable:'SDJ_RECEIVABLE',advance:'SDJ_CUSTOMER_ADVANCE',sales:'SDJ_SALES',
  tax:'SDJ_TAX_PAYABLE',fee:'SDJ_FEE_INCOME',expense:'SDJ_OPERATING_EXPENSE',payable:'SDJ_PAYABLE'
};
const debit=(code,amount)=>({account_code:code,debit:fixed(amount),credit:'0.00'});
const credit=(code,amount)=>({account_code:code,debit:'0.00',credit:fixed(amount)});
const timeZone=process.env.SDJ_BUSINESS_TIME_ZONE || 'Asia/Kolkata';
function businessDate(at){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(at)).map(({type,value})=>[type,value]));
  return [parts.year,parts.month,parts.day].join('-');
}
async function journal(trx,ctx,source,sourceId,date,description,input){
  const lines=input.filter(line=>new Decimal(line.debit).gt(0)||new Decimal(line.credit).gt(0));
  if(!lines.length) return;
  if(!sum(lines.map(line=>line.debit)).eq(sum(lines.map(line=>line.credit)))) throw new Error('Unbalanced journal');
  const [entry]=await trx('journal_entries').insert({
    organization_id:ctx.branch.organization_id,branch_id:ctx.branch.id,business_date:date,
    description,source_type:source,source_id:sourceId
  }).returning('id');
  await trx('journal_lines').insert(lines.map(line=>({...line,entry_id:entry.id})));
}
async function postDocument(trx,ctx,doc){
  const s=doc.snapshot;
  const amount=doc.amount;
  let lines;
  if(doc.type==='advance') lines=[debit(codes[s.method],amount),credit(codes.advance,amount)];
  if(doc.type==='balance_payment') lines=[debit(codes[s.method],amount),credit(codes.receivable,amount)];
  if(doc.type==='invoice') {
    lines=[debit(codes.receivable,s.balance),debit(codes.advance,sum(s.advances.map(row=>row.amount))),credit(codes.sales,s.price.subtotal)];
    for(const rule of s.price.taxes) lines.push(credit(rule.kind==='fee'?codes.fee:codes.tax,rule.amount));
  }
  if(lines) await journal(trx,ctx,'sdj_document',doc.id,businessDate(doc.created_at),doc.number,lines);
}
async function postExpense(trx,ctx,event,voucher){
  const {type,details}=event;
  const entryDate=type==='approve'?String(voucher.expense_date).slice(0,10):businessDate(event.created_at);
  const label='EXP-'+voucher.id+' '+type;
  const lines={
    approve:[debit(codes.expense,voucher.total),credit(codes.payable,voucher.total)],
    reverse:[debit(codes.payable,voucher.total),credit(codes.expense,voucher.total)]
  };
  if(type==='pay') lines.pay=[debit(codes.payable,details.amount),credit(codes[details.method],details.amount)];
  if(type==='refund') lines.refund=[debit(codes[details.method],details.amount),credit(codes.payable,details.amount)];
  if(lines[type]) await journal(trx,ctx,'sdj_expense_event',event.id,entryDate,label,lines[type]);
}
function ledgerRoutes(router) {
  router.get('/reports/trial-balance',async(req,res)=>{
    const ctx=req.context;ctx.require('ledger.read');
    const filters=z.object({from:z.iso.date(),to:z.iso.date()}).strict().parse(req.query);
    if(filters.from>filters.to) invalid('End date must follow start date');
    const rows=await ctx.db('journal_lines as l').join('journal_entries as e','e.id','l.entry_id')
      .where('e.branch_id',ctx.branch.id).whereBetween('e.business_date',[filters.from,filters.to])
      .whereIn('e.source_type',['sdj_document','sdj_expense_event'])
      .select('l.account_code').sum({debit:'l.debit',credit:'l.credit'})
      .groupBy('l.account_code').orderBy('l.account_code');
    res.json({rows,totals:{debit:fixed(sum(rows.map(row=>row.debit))),credit:fixed(sum(rows.map(row=>row.credit)))}});
  });
}
module.exports={postDocument,postExpense,ledgerRoutes};
