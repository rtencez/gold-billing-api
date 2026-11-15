const {performance}=require('node:perf_hooks');
const {cpus,totalmem}=require('node:os');
const {open,migrate}=require('../src/db.cjs');

async function run() {
  if (!process.env.SDJ_BENCH_DATABASE_URL || process.env.SDJ_BENCH_CONFIRM !== 'empty-test-database') {
    throw new Error('Set SDJ_BENCH_DATABASE_URL to an empty test database and confirm with SDJ_BENCH_CONFIRM=empty-test-database');
  }
  const db=open(process.env.SDJ_BENCH_DATABASE_URL,undefined,8);
  try {
    await migrate(db,'tenant');
    if (process.env.SDJ_BENCH_REUSE==='1') {
      for(const table of ['sdj_order_workflows','sdj_documents']) {
        const [{count}]=await db(table).count();
        if(Number(count)!==1000000) throw new Error('Unexpected fixture size in '+table);
      }
    } else {
      if (await db('organizations').first()) throw new Error('Benchmark requires an empty tenant');
      await db.raw(`
      insert into organizations(name) values ('Benchmark');
      insert into branches(organization_id,name,code)
      select 1,'Branch '||n,'B'||n from generate_series(1,3) n;
      insert into users(organization_id,name,email,password_hash)
      values (1,'Benchmark','bench@example.test','disabled');
      insert into customers(organization_id,branch_id,name)
      select 1,1+(n%3),'Customer '||n from generate_series(1,1000) n;
      insert into sdj_order_workflows(branch_id,customer_id,state,specification,advance,balance,created_at)
      select 1+(n%3),1+((n-1)%999),'invoiced',jsonb_build_object('design','Ring '||n),500,1499,
        timestamptz '2025-01-01' + interval '30 seconds' * n
      from generate_series(1,1000000) n;
      insert into sdj_documents(reference,number,branch_id,order_id,actor_id,type,request_id,request_hash,amount,snapshot,created_at)
      select md5('document-'||n)::uuid,'INVOICE-'||n,1+(n%3),n,1,'invoice',md5('request-'||n)::uuid,md5(n::text),1999,
        '{"price":{"total":"1999.00","subtotal":"1999.00","taxes":[],"items":[{"name":"Ring","gross":"10.000","net":"9.500","purity":"22K"}]},"advances":[{"amount":"500.00"}],"balance":"1499.00"}',
        timestamptz '2025-01-01' + interval '30 seconds' * n
      from generate_series(1,1000000) n;
      analyze sdj_documents;
      analyze sdj_order_workflows;
    `);
    }
    const workloads={
      orderList:n=>["select id,state,advance,balance,created_at,specification->>'design' as design from sdj_order_workflows where branch_id=? and id<? order by id desc limit 30",[1+(n%3),950000-n]],
      referenceLookup:n=>["select * from sdj_documents where branch_id=? and reference=md5(?)::uuid",[1+(n%3),'document-'+n]],
      orderTimeline:n=>["select * from sdj_documents where branch_id=? and order_id=? order by id desc limit 100",[1+(n%3),n]],
      invoiceAggregate:()=>["select sum(amount) from sdj_documents where branch_id=? and type='invoice' and created_at>=? and created_at<?",[1,'2025-03-01','2025-04-01']]
    };
    const concurrency=8;
    async function measure(makeQuery,count){
      const elapsed=[];
      const failures=[];
      await Promise.all(Array.from({length:concurrency},async(_unused,worker)=>{
        for(let i=worker;i<count;i+=concurrency){
          const [sql,bindings]=makeQuery(750000+i);
          const start=performance.now();
          try { await db.raw(sql,bindings); elapsed.push(performance.now()-start); }
          catch(error){failures.push(error.code || error.message);}
        }
      }));
      elapsed.sort((a,b)=>a-b);
      const percentile=p=>elapsed[Math.ceil(elapsed.length*p)-1]?.toFixed(2) ?? null;
      const [sql,bindings]=makeQuery(750000);
      const plan=await db.raw('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) '+sql,bindings);
      return {count,failures,p50Ms:percentile(.5),p95Ms:percentile(.95),plan:plan.rows[0]['QUERY PLAN'][0]};
    }
    const server=(await db.raw('select version()')).rows[0].version;
    const stats={server,node:process.version,cpu:cpus()[0]?.model,logicalCpus:cpus().length,memoryBytes:totalmem(),concurrency,rows:{orders:1000000,documents:1000000},queries:{}};
    for(const [name,query] of Object.entries(workloads)){
      stats.queries[name]=await measure(query,name==='invoiceAggregate'?24:480);
    }
    console.log(JSON.stringify(stats,null,2));
    if(Object.values(stats.queries).some(query=>query.failures.length)) process.exitCode=1;
  } finally { await db.destroy(); }
}
run().catch(error=>{console.error(error.message);process.exitCode=1;});
