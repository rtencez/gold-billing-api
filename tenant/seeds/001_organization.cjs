exports.seed = async (db, name = process.env.TENANT_COMPANY_NAME) => {
  const organizations = await db('organizations').select('id').limit(2);
  if (organizations.length > 1) throw new Error('Tenant database contains multiple organizations');
  if (organizations.length === 1) return organizations[0].id;
  if (!name) throw new Error('Company name is required');
  const [organization] = await db('organizations').insert({name}).returning('id');
  return organization.id;
};
