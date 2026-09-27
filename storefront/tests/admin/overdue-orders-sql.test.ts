import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';

let db: PGlite;
let backfill: { order_number: string; correct: boolean }[];
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean);`);
  for (const file of readdirSync('supabase/migrations').filter(file => file.endsWith('.sql')).sort()) {
    if (file === '20260927090000_overdue_order_reminders.sql') {
      await db.exec(`insert into orders(id,order_number,customer_email,status,created_at,paid_at) values
        ('10000000-0000-0000-0000-000000000001','BACKFILL-PENDING','history@example.test','pending','2026-09-01',null),
        ('10000000-0000-0000-0000-000000000002','BACKFILL-PAID','history@example.test','paid','2026-09-01','2026-09-25'),
        ('10000000-0000-0000-0000-000000000003','BACKFILL-PROCESSING','history@example.test','processing','2026-09-01','2026-09-25');
        insert into order_events(order_id,type,from_status,to_status,created_at) values
        ('10000000-0000-0000-0000-000000000001','status','cancelled','pending','2026-09-25'),
        ('10000000-0000-0000-0000-000000000003','status','pending','paid','2026-09-25'),
        ('10000000-0000-0000-0000-000000000003','status','paid','processing','2026-09-26');`);
    }
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
  }
  backfill = (await db.query<{ order_number: string; correct: boolean }>("select order_number,action_queue_entered_at='2026-09-25'::timestamptz correct from orders where order_number like 'BACKFILL-%' order by order_number")).rows;
  await db.exec("update orders set status='cancelled' where order_number like 'BACKFILL-%'");
});
afterAll(async () => { await db.close(); });
beforeEach(async () => {
  await db.exec(`begin; update admin_users set active=false;
    insert into admin_users(email,name,active) values
      ('alex@example.test','Alex',true),('sam@example.test','Sam',true),('inactive@example.test','Inactive',false);`);
});
afterEach(async () => { await db.exec('rollback'); });

async function order(status = 'pending', hours = 25, paidHours: number | null = null) {
  return (await db.query<{ id: string }>(`insert into orders(customer_email,status,created_at,paid_at)
    values('customer@example.test',$1,now()-make_interval(hours=>$2),
      case when $3::int is null then null else now()-make_interval(hours=>$3) end) returning id`, [status, hours, paidHours])).rows[0].id;
}
const sweep = async (limit = 100) => (await db.query<{ outbox_id: string }>('select * from queue_overdue_order_reminders($1)', [limit])).rows;
const messages = async () => (await db.query<{ id: string; to_email: string; payload: { order_id: string; queue: string }; related_id: string }>(
  "select id,to_email,payload,related_id from email_outbox where template='admin_order_overdue' order by to_email,related_id")).rows;

it('backfills existing queues using reinstatement history and payment time, ignoring paid to processing', () => {
  expect(backfill).toEqual([
    { order_number: 'BACKFILL-PAID', correct: true },
    { order_number: 'BACKFILL-PENDING', correct: true },
    { order_number: 'BACKFILL-PROCESSING', correct: true },
  ]);
});

it('alerts every active admin only after 24 hours in awaiting payment or fulfilment', async () => {
  const pending = await order();
  const paid = await order('paid', 80, 25);
  const processing = await order('processing', 80, 26);
  await order('pending', 24); await order('pending', 23);
  await order('paid', 80, 2); await order('processing', 80, 24);
  for (const status of ['shipped', 'completed', 'cancelled', 'refunded']) await order(status, 80, 50);
  expect(await sweep()).toHaveLength(6);
  const rows = await messages();
  expect(rows.map(row => row.to_email)).toEqual(['alex@example.test','alex@example.test','alex@example.test','sam@example.test','sam@example.test','sam@example.test']);
  expect(new Set(rows.map(row => row.payload.order_id))).toEqual(new Set([pending, paid, processing]));
  expect(rows.find(row => row.payload.order_id === pending)?.payload.queue).toBe('awaiting_payment');
  expect(rows.find(row => row.payload.order_id === processing)?.payload.queue).toBe('to_fulfil');
});

it('deduplicates repeated sweeps and reminds again only after another 24 hours', async () => {
  await order('paid', 80, 50);
  expect(await sweep()).toHaveLength(2);
  expect(await sweep()).toHaveLength(0);
  await db.exec("update email_outbox set status='sent',sent_at=now()-interval '23 hours 59 minutes',created_at=now()-interval '25 hours',related_id=related_id||':previous' where template='admin_order_overdue'");
  expect(await sweep()).toHaveLength(0);
  // Simulate advancing a full day while this test transaction's now() is fixed.
  await db.exec("update email_outbox set sent_at=now()-interval '24 hours',created_at=now()-interval '24 hours',related_id=related_id||':previous' where template='admin_order_overdue'");
  expect(await sweep()).toHaveLength(2);
});

it('retries existing pending delivery instead of accumulating daily alerts during an outage', async () => {
  await order('paid', 80, 50);
  await sweep();
  for (const status of ['queued', 'failed', 'sending']) {
    await db.query("update email_outbox set status=$1,created_at=now()-interval '25 hours',related_id=related_id||':previous' where template='admin_order_overdue'", [status]);
    expect(await sweep()).toHaveLength(0);
  }
});

it('keeps internal priority alerts queued when an admin unsubscribes from customer marketing', async () => {
  await order();
  await sweep();
  await db.query('select suppress_marketing($1)', ['alex@example.test']);
  expect((await db.query("select status from email_outbox where to_email='alex@example.test' and template='admin_order_overdue'")).rows).toEqual([{ status: 'queued' }]);
});

it('does not redirect internal alerts when an admin also corrects their customer address', async () => {
  const id = await order();
  await db.query("update orders set customer_email='alex@example.test' where id=$1", [id]);
  await sweep();
  await db.query("select admin_save_customer('alex@example.test',$1,0,'sam@example.test')", [JSON.stringify({ email: 'corrected@example.test', name: 'Alex', phone: '', address: {} })]);
  expect((await messages()).map(row => row.to_email)).toEqual(['alex@example.test', 'sam@example.test']);
});

it('resets on payment or reinstatement, preserves time across paid to processing and ordinary edits', async () => {
  const id = await order();
  await sweep();
  await db.query("update orders set status='paid',paid_at=now() where id=$1", [id]);
  expect(await sweep()).toHaveLength(0);
  expect((await db.query('select action_queue_entered_at=now() fresh from orders where id=$1', [id])).rows[0]).toEqual({ fresh: true });
  await db.query("update orders set action_queue_entered_at=now()-interval '25 hours' where id=$1", [id]);
  await db.query("update orders set status='processing',notes='Packing now',updated_at=now() where id=$1", [id]);
  expect(await sweep()).toHaveLength(2);
  await db.query("update orders set status='cancelled' where id=$1", [id]);
  await db.query("update orders set status='pending',paid_at=null where id=$1", [id]);
  expect(await sweep()).toHaveLength(0);
});

it('rechecks the current queue and active recipient at delivery without requiring marketing consent', async () => {
  const id = await order('paid', 80, 25);
  await sweep();
  const rows = await messages();
  const reason = async () => (await db.query<{ reason: string | null }>('select email_delivery_ineligible(e) reason from email_outbox e where id=$1', [rows[0].id])).rows[0].reason;
  expect(await reason()).toBeNull();
  await db.exec("insert into subscribers(email,source,unsubscribed_at) values('alex@example.test','unsubscribe',now())");
  expect(await reason()).toBeNull();
  await db.query("update orders set status='processing' where id=$1", [id]);
  expect(await reason()).toBeNull();
  await db.exec("update admin_users set active=false where email='alex@example.test'");
  expect(await reason()).toMatch(/admin.*active/i);
  await db.exec("update admin_users set active=true where email='alex@example.test'");
  await db.query("update orders set status='shipped' where id=$1", [id]);
  expect(await reason()).toMatch(/no longer overdue/i);
  const claimed = (await db.query<{ lease_token: string }>('select * from claim_email_outbox(1,$1)', [rows[0].id])).rows[0];
  expect((await db.query('select authorize_email_delivery($1,$2) allowed', [rows[0].id, claimed.lease_token])).rows[0]).toEqual({ allowed: false });
  expect((await db.query('select status from email_outbox where id=$1', [rows[0].id])).rows[0]).toEqual({ status: 'cancelled' });
});

it('rejects an alert for a previous entry into the same queue', async () => {
  const id = await order();
  await sweep();
  await db.query("update orders set status='cancelled' where id=$1", [id]);
  await db.query("update orders set status='pending' where id=$1", [id]);
  await db.query("update orders set action_queue_entered_at=now()-interval '24 hours 30 minutes' where id=$1", [id]);
  const rows = await messages();
  expect((await db.query<{ reason: string }>('select email_delivery_ineligible(e) reason from email_outbox e where id=$1', [rows[0].id])).rows[0].reason).toMatch(/no longer overdue/i);
  expect(await sweep()).toHaveLength(2);
});

it('processes bounded batches without starving remaining admins or orders', async () => {
  for (let i = 0; i < 4; i++) await order();
  expect(await sweep(3)).toHaveLength(3);
  expect(await sweep(3)).toHaveLength(3);
  expect(await sweep(3)).toHaveLength(2);
  expect(await sweep(3)).toHaveLength(0);
  expect(await messages()).toHaveLength(8);
});

it('restricts enqueue and eligibility to server roles', async () => {
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`savepoint denied; set role ${role}`);
    await expect(sweep()).rejects.toThrow(/permission denied/i);
    await db.exec('rollback to savepoint denied; reset role');
  }
  await order();
  await db.exec('set role service_role');
  expect(await sweep()).toHaveLength(2);
  expect((await db.query<{ reason: string | null }>('select email_delivery_ineligible(e) reason from email_outbox e')).rows.every(row => row.reason === null)).toBe(true);
  await db.exec('reset role');
});
