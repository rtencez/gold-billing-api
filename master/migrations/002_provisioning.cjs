exports.up = db => db.schema.alterTable('tenants', t => t.text('provision_error'));
exports.down = db => db.schema.alterTable('tenants', t => t.dropColumn('provision_error'));
