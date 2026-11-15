const test=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {databases,migrate}=require('../src/db.cjs');
const {appFactory,grants}=require('../src/app.cjs');

const password='Integration-test-password-31';
const line={name:'Ring',metal:'Gold',purity:'22K',gross:'10',deduction:'0.4',deductionMode:'other',rate:'6000',stones:[{name:'Diamond',pieces:1,weight:'0.5',unit:'ct',basis:'carat',rate:'20000'}],makingMode:'fixed',making:'0',wastage:'0',hallmarking:'0',discount:'0'};
const receiptDefaults={usedPieces:0,returnedPieces:0,lostPieces:0};
test('real PostgreSQL workflow through the versioned HTTP API', {skip:!process.env.SDJ_INTEGRATION,timeout:60000},async t=>{
 const env=process.env;
 const dbs=databases(env);
 t.after(()=>dbs.close());
 await migrate(dbs.master,'master');
 env.SUPER_ADMIN_EMAIL='integration@example.test';
 env.SUPER_ADMIN_PASSWORD=password;
 await require('../master/seeds/001_admin.cjs').seed(dbs.master);
 const app=appFactory(dbs,env);
 app.use(require('express').static(require('node:path').resolve(__dirname,'../../frontend/dist')));
 const server=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port+'/api/v1';
 let cookie='';
 async function call(method,path,body,status=200,key){
  const response=await fetch(base+path,{method,headers:{cookie,'content-type':'application/json',...(key?{'idempotency-key':key}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const actual=response.status;
  if(actual!==status) assert.fail(method+' '+path+' expected '+status+' got '+actual+' '+await response.text());
  return response;
 }
 async function json(method,path,body,status,key){return (await call(method,path,body,status,key)).json();}
 async function login(body){
  const response=await call('POST','/auth/login',body);
  cookie=response.headers.get('set-cookie').split(';')[0];
 }
 await login({email:env.SUPER_ADMIN_EMAIL,password});
 const company='it_'+randomUUID().replaceAll('-','').slice(0,12);
 const companyPath='/platform/companies/'+company;
 assert.equal((await json('POST','/platform/companies',{name:'Integration Jewels',slug:company})).status,'active');
 assert.equal((await json('POST','/platform/companies',{name:'Integration Jewels',slug:company})).status,'active');
 const assigned=[];
 for(const code of ['A','B','C']) assigned.push(await json('POST',companyPath+'/branches',{name:'Branch '+code,code},201));
 const admin=await json('POST',companyPath+'/admins',{name:'Admin',email:'admin@example.test',password},201);
 const permissionsPath=companyPath+'/admins/'+admin.id+'/access';
 await call('PUT',permissionsPath,{branchIds:assigned.slice(0,2).map(b=>b.id),grants:grants.filter(g=>g!=='production.variance')},204);
 const superCookie=cookie;
 const adminLogin={company,email:admin.email,password};
 await login(adminLogin);
 await call('POST','/auth/password',{current:password,next:password+'1'},204);
 adminLogin.password+='1';
 await login(adminLogin);
 const companyCookie=cookie;
 assert.equal((await json('GET','/auth/me')).branches.length,2);
 const b='/branches/'+assigned[0].id;
 await call('GET','/branches/'+assigned[2].id+'/orders',undefined,403);
 await call('POST','/branches/'+assigned[2].id+'/customers',{name:'Denied'},403);
 await call('GET',companyPath+'/access',undefined,403);
 const customer=await json('POST',b+'/customers',{name:'Sample customer'},201);
 const karigar=await json('POST',b+'/parties',{name:'Karigar A',roles:['karigar'],terms:{labourRate:'100',basis:'fixed',leadDays:2},active:true},201);
 const percentage={name:'Example tax',mode:'percentage',kind:'tax',value:'12',scope:'all',position:1,compound:false,active:true};
 const tax=await json('POST',b+'/taxes',percentage,201);
 await json('POST',b+'/taxes',{...percentage,name:'Fee',mode:'fixed',kind:'fee',value:'100',position:2},201);
 const initial={customerId:customer.id,design:'Ring',dueDate:'2026-12-01',terms:'Rate at acceptance',lines:[line]};
 const order=await json('POST',b+'/orders',initial,201,randomUUID());
 const action=(type,body,status=201,key=randomUUID())=>json('POST',b+'/orders/'+order.order_id+'/actions/'+type,body,status,key);
 const quote=await action('quote',{validUntil:'2026-12-01'});
 const estimate=await action('estimate',{validUntil:'2026-12-01'});
 const confirmation=await action('confirmation',{});
 const key=randomUUID();
 const payment={amount:'500',method:'upi',reference:'Ref-A'};
 const [advance1,retry]=await Promise.all([action('advance',payment,201,key),action('advance',payment,201,key)]);
 assert.equal(advance1.reference,retry.reference);
 await action('advance',{...payment,amount:'501'},422,key);
 const advance2=await action('advance',{amount:'1000',method:'cash'});
 await action('assignment',{karigarId:karigar.id,agreedCost:'100',costLimit:'120',dueDate:'2026-12-01'});
 const issue=await action('material_issue',{rows:[
   {code:'Customer gold',owner:'customer',kind:'metal',fineness:'0.916',weight:'10',pieces:0},
   {code:'Shop diamonds',owner:'shop',kind:'stone',weight:'0.1',pieces:1}
 ]});
 const first=await action('karigar_receipt',{final:false,rows:[{...receiptDefaults,code:'Customer gold',owner:'customer',used:'5',returned:'0',lost:'0'}]});
 const final={final:true,finalCost:'125',reason:'Additional work approved',lines:[line],rows:[
  {...receiptDefaults,code:'Customer gold',owner:'customer',used:'4.5',returned:'0.5',lost:'0'},
  {...receiptDefaults,code:'Shop diamonds',owner:'shop',used:'0.1',returned:'0',lost:'0',usedPieces:1}
 ]};
 await action('karigar_receipt',final,403);
 cookie=superCookie;
 await call('PUT',permissionsPath,{branchIds:assigned.slice(0,2).map(b=>b.id),grants},204);
 cookie=companyCookie;
 const accepted=await action('karigar_receipt',final);
 const draft=await json('GET',b+'/orders/'+order.order_id+'/invoice-preview');
 assert.equal(draft.balance,'73640.00');
 const invoice=await action('invoice',{});
 assert.equal(invoice.amount,'75140.00');
 assert.equal(invoice.snapshot.balance,'73640.00');
 assert.equal(invoice.snapshot.advances.length,2);
 assert.equal(invoice.snapshot.customerMaterials[0].returned,'0.500000');
 await action('invoice',{},422);
 await action('balance_payment',{amount:'73640',method:'bank'});
 await action('handover',{customerReturnsAcknowledged:false},422);
 await action('handover',{customerReturnsAcknowledged:true});
 for(const doc of [order,quote,estimate,confirmation,advance1,advance2,issue,first,accepted,invoice]){
  assert.equal((await json('GET',b+'/documents?q='+doc.reference)).number,doc.number);
  assert.equal((await json('GET',b+'/documents?q='+doc.number)).reference,doc.reference);
 }
 for(const doc of [quote,estimate,invoice]){
  for(const format of ['detailed','standard','compact','thermal']){
   const file=await call('GET',b+'/documents/'+doc.reference+'/pdf?format='+format);
   assert.equal(file.headers.get('content-type'),'application/pdf');
   const pdfData=Buffer.from(await file.arrayBuffer());
   assert.equal(pdfData.subarray(0,5).toString(),'%PDF-');
   if(env.SDJ_PDF_OUTPUT){
    require('node:fs').writeFileSync(require('node:path').join(env.SDJ_PDF_OUTPUT,doc.type+'-'+format+'-'+doc.reference+'.pdf'),pdfData);
   }
  }
 }
 await json('PUT',b+'/taxes/'+tax.id,{...percentage,active:false});
 const preview=await json('POST',b+'/pricing/preview',{lines:[line]});
 assert.equal(preview.total,'67100.00');
 assert.equal((await json('GET',b+'/documents?q='+invoice.number)).amount,'75140.00');
 await call('GET','/branches/'+assigned[1].id+'/documents?q='+invoice.reference,undefined,404);
 const category=await json('POST',b+'/expense-categories',{name:'Utilities'},201);
 const expense=await json('POST',b+'/expenses',{date:'2026-11-01',partyId:karigar.id,lines:[{description:'Meter',categoryId:category.id,amount:'800'},{description:'Delivery',amount:'200'}]},201,randomUUID());
 const e=b+'/expenses/'+expense.id;
 await call('POST',e+'/approve',{reason:'Reviewed'},201,randomUUID());
 const expensePaymentKey=randomUUID();
 await call('POST',e+'/pay',{amount:'300',method:'cash'},201,expensePaymentKey);
 await call('POST',e+'/pay',{amount:'300',method:'cash'},201,expensePaymentKey);
 await call('POST',e+'/reverse',{reason:'Wrong voucher'},422,randomUUID());
 const filtered=b+'/reports/expenses?from=2026-11-01&to=2026-11-30';
 assert.deepEqual((await json('GET',filtered)).totals,{incurred:'1000.00',paid:'300.00',outstanding:'700.00'});
 assert.equal((await json('GET',filtered+'&category=uncategorized')).totals.incurred,'200.00');
 const exported=await call('GET',b+'/reports/expenses.csv?from=2026-11-01&to=2026-11-30');
 assert.match(await exported.text(),/Uncategorized/);
 await call('POST',e+'/refund',{amount:'300',method:'cash'},201,randomUUID());
 await call('POST',e+'/reverse',{reason:'Wrong voucher'},201,randomUUID());
 assert.equal((await json('GET',filtered)).totals.incurred,'0');
 const trial=await json('GET',b+'/reports/trial-balance?from=2026-01-01&to=2099-12-31');
 assert.equal(trial.totals.debit,trial.totals.credit);
 assert.equal(trial.rows.find(row=>row.account_code==='SDJ_SALES').credit,'67000.00');
 assert.equal(trial.rows.find(row=>row.account_code==='SDJ_OPERATING_EXPENSE').debit,'1000.00');
 assert.equal(trial.rows.find(row=>row.account_code==='SDJ_OPERATING_EXPENSE').credit,'1000.00');
 if(env.SDJ_BROWSER) await require('./browser.cjs').verifyBrowser(base.replace('/api/v1','/'),adminLogin,invoice);
 cookie='';
 await call('GET',b+'/documents?q='+invoice.reference,undefined,401);
 cookie=superCookie;
 await call('PUT',permissionsPath,{branchIds:[assigned[1].id],grants},204);
 cookie=companyCookie;
 await call('GET',b+'/orders',undefined,403);
});
