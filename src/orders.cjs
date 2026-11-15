const {createHash,randomUUID} = require('node:crypto');
const {z} = require('zod');
const {postDocument} = require('./ledger.cjs');
const {quantity,money,label,id,lineSchema,calculate,fixed,Decimal,invalid} = require('./pricing.cjs');

const object = shape => z.object(shape).strict();
const payment = object({amount:money,method:z.enum(['cash','upi','bank','card']),reference:label.optional()});
const issue = object({
  code:label,owner:z.enum(['shop','customer']),kind:z.enum(['metal','stone']),
  fineness:quantity.optional(),weight:quantity,pieces:z.number().int().min(0).max(1000000)
});
const receipt = object({
  code:label,owner:z.enum(['shop','customer']),used:quantity,returned:quantity,lost:quantity,
  usedPieces:z.number().int().min(0).max(1000000),
  returnedPieces:z.number().int().min(0).max(1000000),
  lostPieces:z.number().int().min(0).max(1000000)
});
const schemas = {
  order:object({customerId:id,design:label,dueDate:z.iso.date(),terms:label,lines:z.array(lineSchema).min(1).max(100)}),
  quote:object({validUntil:z.iso.date()}), estimate:object({validUntil:z.iso.date()}),
  confirmation:object({}), advance:payment, balance_payment:payment,
  assignment:object({karigarId:id,agreedCost:money,costLimit:money,dueDate:z.iso.date()}),
  material_issue:object({rows:z.array(issue).min(1).max(100)}),
  karigar_receipt:object({rows:z.array(receipt).max(100),final:z.boolean(),finalCost:money.optional(),reason:label.optional(),lines:z.array(lineSchema).min(1).max(100).optional()}),
  invoice:object({}), handover:object({customerReturnsAcknowledged:z.boolean()})
};
const stages = {
  quote:['draft'],estimate:['draft'],confirmation:['draft'],advance:['confirmed','assigned','production','accepted'],
  assignment:['confirmed'],material_issue:['assigned','production'],karigar_receipt:['production'],
  invoice:['accepted'],balance_payment:['invoiced'],handover:['invoiced']
};
const grantFor = type => ['advance','balance_payment'].includes(type) ? 'payments.write' : ['assignment','material_issue','karigar_receipt'].includes(type) ? 'production.write' : type === 'invoice' ? 'billing.post' : 'orders.write';
const selectDocument = ['id','reference','number','branch_id','order_id','type','amount','snapshot','created_at'];
const mutableStates = new Set(Object.keys(stages));

