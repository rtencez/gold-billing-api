exports.up = async db => {
  await db.schema.createTable('sdj_expense_categories',t=>{
    t.bigIncrements('id');
    t.bigInteger('branch_id').notNullable().references('branches.id');
    t.text('name').notNullable();
    t.boolean('active').notNullable().defaultTo(true);
    t.unique(['branch_id','name']);
  });
  await db.schema.createTable('sdj_expense_vouchers',t=>{
    t.bigIncrements('id');
    t.bigInteger('branch_id').notNullable().references('branches.id');
    t.bigInteger('party_id').references('sdj_parties.id');
    t.bigInteger('customer_id').references('customers.id');
    t.text('manual_party');
    t.text('party_name');
    t.date('expense_date').notNullable();
    t.date('due_date');
    t.text('note');
    t.text('status').notNullable().checkIn(['draft','approved','rejected','reversed']);
    t.decimal('total',24,2).notNullable();
    t.decimal('paid',24,2).notNullable().defaultTo(0);
    t.index(['branch_id','expense_date','id']);
  });
  await db.schema.createTable('sdj_expense_lines',t=>{
    t.bigIncrements('id');
    t.bigInteger('voucher_id').notNullable().references('sdj_expense_vouchers.id');
    t.bigInteger('category_id').references('sdj_expense_categories.id');
    t.text('category_name');
    t.text('description').notNullable();
    t.decimal('amount',24,2).notNullable().checkPositive();
    t.decimal('paid',24,2).notNullable().defaultTo(0);
    t.index(['voucher_id','id']);
  });
  await db.schema.createTable('sdj_expense_events',t=>{
    t.bigIncrements('id');
    t.bigInteger('branch_id').notNullable().references('branches.id');
    t.bigInteger('voucher_id').notNullable().references('sdj_expense_vouchers.id');
    t.bigInteger('actor_id').notNullable().references('users.id');
    t.uuid('request_id').notNullable();
    t.text('hash').notNullable();
    t.text('type').notNullable();
    t.jsonb('details').notNullable();
    t.timestamp('created_at',{useTz:true}).notNullable().defaultTo(db.fn.now());
    t.unique(['branch_id','request_id']);
    t.index(['voucher_id','id']);
  });
};
exports.down = () => { throw new Error('Restore a backup to revert expense data'); };
