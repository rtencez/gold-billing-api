const path = require('node:path');
const knex = require('knex');

function open(url, database, max = 4) {
  if (!url) throw new Error('Set MASTER_DATABASE_URL and TENANT_DATABASE_URL');
  const connection = new URL(url);
  if (database) connection.pathname = '/' + database;
  return knex({client:'pg', connection:connection.toString(), pool:{min:0,max}, acquireConnectionTimeout:5000});
}
function migrate(db, scope) {
  return db.migrate.latest({
    directory:path.resolve(__dirname,'..',scope,'migrations'),
    tableName:'sdj_upgrade_migrations', loadExtensions:['.cjs']
  });
}
function databases(env = process.env) {
  const master = open(env.MASTER_DATABASE_URL);
  const tenants = new Map();
  function tenant(name) {
    if (!tenants.has(name)) {
      if (tenants.size >= Number(env.MAX_TENANT_POOLS || 20)) {
        throw Object.assign(new Error('Tenant connection capacity reached'), {status:503});
      }
      tenants.set(name, open(env.TENANT_DATABASE_URL, name, 2));
    }
    return tenants.get(name);
  }
  return {master, tenant, close:() => Promise.all([master,...tenants.values()].map(db=>db.destroy()))};
}
module.exports = {open,migrate,databases};