async function taxes(db, branch, type) {
  return db('sdj_bill_taxes').where({branch_id:branch,active:true}).whereIn('scope',['all',type])
    .orderBy([{column:'position'},{column:'id'}]);
}
async function post(db, context, type, orderId, requestId, input) {
  if (!Object.hasOwn(schemas,type)) invalid('Unknown document type');
  const data = schemas[type].parse(input);
  z.uuid().parse(requestId);
  context.require(grantFor(type));
  const branch = context.branch.id;
  const digest = createHash('sha256').update(JSON.stringify([type,orderId,data])).digest('hex');
  return db.transaction(async trx => {
    await trx.raw('select pg_advisory_xact_lock(hashtextextended(?, 0))', [branch + ':' + requestId]);
    const prior = await trx('sdj_documents').where({branch_id:branch,request_id:requestId}).select(...selectDocument,'request_hash','actor_id').first();
    if (prior) {
      if (prior.request_hash !== digest || prior.actor_id !== context.user.id) invalid('Request ID already used');
      delete prior.request_hash;
      delete prior.actor_id;
      return prior;
    }
    let order, amount = '0.00', snapshot = data;
    const patch = {};
    if (type === 'order') {
      const customer = await trx('customers').where({id:data.customerId,organization_id:context.branch.organization_id})
        .andWhere(q => q.whereNull('branch_id').orWhere('branch_id',branch)).select('id','name').first();
      if (!customer) invalid('Customer is unavailable in this branch');
      snapshot = {...data,customerName:customer.name};
      [order] = await trx('sdj_order_workflows').insert({branch_id:branch,customer_id:customer.id,state:'draft',specification:snapshot}).returning('*');
    } else {
      id.parse(orderId);
      order = await trx('sdj_order_workflows').where({id:orderId,branch_id:branch}).forUpdate().first();
      if (!order) throw Object.assign(new Error('Order not found'),{status:404});
      if (!mutableStates.has(type) || !stages[type].includes(order.state)) invalid('Action unavailable in the current order state');
      const spec = order.specification;
      if (['quote','estimate','confirmation','invoice'].includes(type)) {
        const priceSource = type === 'invoice' ? order.job.acceptedLines : spec.lines;
        const price = calculate(priceSource,await taxes(trx,branch,type === 'confirmation' ? 'quote' : type));
        amount = price.total;
        snapshot = {...data,price,customerName:spec.customerName,design:spec.design,dueDate:spec.dueDate,terms:spec.terms};
      }
      if (type === 'confirmation') patch.state = 'confirmed';
      if (type === 'advance' || type === 'balance_payment') {
        amount = fixed(data.amount);
        if (new Decimal(amount).lte(0)) invalid('Payment must exceed zero');
        if (type === 'advance') {
          patch.advance = fixed(new Decimal(order.advance).plus(amount));
          snapshot.runningAdvance = patch.advance;
        } else {
          patch.balance = fixed(new Decimal(order.balance).minus(amount));
          if (new Decimal(patch.balance).lt(0)) invalid('Payment exceeds outstanding balance');
          snapshot.remainingBalance = patch.balance;
        }
      }
      if (type === 'assignment') {
        const party = await trx('sdj_parties').where({id:data.karigarId,branch_id:branch,active:true}).whereRaw("roles @> '[\"karigar\"]'::jsonb").first();
        if (!party) invalid('Select an active karigar in the current branch');
        if (new Decimal(data.agreedCost).gt(data.costLimit)) invalid('Agreed cost exceeds approved cost limit');
        snapshot = {...data,karigar:party.name,terms:party.terms};
        patch.job = snapshot;
        patch.state = 'assigned';
      }
      if (type === 'material_issue') {
        for (const row of data.rows) {
          const fineness = row.fineness === undefined ? null : new Decimal(row.fineness);
          if (new Decimal(row.weight).lte(0) || (row.kind === 'metal' ? !fineness || fineness.lte(0) || fineness.gt(1) || row.pieces !== 0 : fineness || row.pieces < 1)) invalid('Invalid issue weight, fineness or piece count');
          const current = await trx('sdj_material_balances').where({order_id:order.id,code:row.code,owner:row.owner}).first();
          if (!current) {
            await trx('sdj_material_balances').insert({order_id:order.id,code:row.code,owner:row.owner,kind:row.kind,fineness:row.fineness,issued:row.weight,issued_pieces:row.pieces});
          } else {
            if (current.kind !== row.kind || (fineness && !fineness.eq(current.fineness))) invalid('Material code has different kind or purity');
            await trx('sdj_material_balances').where({id:current.id}).update({issued:new Decimal(current.issued).plus(row.weight).toFixed(6),issued_pieces:current.issued_pieces+row.pieces});
          }
        }
        patch.state = 'production';
        patch.first_issue_at = order.first_issue_at || trx.fn.now();
      }
      if (type === 'karigar_receipt') {
        let variance = false;
        for (const row of data.rows) {
          const current = await trx('sdj_material_balances').where({order_id:order.id,code:row.code,owner:row.owner}).first();
          if (!current) invalid('Receipt references a material that was not issued');
          const update = {};
          for (const field of ['used','returned','lost']) {
            update[field] = new Decimal(current[field]).plus(row[field]).toFixed(6);
            update[field+'_pieces'] = current[field+'_pieces']+row[field+'Pieces'];
          }
          if (new Decimal(update.used).plus(update.returned).plus(update.lost).gt(current.issued) ||
              update.used_pieces+update.returned_pieces+update.lost_pieces>current.issued_pieces) invalid('Receipt exceeds issued quantity');
          if (new Decimal(row.lost).gt(0) || row.lostPieces) variance = true;
          await trx('sdj_material_balances').where({id:current.id}).update(update);
        }
        if (data.final) {
          if (!data.lines || data.finalCost === undefined) invalid('Final receipt requires accepted ornament lines and actual cost');
          calculate(data.lines,[]);
          const balances = await trx('sdj_material_balances').where({order_id:order.id});
          if (balances.some(row => !new Decimal(row.issued).eq(new Decimal(row.used).plus(row.returned).plus(row.lost)) ||
              row.issued_pieces!==row.used_pieces+row.returned_pieces+row.lost_pieces)) invalid('Reconcile all outstanding material before acceptance');
          if (new Decimal(data.finalCost).gt(order.job.costLimit)) variance = true;
          patch.state = 'accepted';
          patch.accepted_at = new Date();
          patch.job = {...order.job,acceptedLines:data.lines,finalCost:data.finalCost};
          snapshot.elapsedMinutes = Math.floor((patch.accepted_at - order.first_issue_at)/60000);
          snapshot.productionDueDate = order.job.dueDate;
        }
        if (variance) {
          context.require('production.variance');
          if (!data.reason) invalid('Approval reason required for loss or cost variance');
          snapshot.approvedBy = context.user.id;
        }
      }
      if (type === 'invoice') {
        if (new Decimal(order.advance).gt(amount)) invalid('Advance exceeds invoice total');
        const advances = await trx('sdj_documents').where({order_id:order.id,type:'advance'}).select('number','reference','amount');
        const customerMaterials = await trx('sdj_material_balances').where({order_id:order.id,owner:'customer'}).select('code','kind','issued','used','returned','lost','issued_pieces','used_pieces','returned_pieces','lost_pieces');
        patch.state = 'invoiced';
        patch.balance = fixed(new Decimal(amount).minus(order.advance));
        snapshot = {...snapshot,advances,customerMaterials,balance:patch.balance};
      }
      if (type === 'handover') {
        if (new Decimal(order.balance).gt(0)) invalid('Settle the balance before handover');
        const returns = await trx('sdj_material_balances').where({order_id:order.id,owner:'customer'}).where('returned','>',0).first();
        if (returns && !data.customerReturnsAcknowledged) invalid('Acknowledge returned customer materials');
        patch.state = 'handed_over';
      }
      if (Object.keys(patch).length) await trx('sdj_order_workflows').where({id:order.id}).update(patch);
    }
    const reference = randomUUID();
    const seq = (await trx.raw("select nextval(pg_get_serial_sequence('sdj_documents','id')) as id")).rows[0].id;
    const number = type.toUpperCase().replaceAll('_','-')+'-'+seq;
    const [document] = await trx('sdj_documents').insert({
      id:seq,reference,number,branch_id:branch,order_id:order.id,actor_id:context.user.id,type,request_id:requestId,
      request_hash:digest,amount,snapshot:{...snapshot,branchName:context.branch.name}
    }).returning(selectDocument);
    await postDocument(trx,context,document);
    return document;
  });
}

async function find(db, context, query) {
  context.require('orders.read');
  const table = db('sdj_documents').where({branch_id:context.branch.id});
  const key = z.string().trim().min(1).max(100).parse(query);
  const isUuid = z.uuid().safeParse(key).success;
  const document = await table.where(isUuid ? 'reference' : 'number',isUuid ? key : key.toUpperCase()).select(...selectDocument).first();
  if (!document) throw Object.assign(new Error('Document not found'),{status:404});
  return document;
}
module.exports = {post,find,taxes,schemas,selectDocument};
