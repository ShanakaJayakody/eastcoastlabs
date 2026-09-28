import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';

let db: PGlite;
const asOf = '2026-09-27T04:00:00Z';
beforeAll(async () => {
  db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema storage; create table storage.buckets(id text primary key,name text,public boolean)');
  for (const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()) await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
});
afterAll(async()=>{await db.close();});
beforeEach(async()=>{await db.exec('begin');});
afterEach(async()=>{await db.exec('rollback');});
async function insert(status:string,created:string,paid:string|null=null,shipped:string|null=null){
  return (await db.query<{id:string}>('insert into orders(customer_email,status,created_at,paid_at,shipped_at) values($1,$2,$3,$4,$5) returning id',['analytics@example.test',status,created,paid,shipped])).rows[0].id;
}
// JSON is independently checked against literal fixture results below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function report(grain='week',range='all',from:string|null=null,to:string|null=null,at=asOf):Promise<any>{return (await db.query<{result:unknown}>('select admin_fulfilment_report($1,$2,$3,$4,$5) result',[grain,range,from,to,at])).rows[0].result;}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function orders(view='shipments',offset=0,limit=50,metric:string|null=null):Promise<any>{return (await db.query<{result:unknown}>("select admin_fulfilment_orders($1,null,null,'milestone','asc',$2,$3,$4,$5) result",[view,offset,limit,asOf,metric])).rows[0].result;}

it('measures payments by payment date and shipments by shipping date, retaining later refunds',async()=>{
  await insert('shipped','2026-08-30T00:00Z','2026-08-31T00:00Z','2026-09-01T00:00Z');
  await insert('refunded','2026-09-01T00:00Z','2026-09-01T00:00Z','2026-09-03T00:00Z');
  await insert('paid','2026-08-10T00:00Z','2026-08-11T00:00Z');
  const r=await report('month','custom','2026-09-01','2026-09-30');
  expect(r.summary.payment.n).toBe(1);
  expect(r.summary.payment.median).toBe(0);
  expect(r.summary.fulfilment).toMatchObject({n:2,median:129600,mean:129600,p90:164160,max:172800});
  expect(r.summary.total.median).toBe(172800);
  expect(r.queues).toEqual({paid:1,unpaid:0});
  expect(r.summary.distribution).toEqual([1,1,0,0]);
});

it('includes empty periods as null durations and identifies first and current partial periods',async()=>{
  await insert('shipped','2026-08-10T00:00Z','2026-08-11T00:00Z','2026-08-12T00:00Z');
  const r=await report();
  expect(r.periods).toHaveLength(7);
  expect(r.periods[0].partial).toContain('history');
  expect(r.periods[1].fulfilment).toMatchObject({n:0,median:null,mean:null,p90:null});
  expect(r.periods.at(-1).partial).toContain('in_progress');
});

it('uses Sydney Monday boundaries and actual elapsed hours across daylight saving',async()=>{
  await insert('shipped','2025-10-03T14:00Z','2025-10-04T14:00Z','2025-10-05T13:00Z');
  const r=await report('week','custom','2025-10-06','2025-10-12');
  expect(r.summary.fulfilment.median).toBe(23*3600);
  expect(r.periods[0].key).toBe('2025-10-06');
  expect(r.periods[0].start_at).toBe('2025-10-05T13:00:00+00:00');
});

it('reports missing and invalid milestones without inventing zero waits or future completions',async()=>{
  await insert('shipped','2026-09-01T00:00Z',null,'2026-09-02T00:00Z');
  await insert('paid','2026-09-02T00:00Z','2026-09-01T00:00Z');
  await insert('shipped','2026-09-01T00:00Z','2026-09-03T00:00Z','2026-09-02T00:00Z');
  await insert('shipped','2026-09-01T00:00Z','2026-09-02T00:00Z','2027-01-01T00:00Z');
  const r=await report();
  expect(r.summary.fulfilment.n).toBe(0);
  expect(r.summary.shipped_count).toBe(2);
  expect(r.quality).toMatchObject({missing_payment:1,invalid_payment:1,invalid_fulfilment:1,future_timestamps:1});
  expect((await orders('quality')).total).toBe(4);
});

it('does not start the fulfilment clock for pending orders, and freezes waits at report time',async()=>{
  await insert('pending','2026-09-26T04:00Z');
  await insert('processing','2026-09-24T04:00Z','2026-09-25T04:00Z');
  const pending=(await orders('unpaid')).rows[0];
  expect(pending.payment_wait_seconds).toBe(86400);
  expect(pending.fulfilment_wait_seconds).toBeNull();
  const paid=(await orders('waiting')).rows[0];
  expect(paid.fulfilment_wait_seconds).toBe(172800);
  expect(paid.total_wait_seconds).toBe(259200);
});

