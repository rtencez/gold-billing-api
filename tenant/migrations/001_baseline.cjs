const fs = require('node:fs');
const path = require('node:path');
exports.up = async db => {
  if (!(await db.schema.hasTable('organizations'))) {
    await db.raw(fs.readFileSync(path.join(__dirname, 'baseline.sql'), 'utf8'));
  }
};
exports.down = () => { throw new Error('Restore a database backup to revert the baseline'); };
