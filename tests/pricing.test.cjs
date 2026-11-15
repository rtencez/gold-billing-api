const test=require('node:test');
const assert=require('node:assert/strict');
const {calculate,priceLine}=require('../src/pricing.cjs');
const sample={
 name:'Ring',metal:'Gold',purity:'22K',gross:'10.000',deduction:'0.400',deductionMode:'other',rate:'6000',
 stones:[{name:'Diamond',pieces:1,weight:'0.500',unit:'ct',basis:'carat',rate:'20000'}],
 makingMode:'fixed',making:'0',wastage:'0',hallmarking:'0',discount:'0'
};
test('diamond conversion and line valuation use decimal arithmetic',()=>{
 const priced=priceLine(sample);
 assert.equal(priced.net,'9.5000000');
 assert.equal(priced.stoneValue,'10000.00');
 assert.equal(priced.metalValue,'57000.00');
});
test('supplier combined deduction applies exactly once and verifies provenance',()=>{
 assert.equal(priceLine({...sample,deduction:'0.500',deductionMode:'combined'}).net,'9.5000000');
 assert.equal(priceLine({...sample,deduction:'0',deductionMode:'verified',verifiedNet:'9.500',verifiedSource:'Goods receipt'}).net,'9.5000000');
 assert.throws(()=>priceLine({...sample,deduction:'0.050',deductionMode:'combined'}),/inconsistent/);
});
test('tax rule statuses, fixed fees and compounding follow the configured order',()=>{
 const item={...sample,gross:'1',deduction:'0',rate:'10000',stones:[]};
 const calc=calculate([item],[
  {name:'Example tax',mode:'percentage',value:'12',active:true},
  {name:'Fixed fee',mode:'fixed',value:'100',active:true},
  {name:'Deactivated',mode:'fixed',value:'999',active:false},
  {name:'Compound',mode:'percentage',value:'10',active:true,compound:true}
 ]);
 assert.deepEqual(calc.taxes.map(t=>t.amount),['1200.00','100.00','1130.00']);
 assert.equal(calc.total,'12430.00');
});
module.exports={sample};
