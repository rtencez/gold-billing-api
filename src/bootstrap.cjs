const path = require('node:path');
const {databases,migrate} = require('./db.cjs');
(async () => {
  const dbs = databases();
  try {
    const tenant = process.env.TENANT_DB;
    if (tenant) {
      await migrate(dbs.tenant(tenant),'tenant');
      if (process.env.TENANT_COMPANY_NAME) await require('../tenant/seeds/001_organization.cjs').seed(dbs.tenant(tenant));
    } else {
      await migrate(dbs.master,'master');
      await dbs.master.seed.run({directory:path.resolve(__dirname,'../master/seeds'),loadExtensions:['.cjs']});
    }
  } finally { await dbs.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
