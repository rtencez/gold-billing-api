const bcrypt = require('bcrypt');
exports.seed = async db => {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!email && !password) return;
  await db('platform_users').insert({ email, name: 'Super Admin', kind: 'super_admin', password_hash: await bcrypt.hash(password, 12), must_change_password: false }).onConflict('email').ignore();
};
