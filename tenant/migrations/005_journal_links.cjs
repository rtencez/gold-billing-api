exports.up = async db => {
  await db.schema.alterTable('journal_entries',t=>{
    t.bigInteger('branch_id').references('branches.id');
    t.date('business_date');
  });
  await db.raw("create unique index sdj_journal_source on journal_entries (source_type,source_id) where source_type in ('sdj_document','sdj_expense_event')");
  await db.raw("create index sdj_invoice_branch_date on sdj_documents (branch_id,created_at) include (amount) where type='invoice'");
  await db.schema.alterTable('journal_entries',t=>t.index(['branch_id','business_date','id'],'sdj_journals_branch_date'));
  await db.schema.alterTable('journal_lines',t=>t.index(['entry_id'],'sdj_journal_lines_entry'));
};
exports.down = () => { throw new Error('Restore a backup to revert linked accounting data'); };
