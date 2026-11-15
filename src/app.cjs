const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { rateLimit } = require('express-rate-limit');
const bcrypt = require('bcrypt');
const { randomUUID, randomBytes, createHash } = require('node:crypto');
const { z, ZodError } = require('zod');
const { open, migrate } = require('./db.cjs');
const { label, id, quantity, Decimal, calculate, invalid, fixed } = require('./pricing.cjs');
const orders = require('./orders.cjs');
const pdf = require('./pdf.cjs');
const { ledgerRoutes } = require('./ledger.cjs');
const { expenseRoutes } = require('./expenses.cjs');

const grants = ['orders.read', 'orders.write', 'payments.write', 'production.write', 'production.variance', 'production.read', 'billing.post', 'tax.manage', 'parties.write', 'expense.read', 'expense.write', 'expense.approve', 'expense.pay', 'ledger.read'];
const object = shape => z.object(shape).strict();
const email = z.email().max(254).transform(v => v.toLowerCase());
const password = z.string();
const slug = z.string();
const hash = token => createHash('sha256').update(token).digest('hex');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const dummyHash = bcrypt.hashSync(randomBytes(32).toString('hex'), 12);
const taxInput = object({
  name: label, mode: z.enum(['percentage', 'fixed']), value: quantity, kind: z.enum(['tax', 'fee']),
  scope: z.enum(['all', 'quote', 'estimate', 'invoice']), position: z.number().int().min(0).max(10000), compound: z.boolean(), active: z.boolean()
}).refine(t => new Decimal(t.value).gt(0) && (t.mode === 'percentage' ? new Decimal(t.value).lte(100) : new Decimal(t.value).decimalPlaces() <= 2), 'Invalid tax value');
const partyInput = object({
  name: label, phone: label.optional(), email: email.optional(), address: z.string().max(500).optional(),
  roles: z.array(z.enum(['vendor', 'supplier', 'karigar'])).min(1).max(3),
  terms: object({ labourRate: quantity.optional(), basis: z.enum(['fixed', 'weight', 'piece']).optional(), wastage: quantity.optional(), leadDays: z.number().int().min(0).max(365).optional() }),
  active: z.boolean()
});
const payments = ['advance', 'balance_payment'];
function redact(document, context) {
  const snapshot = { ...document.snapshot };
  if (!context.has('production.read')) {
    for (const field of ['karigar', 'finalCost', 'costLimit', 'agreedCost', 'approvedBy', 'reason', 'karigarId']) delete snapshot[field];
    if (document.type === 'assignment') delete snapshot.terms;
    if (['material_issue', 'karigar_receipt'].includes(document.type)) delete snapshot.rows;
  }
  if (!context.has('payments.write')) {
    if (payments.includes(document.type)) delete snapshot.reference;
  }
  return { ...document, snapshot };
}
function appFactory(dbs, env = process.env) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet(), express.json({ limit: '256kb' }), cookieParser());
  const router = express.Router();
  app.use('/api/v1', router);
  const cookieOptions = { httpOnly: true, sameSite: 'strict', secure: env.NODE_ENV === 'production', path: '/' };
  router.use((req, res, next) => {
    const origin = req.get('origin');
    if (origin && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && origin !== env.PUBLIC_ORIGIN) return res.status(403).json({ error: 'Origin not allowed' });
    next();
  });
  router.get('/health', async (req, res) => { await dbs.master.raw('select 1'); res.json({ status: 'ok' }); });
  router.post('/auth/login', rateLimit({ windowMs: 15 * 60000, limit: 20 }), async (req, res) => {
    const data = object({ email, password: z.string().min(1).max(72).refine(v => Buffer.byteLength(v) <= 72), 
      company: slug.optional()
    
    }).parse(req.body);
    const company = data.company ? await dbs.master('tenants').where({ slug: data.company, status: 'active' }).first() : null;
    const db = company ? dbs.tenant(company.db_name) : dbs.master;
    const user = data.company && !company ? null : await db(company ? 'users' : 'platform_users').where({ email: data.email, active: true }).first();
    const valid = await bcrypt.compare(data.password, user?.password_hash || dummyHash);
    if (!user || !valid || (!company && user.kind !== 'super_admin')) fail(401, 'Invalid login');
    const token = randomBytes(32).toString('base64url');
    const session = { id: randomUUID(), user_id: user.id, token_hash: hash(token), expires_at: new Date(Date.now() + 8 * 3600000) };
    await db(company ? 'sessions' : 'platform_sessions').insert(session);
    res.cookie('sdj_session', (company ? company.slug : '-') + '.' + token, { ...cookieOptions, maxAge: 8 * 3600000 });
    res.json({ role: company ? 'company_admin' : 'super_admin', mustChangePassword: user.must_change_password });
  });
  router.use(async (req, res, next) => {
    const [companyKey, token] = String(req.cookies.sdj_session || '').split('.');
    if (!/^[A-Za-z0-9_-]{43}$/.test(token || '')) fail(401, 'Sign in required');
    const company = companyKey === '-' ? null : await dbs.master('tenants').where({ slug: companyKey, status: 'active' }).first();
    if (companyKey !== '-' && !company) fail(401, 'Sign in required');
    const db = company ? dbs.tenant(company.db_name) : dbs.master;
    const sessionTable = company ? 'sessions' : 'platform_sessions';
    const session = await db(sessionTable).where({ token_hash: hash(token) }).whereNull('revoked_at').where('expires_at', '>', db.fn.now()).first();
    if (!session) fail(401, 'Sign in required');
    const user = await db(company ? 'users' : 'platform_users').where({ id: session.user_id, active: true }).first();
    if (!user || (!company && user.kind !== 'super_admin')) fail(401, 'Sign in required');
    req.auth = { db, company, user, session, sessionTable };
    next();
  });
  router.get('/auth/me', async (req, res) => {
    const { db, company, user } = req.auth;
    const branches = company ? await db('branches as b').join('user_branch_access as a', 'a.branch_id', 'b.id').where({ 'a.user_id': user.id, 'b.active': true, 'b.organization_id': user.organization_id }).select('b.id', 'b.name', 'b.code') : [];
    const access = company ? await db('sdj_access').where({ user_id: user.id }).first() : null;
    res.json({ name: user.name, role: company ? 'company_admin' : 'super_admin', company: company?.slug, branches, grants: access?.grants || [], mustChangePassword: user.must_change_password });
  });
  router.post('/auth/logout', async (req, res) => {
    const { db, session, sessionTable } = req.auth;
    await db(sessionTable).where({ id: session.id }).update({ revoked_at: db.fn.now() });
    res.clearCookie('sdj_session', cookieOptions).sendStatus(204);
  });
  router.post('/auth/password', async (req, res) => {
    const { db, company, user, sessionTable } = req.auth;
    const data = object({ current: z.string().min(1).max(72).refine(v => Buffer.byteLength(v) <= 72), next: password }).parse(req.body);
    if (!(await bcrypt.compare(data.current, user.password_hash))) fail(403, 'Current password is incorrect');
    const newHash = await bcrypt.hash(data.next, 12);
    await db.transaction(async trx => {
      const updated = await trx(company ? 'users' : 'platform_users').where({ id: user.id, password_hash: user.password_hash }).update({ password_hash: newHash, must_change_password: false });
      if (!updated) fail(409, 'Password has already changed');
      await trx(sessionTable).where({ user_id: user.id }).whereNull('revoked_at').update({ revoked_at: trx.fn.now() });
    });
    res.clearCookie('sdj_session', cookieOptions).sendStatus(204);
  });
  router.use((req, res, next) => {
    if (req.auth.user.must_change_password) fail(403, 'Change your initial password');
    next();
  });
  router.use('/platform', (req, res, next) => {
    if (req.auth.company) fail(403, 'Super Admin required');
    next();
  });
  router.get('/platform/companies', async (req, res) => {
    res.json(await dbs.master('tenants').select('id', 'slug', 'name', 'status', 'db_name', 'provision_error').orderBy('id').limit(200));
  });
  router.post('/platform/companies', async (req, res) => {
    const data = object({ name: label, slug }).parse(req.body);
    const master = dbs.master;
    const database = 'sdj_' + data.slug;
    let tenant = await master('tenants').where({ slug: data.slug }).first();
    if (tenant && tenant.status === 'active') return res.json({ id: tenant.id, slug: tenant.slug, status: tenant.status });
    const administrative = open(env.TENANT_ADMIN_DATABASE_URL);
    try {
      // Commit the registry mapping before creating the database so retries can find it.
      await master.transaction(async trx => {
        await trx.raw('select pg_advisory_xact_lock(hashtextextended(?,0))', ['company:' + data.slug]);
        const existing = await trx('tenants').where({ slug: data.slug }).first();
        if (existing) return;
        if (await administrative('pg_database').where({ datname: database }).first()) fail(409, 'Database exists without a company registry mapping');
        await trx('tenants').insert({ slug: data.slug, name: data.name, db_name: database, status: 'provisioning', owner_user_id: req.auth.user.id });
      });
      const result = await master.transaction(async trx => {
        await trx.raw('select pg_advisory_xact_lock(hashtextextended(?,0))', ['company:' + data.slug]);
        tenant = await trx('tenants').where({ slug: data.slug }).first();
        if (tenant.status === 'active') return tenant;
        if (!['failed', 'provisioning'].includes(tenant.status)) fail(409, 'Company is not eligible for provisioning');
        try {
          if (!(await administrative('pg_database').where({ datname: tenant.db_name }).first())) {
            if (tenant.db_name !== database) throw new Error('Restore the registered tenant database before reconnecting');
            const dbOwner = decodeURIComponent(new URL(env.TENANT_DATABASE_URL).username);
            await administrative.raw('CREATE DATABASE ?? OWNER ??', [tenant.db_name, dbOwner]);
          }
          const target = dbs.tenant(tenant.db_name);
          await migrate(target, 'tenant');
          await require('../tenant/seeds/001_organization.cjs').seed(target, tenant.name);
          await trx('tenants').where({ id: tenant.id }).update({ status: 'active', provision_error: null, updated_at: trx.fn.now() });
          await trx('platform_audit').insert({ actor_id: req.auth.user.id, tenant_id: tenant.id, action: 'tenant.provisioned', metadata: { database: tenant.db_name } });
          return { ...tenant, status: 'active' };
        } catch (error) {
          console.error('Provisioning failed', error.code || error.message);
          await trx('tenants').where({ id: tenant.id }).update({ status: 'failed', provision_error: 'Database connection, schema migration or organization validation failed' });
          return { ...tenant, status: 'failed' };
        }
      });
      res.status(result.status === 'active' ? 200 : 503).json({ id: result.id, slug: result.slug, status: result.status });
    } finally { await administrative.destroy(); }
  });
  router.use('/platform/companies/:company', async (req, res, next) => {
    const company = await dbs.master('tenants').where({ slug: slug.parse(req.params.company), status: 'active' }).first();
    if (!company) fail(404, 'Active company not found');
    const db = dbs.tenant(company.db_name);
    const organizations = await db('organizations').select('id').limit(2);
    if (organizations.length !== 1) fail(409, 'Expected one organization');
    req.target = { db, org: organizations[0].id, company };
    next();
  });
  router.get('/platform/companies/:company/access', async (req, res) => {
    const { db, org } = req.target;
    const [branches, admins, assignments, permissions] = await Promise.all([
      db('branches').where({ organization_id: org }).select('id', 'name', 'code', 'active').orderBy('id').limit(500),
      db('users').where({ organization_id: org }).select('id', 'name', 'email', 'active').orderBy('id').limit(500),
      db('user_branch_access as a').join('users as u', 'u.id', 'a.user_id').where({ 'u.organization_id': org }).select('a.user_id', 'a.branch_id').limit(10000),
      db('sdj_access as a').join('users as u', 'u.id', 'a.user_id').where({ 'u.organization_id': org }).select('a.user_id', 'a.grants').limit(500)
    ]);
    res.json({ branches, admins, assignments, permissions, availableGrants: grants });
  });
  router.post('/platform/companies/:company/branches', async (req, res) => {
    const { db, org } = req.target;
    const data = object({ name: label, code: z.string().regex(/^[A-Z0-9-]{1,24}$/) }).parse(req.body);
    const [row] = await db.transaction(async trx => {
      const result = await trx('branches').insert({ ...data, organization_id: org }).returning(['id', 'name', 'code']);
      await trx('audit_logs').insert({ organization_id: org, action: 'platform.branch.created', metadata: { platformActor: req.auth.user.id, branchId: result[0].id } });
      return result;
    });
    res.status(201).json(row);
  });
  router.post('/platform/companies/:company/admins', async (req, res) => {
    const { db, org } = req.target;
    const data = object({ name: label, email, password }).parse(req.body);
    const [user] = await db('users').insert({ name: data.name, email: data.email, password_hash: await bcrypt.hash(data.password, 12), organization_id: org }).returning(['id', 'name', 'email']);
    res.status(201).json(user);
  });
  router.put('/platform/companies/:company/admins/:id/access', async (req, res) => {
    const { db, org } = req.target;
    const user_id = id.parse(req.params.id);
    const data = object({ branchIds: z.array(id).max(500), grants: z.array(z.enum(grants)).max(grants.length) }).parse(req.body);
    const ids = [...new Set(data.branchIds)];
    await db.transaction(async trx => {
      if (!(await trx('users').where({ id: user_id, organization_id: org }).forUpdate().first())) fail(404, 'Admin not found');
      if ((await trx('branches').where({ organization_id: org, active: true }).whereIn('id', ids)).length !== ids.length) invalid('Invalid branch assignment');
      await trx('user_branch_access').where({ user_id }).delete();
      if (ids.length) await trx('user_branch_access').insert(ids.map(branch_id => ({ user_id, branch_id })));
      await trx('sdj_access').insert({ user_id, grants: JSON.stringify([...new Set(data.grants)]) }).onConflict('user_id').merge();
      await trx('audit_logs').insert({ organization_id: org, action: 'platform.access.updated', metadata: { platformActor: req.auth.user.id, userId: user_id, branchIds: ids, grants: data.grants } });
    });
    res.sendStatus(204);
  });
  router.use('/branches/:branch', async (req, res, next) => {
    const { db, company, user } = req.auth;
    if (!company) fail(403, 'Company Admin required');
    const branch = await db('branches as b').join('user_branch_access as a', 'a.branch_id', 'b.id').where({
      'b.id': id.parse(req.params.branch), 'b.active': true, 'b.organization_id': user.organization_id, 'a.user_id': user.id
    }).select('b.*').first();
    if (!branch) fail(403, 'Branch access denied');
    const access = await db('sdj_access').where({ user_id: user.id }).first();
    const permissions = new Set(access?.grants || []);
    req.context = { db, user, branch, has: p => permissions.has(p), require: p => { if (!permissions.has(p)) fail(403, 'Permission required: ' + p); } };
    next();
  });
  const branch = express.Router({ mergeParams: true });
  router.use('/branches/:branch', branch);
  expenseRoutes(branch);
  ledgerRoutes(branch);
  branch.get('/customers', async (req, res) => {
    const ctx = req.context; ctx.require('orders.read');
    const q = z.string().max(100).parse(req.query.q ?? '');
    res.json(await ctx.db('customers').where('organization_id', ctx.branch.organization_id).andWhere(b => b.whereNull('branch_id').orWhere('branch_id', ctx.branch.id)).whereILike('name', '%' + q + '%').select('id', 'name', 'mobile').orderBy('id', 'desc').limit(40));
  });
  branch.post('/customers', async (req, res) => {
    const ctx = req.context; ctx.require('orders.write');
    const data = object({ name: label, mobile: label.optional(), email: email.optional() }).parse(req.body);
    const [row] = await ctx.db('customers').insert({ ...data, organization_id: ctx.branch.organization_id, branch_id: ctx.branch.id }).returning(['id', 'name', 'mobile']);
    res.status(201).json(row);
  });
  branch.get('/parties', async (req, res) => {
    const ctx = req.context; if (!ctx.has('parties.write')) ctx.require('production.write');
    const q = z.string().max(100).parse(req.query.q ?? '');
    const cursor = id.optional().parse(req.query.before);
    const list = ctx.db('sdj_parties').where('branch_id', ctx.branch.id).andWhere(b => b.whereILike('name', '%' + q + '%').orWhereILike('phone', '%' + q + '%'));
    if (cursor) list.where('id', '<', cursor);
    res.json(await list.orderBy('id', 'desc').limit(40));
  });
  for (const method of ['post', 'put']) branch[method](method === 'post' ? '/parties' : '/parties/:id', async (req, res) => {
    const ctx = req.context; ctx.require('parties.write');
    const data = partyInput.parse(req.body);
    const body = { ...data, roles: JSON.stringify([...new Set(data.roles)]) };
    const table = ctx.db('sdj_parties');
    const [row] = method === 'post'
      ? await table.insert({ ...body, branch_id: ctx.branch.id }).returning('*')
      : await table.where({ id: id.parse(req.params.id), branch_id: ctx.branch.id }).update(body).returning('*');
    if (!row) fail(404, 'Party not found');
    res.status(method === 'post' ? 201 : 200).json(row);
  });
  branch.get('/taxes', async (req, res) => {
    const ctx = req.context; ctx.require('tax.manage');
    res.json(await ctx.db('sdj_bill_taxes').where({ branch_id: ctx.branch.id }).orderBy([{ column: 'position' }, { column: 'id' }]).limit(500));
  });
  for (const method of ['post', 'put']) branch[method](method === 'post' ? '/taxes' : '/taxes/:id', async (req, res) => {
    const ctx = req.context; ctx.require('tax.manage');
    const data = taxInput.parse(req.body);
    const [row] = await ctx.db.transaction(async trx => {
      const table = trx('sdj_bill_taxes');
      const result = method === 'post'
        ? await table.insert({ ...data, branch_id: ctx.branch.id }).returning('*')
        : await table.where({ id: id.parse(req.params.id), branch_id: ctx.branch.id }).update(data).returning('*');
      if (!result.length) fail(404, 'Rule not found');
      await trx('sdj_tax_audit').insert({ rule_id: result[0].id, actor_id: ctx.user.id, snapshot: result[0] });
      return result;
    });
    res.status(method === 'post' ? 201 : 200).json(row);
  });
  branch.post('/pricing/preview', async (req, res) => {
    const ctx = req.context; ctx.require('orders.write');
    const type = z.enum(['quote', 'estimate', 'invoice']).parse(req.query.type ?? 'invoice');
    res.json(calculate(req.body.lines, await orders.taxes(ctx.db, ctx.branch.id, type)));
  });
  branch.get('/orders', async (req, res) => {
    const ctx = req.context; ctx.require('orders.read');
    const cursor = id.optional().parse(req.query.before);
    const query = ctx.db('sdj_order_workflows').where({ branch_id: ctx.branch.id }).select('id', 'state', 'advance', 'balance', 'created_at', ctx.db.raw("specification->>'design' as design"));
    if (cursor) query.where('id', '<', cursor);
    res.json(await query.orderBy('id', 'desc').limit(30));
  });
  branch.get('/orders/:id/invoice-preview', async (req, res) => {
    const ctx = req.context; ctx.require('billing.post');
    const order = await ctx.db('sdj_order_workflows').where({ id: id.parse(req.params.id), branch_id: ctx.branch.id }).first();
    if (!order) fail(404, 'Order not found');
    if (order.state !== 'accepted') invalid('Accept the ornament before previewing an invoice');
    const price = calculate(order.job.acceptedLines, await orders.taxes(ctx.db, ctx.branch.id, 'invoice'));
    res.json({ ...price, advance: order.advance, balance: fixed(new Decimal(price.total).minus(order.advance)) });
  });
  branch.get('/orders/:id', async (req, res) => {
    const ctx = req.context; ctx.require('orders.read');
    const order = await ctx.db('sdj_order_workflows').where({ id: id.parse(req.params.id), branch_id: ctx.branch.id }).first();
    if (!order) fail(404, 'Order not found');
    const timeline = await ctx.db('sdj_documents').where({ order_id: order.id, branch_id: ctx.branch.id }).select(...orders.selectDocument).orderBy('id', 'desc').limit(100);
    let material = [];
    if (ctx.has('production.read')) {
      material = (await ctx.db('sdj_material_balances').where({ order_id: order.id }).orderBy('id')).map(row => {
        const outstanding = new Decimal(row.issued).minus(row.used).minus(row.returned).minus(row.lost);
        return {
          ...row, outstanding: outstanding.toFixed(6), outstanding_pieces: row.issued_pieces - row.used_pieces - row.returned_pieces - row.lost_pieces,
          fine_issued: row.fineness ? new Decimal(row.issued).times(row.fineness).toFixed(12) : null,
          fine_outstanding: row.fineness ? outstanding.times(row.fineness).toFixed(12) : null
        };
      });
    } else delete order.job;
    res.json({ order, material, timeline: timeline.map(doc => redact(doc, ctx)) });
  });
  branch.post('/orders', async (req, res) => {
    const ctx = req.context;
    res.status(201).json(redact(await orders.post(ctx.db, ctx, 'order', null, req.get('idempotency-key'), req.body), ctx));
  });
  branch.post('/orders/:id/actions/:type', async (req, res) => {
    const ctx = req.context;
    if (req.params.type === 'order') fail(404, 'Action not found');
    res.status(201).json(redact(await orders.post(ctx.db, ctx, req.params.type, req.params.id, req.get('idempotency-key'), req.body), ctx));
  });
  branch.get('/documents', async (req, res) => {
    const ctx = req.context;
    res.json(redact(await orders.find(ctx.db, ctx, req.query.q), ctx));
  });
  branch.get('/documents/:reference/pdf', async (req, res) => {
    const ctx = req.context;
    const format = z.enum(Object.keys(pdf.layouts)).parse(req.query.format ?? 'detailed');
    const document = await orders.find(ctx.db, ctx, req.params.reference);
    res.set('X-Frame-Options', 'SAMEORIGIN');
    await pdf.print(res, redact(document, ctx), format, req.query.inline === '1');
  });
  router.use((req, res) => res.status(404).json({ error: 'Endpoint not found' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof ZodError) return res.status(422).json({ error: error.issues.map(issue => issue.path.join('.') + ' ' + issue.message).join('; ') });
    if (['23505', '23503'].includes(error.code)) return res.status(409).json({ error: 'A record already exists or a related record changed' });
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error(error.code || error.message);
    res.status(500).json({ error: 'Request failed' });
  });
  return app;
}
module.exports = { appFactory, grants };
