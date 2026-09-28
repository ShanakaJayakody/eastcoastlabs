import { PGlite } from '@electric-sql/pglite';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';

const feature = '20260928100000_legacy_pricing.sql';
const path = `supabase/migrations/${feature}`;
let db: PGlite;
const rows = async (sql: string) => (await db.query(sql)).rows;
const migration = () => readFileSync(path, 'utf8');
const capture = () => migration().split('-- BEGIN ONE-SHOT CAPTURE')[1].split('-- END ONE-SHOT CAPTURE')[0];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean);`);
  for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql') && f < feature).sort()) {
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
  }
  // Seed migrations populate a catalogue; remove it transactionally for an exact fixture.
  await db.exec(`delete from product_variants; delete from products;
    insert into products(id,slug,name,status) values
      ('10000000-0000-0000-0000-000000000001','legacy-active','Legacy active','active'),
      ('10000000-0000-0000-0000-000000000002','legacy-archived','Legacy archived','archived'),
      ('10000000-0000-0000-0000-000000000003','legacy-accessory','Legacy accessory','active');
    insert into product_variants(product_id,sku,pack_size,label,price_cents,active) values
      ('10000000-0000-0000-0000-000000000001','ACTIVE-1',1,'1 vial',5999,true),
      ('10000000-0000-0000-0000-000000000001','ACTIVE-3',3,'3-pack',16100,true),
      ('10000000-0000-0000-0000-000000000001','ACTIVE-6',6,'6-pack',30500,true),
      ('10000000-0000-0000-0000-000000000001','INACTIVE-12',12,'12-pack',59000,false),
      ('10000000-0000-0000-0000-000000000003','ACCESSORY-1',1,'100 pack',1200,true),
      ('10000000-0000-0000-0000-000000000002','ARCHIVED-1',1,'1 vial',1000,true);
    insert into orders(customer_email,status,created_at) values
      (' Original@Example.Test ','paid','2026-01-01'),
      ('original@example.test','completed','2026-02-01'),
      ('processing@example.test','processing','2026-02-01'),
      ('shipped@example.test','shipped','2026-02-01'),
      ('pending@example.test','pending','2026-02-01'),
      ('cancelled@example.test','cancelled','2026-02-01'),
      ('refunded@example.test','refunded','2026-02-01');`);
  // Allow RED to exercise the absent database behavior, rather than fail on file IO.
  if (existsSync(path)) await db.exec(migration());
});
afterAll(async () => { await db.close(); });

it('captures active variants across packs and accessories, excluding inactive catalogue entries', async () => {
  expect(await rows(`select v.sku,p.price_cents from legacy_discount_prices p join product_variants v on v.id=p.variant_id order by v.sku`)).toEqual([
    { sku: 'ACCESSORY-1', price_cents: 1200 }, { sku: 'ACTIVE-1', price_cents: 5999 },
    { sku: 'ACTIVE-3', price_cents: 16100 }, { sku: 'ACTIVE-6', price_cents: 30500 },
  ]);
});

it('freezes normalized qualifying emails with deterministic earliest-order evidence', async () => {
  expect(await rows('select email from legacy_discount_customers order by email')).toEqual([
    { email: 'original@example.test' }, { email: 'processing@example.test' }, { email: 'shipped@example.test' },
  ]);
  expect(await rows(`select o.customer_email from legacy_discount_customers c join orders o on o.id=c.source_order_id where c.email='original@example.test'`)).toEqual([{ customer_email: ' Original@Example.Test ' }]);
});

it('creates an unlimited active program and defaults historical order lines to ineligible', async () => {
  expect(await rows(`select kind,percent,value_cents,min_spend_cents,usage_limit,starts_at,expires_at,active from discounts where code='ECLLEGACY'`)).toEqual([
    { kind: 'legacy_price', percent: null, value_cents: null, min_spend_cents: 0, usage_limit: null, starts_at: null, expires_at: null, active: true },
  ]);
  expect(await rows(`insert into order_items(order_id,unit_price_cents,qty,line_total_cents) select id,100,1,100 from orders limit 1 returning legacy_discount_eligible`)).toEqual([{ legacy_discount_eligible: false }]);
});

it('replaying capture never changes prices or expands membership after status, price, or catalogue changes', async () => {
  await db.exec('begin');
  try {
    const beforePrices = await rows('select * from legacy_discount_prices order by variant_id');
    const beforeCustomers = await rows('select * from legacy_discount_customers order by email');
    const beforeCapture = await rows('select * from legacy_discount_captures');
    await db.exec(`update product_variants set price_cents=price_cents+1000,active=true;
      update products set status='active';
      update orders set status='paid' where status='pending';
      insert into orders(customer_email,status) values('later@example.test','paid');
      insert into product_variants(product_id,sku,pack_size,label,price_cents) values
        ('10000000-0000-0000-0000-000000000001','FUTURE-24',24,'24-pack',99900);`);
    await db.exec(capture());
    expect(await rows('select * from legacy_discount_prices order by variant_id')).toEqual(beforePrices);
    expect(await rows('select * from legacy_discount_customers order by email')).toEqual(beforeCustomers);
    expect(await rows('select * from legacy_discount_captures')).toEqual(beforeCapture);
  } finally { await db.exec('rollback'); }
});

it('protects captured rows and completion evidence even from owner updates or deletes', async () => {
  for (const table of ['legacy_discount_prices', 'legacy_discount_customers', 'legacy_discount_captures']) {
    await expect(db.exec(`delete from ${table}`)).rejects.toThrow(/immutable/i);
    await expect(db.exec(`update ${table} set captured_at=now()`)).rejects.toThrow(/immutable/i);
  }
});

it('denies browser roles all snapshot access and limits service_role to select/insert', async () => {
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await db.exec(`set role ${role}`);
    try {
      for (const table of ['legacy_discount_prices', 'legacy_discount_customers']) {
        if (role === 'service_role') {
          expect((await rows(`select * from ${table}`)).length).toBeGreaterThan(0);
        } else {
          await expect(db.exec(`select * from ${table}`)).rejects.toThrow(/permission denied/);
          await expect(db.exec(`insert into ${table} select * from ${table}`)).rejects.toThrow(/permission denied/);
        }
        await expect(db.exec(`delete from ${table}`)).rejects.toThrow(/permission denied/);
        await expect(db.exec(`update ${table} set captured_at=now()`)).rejects.toThrow(/permission denied/);
        await expect(db.exec(`truncate ${table}`)).rejects.toThrow(/permission denied/);
      }
      await expect(db.exec('delete from legacy_discount_captures')).rejects.toThrow(/permission denied/);
    } finally { await db.exec('reset role'); }
  }
});

it('permits explicitly reviewed additions while rejecting malformed snapshot data', async () => {
  await db.exec('begin');
  try {
    await db.exec('set local role service_role');
    await db.exec(`insert into legacy_discount_prices(discount_id,variant_id,price_cents)
      select d.id,v.id,59000 from discounts d cross join product_variants v where d.code='ECLLEGACY' and v.sku='INACTIVE-12';
      insert into legacy_discount_customers(discount_id,email,source_order_id)
      select d.id,'reviewed@example.test',o.id from discounts d cross join orders o where d.code='ECLLEGACY' limit 1;`);
    expect(await rows(`select price_cents from legacy_discount_prices where price_cents=59000`)).toEqual([{ price_cents: 59000 }]);
    expect(await rows(`select email from legacy_discount_customers where email='reviewed@example.test'`)).toEqual([{ email: 'reviewed@example.test' }]);
  } finally { await db.exec('rollback'); }
  await expect(db.exec(`insert into legacy_discount_customers(discount_id,email,source_order_id) select d.id,' Unnormalized@Example.Test ',o.id from discounts d cross join orders o where d.code='ECLLEGACY' limit 1`)).rejects.toThrow(/check constraint/);
  await expect(db.exec(`insert into legacy_discount_prices(discount_id,variant_id,price_cents) select d.id,v.id,-1 from discounts d cross join product_variants v where d.code='ECLLEGACY' and v.sku='INACTIVE-12'`)).rejects.toThrow(/check constraint/);
});

it('fails closed on an existing code, including case-insensitive collisions, without changing that promotion', async () => {
  const collisionDb = new PGlite();
  try {
    await collisionDb.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean);`);
    for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql') && f < feature).sort()) {
      await collisionDb.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
    }
    for (const code of ['ECLLEGACY', 'ecllegacy']) {
      await collisionDb.query(`insert into discounts(code,kind,percent) values($1,'percent',10)`, [code]);
      await expect(collisionDb.exec(migration())).rejects.toThrow(/Unexpected existing ECLLEGACY/);
      expect((await collisionDb.query(`select kind,percent from discounts where code=$1`, [code])).rows).toEqual([{ kind: 'percent', percent: 10 }]);
      expect((await collisionDb.query(`select to_regclass('public.legacy_discount_captures') as relation`)).rows).toEqual([{ relation: null }]);
      await collisionDb.query('delete from discounts where code=$1', [code]);
    }
  } finally { await collisionDb.close(); }
});

it('records completion even for an empty capture and never fills it from later orders or variants', async () => {
  await db.exec('begin');
  try {
    // Owner-only reset inside a rolled-back transaction models an initially empty store.
    await db.exec(`truncate legacy_discount_prices,legacy_discount_customers,legacy_discount_captures;
      delete from discounts where code='ECLLEGACY';
      update product_variants set active=false;
      update orders set status='cancelled';`);
    await db.exec(capture());
    expect(await rows('select variant_count,customer_count from legacy_discount_captures')).toEqual([{ variant_count: 0, customer_count: 0 }]);
    await db.exec(`update product_variants set active=true; update orders set status='paid';`);
    await db.exec(capture());
    expect(await rows('select * from legacy_discount_prices')).toEqual([]);
    expect(await rows('select * from legacy_discount_customers')).toEqual([]);
  } finally { await db.exec('rollback'); }
});
