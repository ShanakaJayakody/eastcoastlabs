import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';

let db: PGlite;
const phone = '61400000001';
const recipient = { contactId: 1, name: 'Alex', phone };
beforeAll(async () => {
  db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema storage; create table storage.buckets(id text primary key,name text,public boolean)');
  for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort())
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
});
afterAll(async () => { await db.close(); });
beforeEach(async () => { await db.exec('begin'); });
afterEach(async () => { await db.exec('rollback'); });
const rows = async () => (await db.query<Record<string, unknown>>('select * from admin_sms_outbox')).rows;
async function queue(recipients = [recipient], testId: string | null = null) {
  return (await db.query(`select enqueue_admin_sms((now() at time zone 'Australia/Melbourne')::date,$1,2,$2,$3,$4::jsonb,now()+interval '2 hours',$5::jsonb,$6::uuid) queued`,
    ['Synthetic daily business update', phone, 'a'.repeat(64), JSON.stringify(recipients), '{}', testId])).rows[0];
}
async function claim(id: string | null = null) {
  return (await db.query<Record<string, unknown>>("select * from claim_admin_sms((now() at time zone 'Australia/Melbourne')::date,$1::uuid)", [id])).rows[0];
}
async function authorize(row: Record<string, unknown>, phones = [phone], fingerprint = 'a'.repeat(64)) {
  return (await db.query<{ allowed: boolean }>('select authorize_admin_sms($1,$2,$3::text[],$4) allowed', [row.id,row.lease_token,phones,fingerprint])).rows[0].allowed;
}
async function report(row: Record<string, unknown>, part: number, status = 'delivered') {
  return db.query('select report_admin_sms($1,$2,$3,$4,$5,$6)', [row.id,'provider-message-1',phone,part,2,status]);
}

it('starts paused and creates only one daily intent for duplicate contacts or repeated runs', async () => {
  expect(await queue()).toEqual({ queued: 0 });
  await db.exec('update admin_sms_settings set enabled=true');
  expect(await queue([recipient,{ ...recipient, contactId: 2 }])).toEqual({ queued: 1 });
  expect(await queue()).toEqual({ queued: 0 });
  expect((await rows()).map(r => r.to_phone)).toEqual([phone]);
});

it('leases once and refuses removed recipients, pauses, stale tokens and changed credentials', async () => {
  await db.exec('update admin_sms_settings set enabled=true'); await queue();
  const row = await claim(); expect(row).toBeDefined(); expect(await claim()).toBeUndefined();
  expect(await authorize({ ...row, lease_token: '00000000-0000-0000-0000-000000000001' })).toBe(false);
  await db.exec('update admin_sms_settings set enabled=false');
  expect(await authorize(row)).toBe(false);
  await db.exec('update admin_sms_settings set enabled=true');
  expect(await authorize(row)).toBe(true);
  await db.exec("update admin_sms_outbox set lease_until=now()-interval '1 second'");
  const retry = await claim();
  expect(await authorize(retry,[phone],'b'.repeat(64))).toBe(false);
  expect((await rows())[0].status).toBe('uncertain');
});

it('cancels an unsent removed member and never claims expired or exhausted attempts', async () => {
  await db.exec('update admin_sms_settings set enabled=true'); await queue();
  expect(await authorize(await claim(),[])).toBe(false);
  expect((await rows())[0].status).toBe('cancelled');
  // Simulate expiry after the prior worker's lease has also ended.
  await db.exec("update admin_sms_outbox set status='queued',expires_at=now()-interval '1 second',lease_until=now()-interval '1 second'");
  expect(await claim()).toBeUndefined();
  expect((await rows())[0].status).toBe('expired');
});

it('keeps early and duplicate part reports, and marks delivered only after all parts arrive', async () => {
  await db.exec('update admin_sms_settings set enabled=true'); await queue();
  const row=await claim(); await authorize(row);
  await report(row,1);
  expect((await rows())[0].status).toBe('accepted');
  await report(row,1);
  await db.query("select finish_admin_sms($1,$2,'accepted','provider-message-1',2,null)",[row.id,row.lease_token]);
  expect((await rows())[0].status).toBe('accepted');
  await report(row,2);
  await report(row,1,'sent');
  await report(row,2,'failed');
  expect((await rows())[0].status).toBe('delivered');
  expect(await claim()).toBeUndefined();
});

it('surfaces a failed part and rejects a callback for a different phone or segment total', async () => {
  await db.exec('update admin_sms_settings set enabled=true'); await queue();
  const row=await claim(); await authorize(row); await report(row,1); await report(row,2,'failed');
  expect((await rows())[0].status).toBe('failed');
  expect((await db.query('select report_admin_sms($1,$2,$3,1,2,$4) result',[row.id,'provider-message-1','61400000002','delivered'])).rows[0]).toEqual({ result:false });
  expect((await db.query('select report_admin_sms($1,$2,$3,1,1,$4) result',[row.id,'provider-message-1',phone,'delivered'])).rows[0]).toEqual({ result:false });
});

it('separates explicitly requested tests from scheduled daily delivery while settings are paused', async () => {
  const id='00000000-0000-0000-0000-000000000123';
  expect(await queue([recipient],id)).toEqual({ queued:1 });
  expect(await queue([recipient],id)).toEqual({ queued:0 });
  expect(await claim()).toBeUndefined();
  const row=await claim(id); expect(await authorize(row)).toBe(true);
});

it('reports exact uncapped overdue counts and separates yesterday from a new Melbourne month', async () => {
  await db.exec("update orders set status='cancelled',paid_at=null");
  await db.exec(`insert into orders(customer_email,status,created_at,paid_at,total_cents)
    select 'synthetic@example.test','paid','2026-09-28T10:00:00Z','2026-09-29T10:00:00Z',1000 from generate_series(1,60);
    insert into orders(customer_email,status,created_at,paid_at,total_cents) values
    ('synthetic@example.test','paid','2026-09-30T10:00:00Z','2026-09-30T10:00:00Z',124001),
    ('synthetic@example.test','paid','2026-09-30T14:00:00Z','2026-09-30T14:00:00Z',20001),
    ('synthetic@example.test','pending','2026-09-28T10:00:00Z',null,99999);
    update orders set action_queue_entered_at=paid_at where status='paid';`);
  const result=(await db.query<{result:unknown}>("select admin_sms_order_totals('2026-09-30T22:00:00Z') result")).rows[0].result;
  expect(result).toEqual({yesterdayRevenueCents:124001,monthRevenueCents:20001,overdueFulfilment:60});
});

it('saves settings with an atomic audit and denies public and authenticated database roles', async () => {
  await db.exec("insert into admin_users(email,active) values('sms-admin@example.test',true)");
  await db.query("select save_admin_sms_settings(true,8,'sms-admin@example.test')");
  expect((await db.query("select action from admin_audit_log where action='admin_sms.settings'" )).rows).toHaveLength(1);
  for (const role of ['anon','authenticated']) {
    await db.exec(`savepoint permission_check; set role ${role}`);
    await expect(queue()).rejects.toThrow(/permission denied/);
    await db.exec('rollback to savepoint permission_check; reset role');
  }
  await db.exec('set role service_role');
  expect(await queue()).toEqual({queued:1});
  await db.exec('reset role');
});
