exports.up = db => db.schema.createTable('sdj_tax_audit',t=>{
  t.bigIncrements('id');
  t.bigInteger('rule_id').notNullable().references('sdj_bill_taxes.id');
  t.bigInteger('actor_id').notNullable().references('users.id');
  t.jsonb('snapshot').notNullable();
  t.timestamp('created_at',{useTz:true}).notNullable().defaultTo(db.fn.now());
  t.index(['rule_id','id']);
});
exports.down = () => {throw new Error('Restore a backup to revert audit changes');};
