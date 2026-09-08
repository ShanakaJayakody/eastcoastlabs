/** Separate-session checks against a fresh, synthetic PostgreSQL database.
 * No application environment file is read. Without ECL_TEST_PG_URL this owns a
 * temporary loopback-only Docker container and removes it on exit.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import {workflowChecks} from './postgres-workflow-checks.mjs';
import {fulfilmentChecks} from './postgres-fulfilment-checks.mjs';
import {recoveryChecks} from './postgres-recovery-checks.mjs';

let ownedContainer;
let admin;
let db;
let restored;
const clients = [];
const database = `ecl_audit_${randomUUID().replaceAll('-', '')}`;
const restoreDatabase = `${database}_restore`;
let container = process.env.ECL_TEST_PG_CONTAINER;
const docker = (args, options = {}) => execFileSync('docker', args, { encoding: 'utf8', ...options }).trim();
const scalar = async (client, sql, params = []) => (await client.query(sql, params)).rows[0].result;
const connect = async (url, name) => {
  const client = new pg.Client({ connectionString: url.toString(), application_name: name, statement_timeout: 15000 });
  await client.connect(); clients.push(client); return client;
};
let passed = 0;
async function check(name, run) {
  await run(); passed++; console.log(`PASS ${name}`);
}
try {
  let input = process.env.ECL_TEST_PG_URL;
  if (!input) {
    ownedContainer = docker(['run', '--rm', '--detach', '--publish', '127.0.0.1::5432', '--env', 'POSTGRES_PASSWORD=ecl-disposable-test-only', '--label', 'ecl.audit=disposable', 'postgres:17-alpine']);
    container = ownedContainer;
    const port = docker(['port', container, '5432/tcp']).split(':').at(-1);
    input = `postgresql://postgres:ecl-disposable-test-only@127.0.0.1:${port}/postgres`;
  }
  const url = new URL(input);
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Refusing non-loopback PostgreSQL host');
  assert.equal(url.pathname, '/postgres', 'Supply disposable cluster admin database /postgres only');
  assert(!url.search, 'Connection override parameters are not accepted');
  assert(container && /^[a-zA-Z0-9_-]+$/.test(container), 'A disposable Docker container ID is required for matching dump/restore tools');
  for (let attempt = 0; attempt < 40; attempt++) {
    try { admin = await connect(url, 'ecl-audit-admin'); break; }
    catch (error) { if (attempt === 39) throw error; await delay(250); }
  }
  await admin.query(`create database ${database} template template0`);
  await admin.query(`create database ${restoreDatabase} template template0`);
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await admin.query(`do $$ begin create role ${role}${role === 'service_role' ? ' bypassrls' : ''}; exception when duplicate_object then null; end $$`);
  }
  url.pathname = `/${database}`;
  db = await connect(url, 'ecl-audit-control');
  await db.query('create schema storage; create table storage.buckets(id text primary key,name text,public boolean)');
  const migrations = readdirSync('supabase/migrations').filter(file => file.endsWith('.sql')).sort();
  for (const file of migrations) {
    try { await db.query(readFileSync(`supabase/migrations/${file}`, 'utf8')); }
    catch (error) { throw new Error(`Migration ${file}: ${error.message}`); }
  }
  console.log(`Applied ${migrations.length} migrations to disposable PostgreSQL`);
  const a = await connect(url, 'ecl-race-a');
  const b = await connect(url, 'ecl-race-b');
  assert.notEqual(await scalar(a, 'select pg_backend_pid() result'), await scalar(b, 'select pg_backend_pid() result'));
  async function race(lockSql, lockParams, first, second) {
    await db.query('begin');
    await db.query(lockSql, lockParams);
    const results = Promise.allSettled([first(), second()]);
    try {
      let waiting = 0;
      for (let attempt = 0; attempt < 100; attempt++) {
        waiting = await scalar(admin, `select count(*)::int result from pg_stat_activity where application_name in ('ecl-race-a','ecl-race-b') and wait_event_type='Lock'`);
        if (waiting === 2) break;
        await delay(20);
      }
      assert.equal(waiting, 2, 'Both independent sessions must reach a conflicting database lock');
    } finally { await db.query('commit'); }
    return results;
  }
  async function fixture(onHand = 3) {
    const product = randomUUID(), variant = randomUUID();
    await db.query(`insert into products(id,slug,name,unit_cost_cents) values($1,$2,'Synthetic audit item',200)`, [product, `audit-${product}`]);
    await db.query(`insert into product_variants(id,product_id,sku,pack_size,label,price_cents) values($1,$2,$3,1,'1 vial',1000)`, [variant, product, `AUDIT-${variant}`]);
    await db.query(`insert into stock_movements(variant_id,qty,reason) values($1,$2,'received')`, [variant, onHand]);
    return variant;
  }
  function orderInput(variant, overrides = {}) { return { email: `${randomUUID()}@example.test`, idempotencyKey: randomUUID(), items: [{ variantId: variant, qty: 1 }], shippingCents: 500, paymentExpiryHours: 48, ...overrides }; }
  const create = (client, input) => scalar(client, 'select commerce_create_order($1::jsonb) result', [JSON.stringify(input)]);
  const operation = (client, id, action, options = {}) => scalar(client, 'select commerce_order_operation($1,$2,$3::jsonb) result', [id, action, JSON.stringify(options)]);
  let refundOrder;
  await check('concurrent checkout retry commits one order and one stock reservation', async () => {
    const variant = await fixture();
    const input = orderInput(variant);
    const results = await race('select * from inventory where variant_id=$1 for update', [variant], () => create(a, input), () => create(b, input));
    assert(results.every(r => r.status === 'fulfilled'));
    assert.equal(results[0].value.orderId, results[1].value.orderId);
    assert.equal(await scalar(db, 'select count(*)::int result from orders where checkout_key=$1', [input.idempotencyKey]), 1);
    assert.equal(await scalar(db, 'select reserved result from inventory where variant_id=$1', [variant]), 1);
  });
  await check('two customers competing for the final unit cannot oversell', async () => {
    const variant = await fixture(1);
    const results = await race('select * from inventory where variant_id=$1 for update', [variant], () => create(a, orderInput(variant)), () => create(b, orderInput(variant)));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.match(results.find(r => r.status === 'rejected').reason.message, /OUT_OF_STOCK/);
    assert.equal(await scalar(db, 'select reserved result from inventory where variant_id=$1', [variant]), 1);
  });
  await check('concurrent refund replay returns money and stock only once', async () => {
    const variant = await fixture(1);
    const order = await create(db, orderInput(variant)); refundOrder = order;
    await operation(db, order.orderId, 'paid');
    const options = { idempotencyKey: randomUUID(), restock: true };
    const results = await race('select id from orders where id=$1 for update', [order.orderId], () => operation(a, order.orderId, 'refunded', options), () => operation(b, order.orderId, 'refunded', options));
    assert(results.every(r => r.status === 'fulfilled'));
    assert.deepEqual(results[0].value, results[1].value);
    assert.equal(await scalar(db, 'select on_hand result from inventory where variant_id=$1', [variant]), 1);
    assert.equal(await scalar(db, 'select refunded_cents result from orders where id=$1', [order.orderId]), order.totalCents);
  });
  await check('payment wins safely over stale expiry', async () => {
    const variant = await fixture(1);
    const order = await create(db, orderInput(variant));
    await a.query('begin');
    await operation(a, order.orderId, 'paid');
    const expiry = operation(b, order.orderId, 'expire');
    await a.query('commit');
    await expiry;
    assert.equal(await scalar(db, 'select status result from orders where id=$1', [order.orderId]), 'paid');
    assert.deepEqual((await db.query('select on_hand,reserved from inventory where variant_id=$1', [variant])).rows[0], { on_hand: 0, reserved: 0 });
  });
  await check('concurrent outbox workers receive mutually exclusive leases', async () => {
    const id = await scalar(db, `insert into email_outbox(to_email,template,payload) values('synthetic@example.test','order_confirmation','{}') returning id result`);
    let first;
    await a.query('begin');
    try {
      first = await a.query('select * from claim_email_outbox(1,$1)', [id]);
      assert.equal(first.rows.length, 1);
      assert.equal(await scalar(a, 'select txid_current_if_assigned() is not null result'), true, 'First claim must remain inside its open transaction');
      const second = await b.query('select * from claim_email_outbox(1,$1)', [id]);
      assert.equal(second.rows.length, 0, 'Second session must skip the row locked by the first claim');
      await a.query('commit');
    } catch (error) {
      await a.query('rollback').catch(() => {});
      throw error;
    }
    const lease = first.rows[0];
    const persisted = (await db.query('select status,lease_token,lease_expires_at,attempt_count,first_attempt_at from email_outbox where id=$1', [id])).rows[0];
    assert.equal(persisted.status, 'sending');
    assert.equal(persisted.lease_token, lease.lease_token);
    assert(persisted.lease_expires_at instanceof Date);
    assert.equal(persisted.attempt_count, 1);
    assert(persisted.first_attempt_at instanceof Date);
    await db.query(`select finish_email_outbox($1,$2,'sent',null,'synthetic-provider-id')`, [id, lease.lease_token]);
    await assert.rejects(db.query(`select finish_email_outbox($1,$2,'failed','stale',null)`, [id, lease.lease_token]), /lease/i);
  });
  await check('public roles cannot execute privileged commerce or read private data', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.query(`set role ${role}`);
      await assert.rejects(db.query(`select commerce_create_order('{}')`), /permission denied/);
      await assert.rejects(db.query('select * from email_outbox'), /permission denied/);
      await assert.rejects(db.query('select order_id from reviews'), /permission denied/);
      await db.query('reset role');
    }
  });
  await check('settlement race cannot exceed recorded refund balance', async () => {
    const attempts = [a,b].map(client => ({client,reference:`TEST-${randomUUID()}`,key:randomUUID()}));
    const settle = ({client,reference,key}) => scalar(client, 'select commerce_refund_settle($1,$2,$3,current_date,$4,$5) result', [refundOrder.orderId, refundOrder.totalCents, reference, key, 'audit@example.test']);
    const results = await race('select id from orders where id=$1 for update', [refundOrder.orderId], () => settle(attempts[0]), () => settle(attempts[1]));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.filter(r => r.status === 'rejected').length, 1);
    const winnerIndex = results.findIndex(result => result.status === 'fulfilled');
    const winner = results[winnerIndex].value;
    const settlements = (await db.query('select id,order_id,amount_cents,transfer_reference,operation_key from refund_settlements where order_id=$1', [refundOrder.orderId])).rows;
    assert.equal(settlements.length, 1);
    assert.equal(settlements[0].id, winner.id);
    assert.equal(settlements[0].order_id, refundOrder.orderId);
    assert.equal(settlements[0].amount_cents, refundOrder.totalCents);
    assert.equal(settlements[0].transfer_reference, attempts[winnerIndex].reference);
    assert.equal(settlements[0].operation_key, attempts[winnerIndex].key);
    const balance = (await db.query(`select o.refunded_cents,coalesce(sum(s.amount_cents),0)::int settled_cents,
      (o.refunded_cents-coalesce(sum(s.amount_cents),0))::int remaining_cents
      from orders o left join refund_settlements s on s.order_id=o.id where o.id=$1 group by o.id`, [refundOrder.orderId])).rows[0];
    assert.deepEqual(balance, {refunded_cents:refundOrder.totalCents,settled_cents:refundOrder.totalCents,remaining_cents:0});
  });
  await workflowChecks({db,a,b,scalar,check,race,fixture,orderInput,create,operation});
  await recoveryChecks({db,a,b,scalar,check});
  await fulfilmentChecks({db,a,b,scalar,check,race,fixture,orderInput,create,operation});
  const snapshot = async client => {
    const tables = (await client.query(`select schemaname,tablename from pg_tables where schemaname in ('public','storage') order by 1,2`)).rows;
    const result = {};
    for (const { schemaname, tablename } of tables) {
      const ident = name => `"${name.replaceAll('"', '""')}"`;
      result[`${schemaname}.${tablename}`] = await scalar(client, `select md5(coalesce(string_agg(row_to_json(t)::text,E'\n' order by row_to_json(t)::text),'')) result from ${ident(schemaname)}.${ident(tablename)} t`);
    }
    return result;
  };
  await check('custom-format backup restores every public/storage table and private grants', async () => {
    const before = await snapshot(db);
    const dump = execFileSync('docker', ['exec', container, 'pg_dump', '-U', url.username, '-Fc', database], { maxBuffer: 64 * 1024 * 1024 });
    execFileSync('docker', ['exec', '-i', container, 'pg_restore', '-U', url.username, '--exit-on-error', '--single-transaction', '-d', restoreDatabase], { input: dump, maxBuffer: 64 * 1024 * 1024 });
    url.pathname = `/${restoreDatabase}`;
    restored = await connect(url, 'ecl-audit-restored');
    assert.deepEqual(await snapshot(restored), before);
    await restored.query('set role anon');
    await assert.rejects(restored.query('select * from orders'), /permission denied/);
    await assert.rejects(restored.query(`select commerce_create_order('{}')`), /permission denied/);
    await restored.query('reset role');
    console.log(`Verified ${Object.keys(before).length} table contents after restore`);
  });
  console.log(`${passed} native PostgreSQL checks passed; synthetic databases only`);
} finally {
  for (const client of clients.filter(client => client !== admin)) await client.end().catch(() => {});
  if (admin) {
    await admin.query(`drop database if exists ${restoreDatabase} with (force)`).catch(() => {});
    await admin.query(`drop database if exists ${database} with (force)`).catch(() => {});
    await admin.end();
  }
  if (ownedContainer) docker(['rm', '--force', ownedContainer]);
}