it('paginates more than 1,000 records deterministically and filters metric contributors',async()=>{
  await db.exec("insert into orders(customer_email,status,created_at,paid_at,shipped_at) select 'bulk@example.test','shipped','2026-09-01'::timestamptz,'2026-09-02'::timestamptz,'2026-09-03'::timestamptz from generate_series(1,1005)");
  await insert('shipped','2026-09-01',null,'2026-09-03');
  const pages=await Promise.all([orders('shipments',0,500,'fulfilment'),orders('shipments',500,500,'fulfilment'),orders('shipments',1000,500,'fulfilment')]);
  expect(pages.map(p=>p.rows.length)).toEqual([500,500,5]);
  expect(new Set(pages.flatMap(p=>p.rows.map((r:{id:string})=>r.id))).size).toBe(1005);
  expect(pages[0].total).toBe(1005);
});

it('clips matched month-to-date comparison to the previous month and never averages weekly medians',async()=>{
  await insert('shipped','2026-07-01','2026-08-01','2026-08-02');
  await insert('shipped','2026-08-02','2026-08-02','2026-08-12');
  await insert('shipped','2026-08-03','2026-08-03','2026-08-04');
  const r=await report('month');
  expect(r.periods.find((p:{key:string})=>p.key==='2026-08-01').fulfilment.median).toBe(86400);
  expect(r.matched.previous_end).toBe('2026-08-27T04:00:00+00:00');
  expect(r.matched.provisional).toBe(true);
});

it('denies non-server roles and produces no operational side effects',async()=>{
  await insert('paid','2026-09-01','2026-09-02');
  const before=await db.query('select (select count(*) from order_events) events,(select count(*) from email_outbox) mail');
  for(const role of ['anon','authenticated']){
    await db.exec(`savepoint denied; set role ${role}`);
    await expect(report()).rejects.toThrow(/permission denied/i);
    await db.exec('rollback to savepoint denied; reset role');
  }
  await db.exec('set role service_role');
  expect((await report()).queues.paid).toBe(1);
  await orders('waiting');
  await db.exec('reset role');
  expect((await db.query('select (select count(*) from order_events) events,(select count(*) from email_outbox) mail')).rows).toEqual(before.rows);
});

it('handles a database with no orders without inventing a historical baseline',async()=>{
 const r=await report();expect(r.first_order_at).toBeNull();expect(r.periods).toEqual([]);expect(r.summary.fulfilment.median).toBeNull();expect(r.queues).toEqual({paid:0,unpaid:0});
});

it('preserves a requested range before recorded history as an empty range',async()=>{
 await insert('shipped','2026-08-10','2026-08-11','2026-08-12');
 const r=await report('month','custom','2026-07-01','2026-07-31');
 expect(r.from).toBe('2026-07-01');expect(r.to).toBe('2026-07-31');expect(r.periods).toEqual([]);expect(r.summary.shipped_count).toBe(0);
});

it('clips the matching calendar position to the end of a shorter previous month',async()=>{
 await insert('shipped','2026-01-01','2026-02-01','2026-02-02');
 const r=await report('month','all',null,null,'2026-03-31T04:00:00Z');
 expect(r.matched.previous_end).toBe('2026-02-28T13:00:00+00:00');
});

it('keeps future custom bounds valid for empty reports and order exports',async()=>{
 await insert('shipped','2026-08-10','2026-08-11','2026-08-12');
 const r=await report('month','custom','2026-10-01','2026-10-31');
 expect(r.from).toBe('2026-10-01');expect(r.to).toBe('2026-10-31');
 expect(r.periods).toEqual([]);expect(r.summary.shipped_count).toBe(0);
 const result=await db.query<{r:{total:number;rows:unknown[]}}>("select admin_fulfilment_orders('shipments',$1,$2,'milestone','desc',0,50,$3,null) r",[r.from,r.to,r.as_of]);
 expect(result.rows[0].r).toMatchObject({total:0,rows:[]});
 const spanning=await report('month','custom','2026-09-01','2026-12-31');
 expect(spanning.periods.map((p:{key:string})=>p.key)).toEqual(['2026-09-01']);
});

it('rejects invalid database filter inputs',async()=>{
  await expect(report('year')).rejects.toThrow(/grain/i);
  // Failed statement is outside an explicit SQL savepoint: PGlite marks the transaction aborted.
});
