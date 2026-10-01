import { PGlite } from '@electric-sql/pglite';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { afterAll, beforeAll, expect, it, describe, beforeEach, afterEach } from 'vitest';

const feature = '20260928100000_legacy_pricing.sql';
const path = `supabase/migrations/${feature}`;
let db: PGlite;
const rows = async (sql: string) => (await db.query(sql)).rows;
const migration = () => readFileSync(path, 'utf8');
const capture = () => migration().split('-- BEGIN ONE-SHOT CAPTURE')[1].split('-- END ONE-SHOT CAPTURE')[0];
const rpc = async <T = unknown>(sql: string, args: unknown[] = []): Promise<T> =>
  (await db.query<{ result: T }>(`select ${sql} as result`, args)).rows[0].result;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz); create schema storage; create table storage.buckets(id text primary key,name text,public boolean);`);
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
      create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz); create schema storage; create table storage.buckets(id text primary key,name text,public boolean);`);
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

describe('legacy commerce transactions', () => {
  let variant: string;
  let future: string;
  const policy = { baseCents: 1000, freeThresholdCents: 15000 };
  const create = (overrides: Record<string, unknown> = {}) => rpc<{orderId:string;totalCents:number}>(
    'commerce_create_order($1::jsonb)', [JSON.stringify({ email:'original@example.test',
      items:[{variantId:variant,qty:2,expectedPriceCents:7999}], discountCode:'ECLLEGACY', shippingPolicy:policy, ...overrides })]);
  const operation = (id:string, action:string, opts:Record<string,unknown> = {}) => rpc(
    'commerce_order_operation($1::uuid,$2,$3::jsonb)', [id,action,JSON.stringify({shippingPolicy:policy,...opts})]);
  const quote = (lines:unknown, email = ' ORIGINAL@example.test ', code = 'ecllegacy') => rpc(
    'commerce_legacy_discount_quote($1,$2,$3::jsonb)', [code,email,JSON.stringify(lines)]);
  const line = (changes = {}) => ({lineIndex:0,variantId:variant,qty:2,unitPriceCents:7999,legacyEligible:true,hasPriceOverride:false,...changes});
  beforeEach(async () => {
    await db.exec('begin');
    variant = await rpc<string>(`(select id from product_variants where sku='ACTIVE-1')`);
    future = (await db.query<{id:string}>(`insert into product_variants(product_id,sku,pack_size,label,price_cents)
      values('10000000-0000-0000-0000-000000000001','FUTURE-24',24,'Future',9000) returning id`)).rows[0].id;
    await db.exec(`update product_variants set price_cents=7999 where sku='ACTIVE-1';
      insert into stock_movements(variant_id,qty,reason) values('${variant}',1000,'received');
      set local role service_role;`);
  });
  afterEach(async () => { await db.exec('rollback'); });

  it('quotes only frozen normalized emails and preserves lower current prices', async () => {
    expect(await quote([line()])).toMatchObject({ok:true,code:'ECLLEGACY',discountCents:4000,allocations:[{lineIndex:0,discountCents:4000}]});
    expect(await quote([line()], 'new@example.test')).toMatchObject({ok:false,reason:'email_ineligible'});
    expect(await quote([line()], '')).toMatchObject({ok:false,reason:'email_required'});
    expect(await quote([line({unitPriceCents:5000})])).toMatchObject({ok:true,discountCents:0});
    expect(await quote([line({variantId:future})])).toMatchObject({ok:false,reason:'no_eligible_items'});
    await db.exec(`update discounts set active=false where code='ECLLEGACY'`);
    expect(await quote([line()])).toMatchObject({ok:false,reason:'invalid_code'});
  });

  it.each([
    {lines:null}, {lines:[]}, {lines:[null]}, {lines:[{lineIndex:0}]}, {lines:[{lineIndex:1}]},
  ])('rejects malformed line arrays: %j', async ({lines}) => {
    await expect(quote(lines)).rejects.toThrow(/Invalid legacy lines/);
  });

  it.each([
    {lineIndex:1}, {lineIndex:'0'}, {qty:0}, {qty:100}, {qty:1.5}, {qty:'2'},
    {unitPriceCents:-1}, {unitPriceCents:1.5}, {unitPriceCents:2147483648},
    {variantId:'invalid'}, {legacyEligible:'true'}, {hasPriceOverride:null},
  ])('validates line values before casts: %j', async changes => {
    await expect(quote([line(changes)])).rejects.toThrow(/Invalid legacy lines/);
  });
  it('rejects duplicate indexes and more than 200 lines', async () => {
    await expect(quote([line(),line()])).rejects.toThrow(/Invalid legacy lines/);
  });
  it('rejects excessive arrays', async () => {
    await expect(quote(Array.from({length:201},(_,lineIndex)=>line({lineIndex})))).rejects.toThrow(/Invalid legacy lines/);
  });
  it('uses indexes for repeated variants and excludes forged overrides, future variants and extras', async () => {
    expect(await quote([line(),line({lineIndex:1,qty:1}),line({lineIndex:2,hasPriceOverride:true})])).toMatchObject({discountCents:6000,allocations:[{lineIndex:0,discountCents:4000},{lineIndex:1,discountCents:2000},{lineIndex:2,discountCents:0}]});
    const order = await create({items:[
      {variantId:variant,qty:2,expectedPriceCents:7999},
      {variantId:variant,qty:1,expectedPriceCents:7999},
      {variantId:variant,qty:1,priceOverrideCents:7000,legacyDiscountEligible:true},
      {variantId:future,qty:1,legacyDiscountEligible:true},
    ], extraItems:[{name:'Extra',qty:1,unitPriceCents:250}]});
    expect(order.totalCents).toBe(34247);
    expect((await db.query(`select qty,unit_price_cents,legacy_discount_eligible,discount_allocated_cents from order_items where order_id=$1 order by unit_price_cents,qty`,[order.orderId])).rows).toEqual([
      {qty:1,unit_price_cents:250,legacy_discount_eligible:false,discount_allocated_cents:0},
      {qty:1,unit_price_cents:7000,legacy_discount_eligible:false,discount_allocated_cents:0},
      {qty:1,unit_price_cents:7999,legacy_discount_eligible:true,discount_allocated_cents:2000},
      {qty:2,unit_price_cents:7999,legacy_discount_eligible:true,discount_allocated_cents:4000},
      {qty:1,unit_price_cents:9000,legacy_discount_eligible:true,discount_allocated_cents:0},
    ]);
  });
  it('rejects ineligible creation atomically', async () => {
    const before = await rpc('(select count(*)::int from orders)');
    await db.exec('savepoint denied_order');
    await expect(create({email:'new@example.test'})).rejects.toThrow(/Discount unavailable/);
    await db.exec('rollback to savepoint denied_order');
    expect(await rpc('(select count(*)::int from orders)')).toBe(before);
    expect(await rpc('(select reserved from inventory where variant_id=$1)',[variant])).toBe(0);
  });
  it('rejects missing creation email', async () => {
    await expect(create({email:''})).rejects.toThrow(/Email required/);
  });
  it.each(['future','override','extra'])('rejects creation containing only %s lines',async kind=>{
    const items = kind==='extra' ? [] : [{variantId:kind==='future'?future:variant,qty:1,...(kind==='override'?{priceOverrideCents:7999,legacyDiscountEligible:true}:{})}];
    await expect(create({items,extraItems:kind==='extra'?[{name:'Extra',qty:1,unitPriceCents:250}]:[]})).rejects.toThrow(/Discount unavailable/);
  });
  it('keeps a below-snapshot catalogue price with a valid zero discount',async()=>{
    await db.exec(`update product_variants set price_cents=5000 where sku='ACTIVE-1'`);
    const order = await create({items:[{variantId:variant,qty:2,expectedPriceCents:5000}],expectedTotalCents:11000});
    expect(await rpc('(select discount_cents from orders where id=$1)',[order.orderId])).toBe(0);
    expect(await rpc('(select discount_code from orders where id=$1)',[order.orderId])).toBe('ECLLEGACY');
  });
  it('removes a pending code when the stored email is no longer eligible',async()=>{
    const order = await create();
    const itemId=await rpc('(select id from order_items where order_id=$1)',[order.orderId]);
    await db.query('update orders set customer_email=$1 where id=$2',['new@example.test',order.orderId]);
    await operation(order.orderId,'edit_item',{itemId,qty:1});
    expect(await rpc('(select discount_code from orders where id=$1)',[order.orderId])).toBe(null);
    expect(await rpc(`(select payload->>'legacyDiscountRemovalReason' from commerce_events where order_id=$1 and payload ? 'legacyDiscountRemoved')`,[order.orderId])).toBe('email_ineligible');
  });
  it('preserves and scrubs attribution through the existing outer wrapper and replays',async()=>{
    const orderAttribution={acquisition:{source:'newsletter',medium:'email',campaign:'retired',landingPath:'/shop'},experiments:[]};
    const input={orderAttribution,idempotencyKey:'44444444-4444-4444-4444-444444444444'};
    const order=await create(input);
    expect(await rpc('(select attribution from orders where id=$1)',[order.orderId])).toEqual({acquisition:{source:'newsletter',medium:'email',landingPath:'/shop'},experiments:[]});
    expect(await create(input)).toMatchObject({orderId:order.orderId,totalCents:12998,replayed:true});
  });
  it('rejects a changed catalogue quote', async () => {
    await db.exec(`update product_variants set price_cents=8000 where sku='ACTIVE-1'`);
    await expect(create()).rejects.toThrow(/QUOTE_CHANGED/);
  });
  it('validates expected total after legacy calculation', async () => {
    expect(await create({expectedTotalCents:12998})).toMatchObject({totalCents:12998});
    await expect(create({expectedTotalCents:15998})).rejects.toThrow(/QUOTE_CHANGED/);
  });
  it('recalculates pending quantities and strips an inactive code with audit evidence and shipping', async () => {
    const order = await create();
    const itemId = await rpc('(select id from order_items where order_id=$1)',[order.orderId]);
    await operation(order.orderId,'edit_item',{itemId,qty:3});
    expect(await rpc('(select discount_cents from orders where id=$1)',[order.orderId])).toBe(6000);
    await db.exec(`update discounts set active=false where code='ECLLEGACY'`);
    await operation(order.orderId,'edit_item',{itemId,qty:1});
    expect((await db.query('select discount_code,discount_cents,shipping_cents,total_cents from orders where id=$1',[order.orderId])).rows[0]).toEqual({discount_code:null,discount_cents:0,shipping_cents:1000,total_cents:8999});
    expect(await rpc('(select discount_allocated_cents from order_items where id=$1)',[itemId])).toBe(0);
    expect(await rpc(`(select count(*)::int from commerce_events where order_id=$1 and payload->>'legacyDiscountRemoved'='true')`,[order.orderId])).toBe(1);
    expect(await rpc(`(select count(*)::int from admin_audit_log where entity_id=$1 and diff->'result'->>'legacyDiscountRemoved'='true')`,[order.orderId])).toBe(1);
  });
  it('revalidates unpaid reinstatement and recomputes shipping when disabled', async () => {
    const order = await create();
    await operation(order.orderId,'cancelled');
    await operation(order.orderId,'reinstate');
    expect(await rpc('(select discount_cents from orders where id=$1)',[order.orderId])).toBe(4000);
    await operation(order.orderId,'cancelled');
    await db.exec(`update discounts set active=false where code='ECLLEGACY'`);
    await operation(order.orderId,'reinstate',{shippingPolicy:{baseCents:1200,freeThresholdCents:20000}});
    expect((await db.query('select discount_code,discount_cents,shipping_cents,total_cents from orders where id=$1',[order.orderId])).rows[0]).toEqual({discount_code:null,discount_cents:0,shipping_cents:1200,total_cents:17198});
  });
  it('preserves paid financial history on reinstatement and counts paid usage once', async () => {
    const order = await create();
    await operation(order.orderId,'paid');
    await operation(order.orderId,'paid');
    await operation(order.orderId,'cancelled');
    await db.exec(`update discounts set active=false where code='ECLLEGACY'`);
    await operation(order.orderId,'reinstate',{toPaid:true});
    expect(await rpc('(select total_cents from orders where id=$1)',[order.orderId])).toBe(12998);
    expect(await rpc("(select used_count from discounts where code='ECLLEGACY')")).toBe(1);
    expect(await rpc('(select discount_allocated_cents from order_items where order_id=$1)',[order.orderId])).toBe(4000);
  });
  it('rejects material edits after a formerly paid legacy order is reinstated to pending',async()=>{
    const order=await create();
    const itemId=await rpc('(select id from order_items where order_id=$1)',[order.orderId]);
    await operation(order.orderId,'paid');
    await operation(order.orderId,'cancelled');
    await operation(order.orderId,'reinstate');
    await db.exec(`update discounts set active=false where code='ECLLEGACY'`);
    expect(await operation(order.orderId,'edit_item',{itemId,qty:2})).toMatchObject({changed:false});
    expect(await rpc('(select total_cents from orders where id=$1)',[order.orderId])).toBe(12998);
    await expect(operation(order.orderId,'edit_item',{itemId,qty:3})).rejects.toThrow(/Previously paid legacy order/);
  });
  it('refunds exact odd-cent legacy net amounts', async () => {
    const order = await create();
    const itemId = await rpc('(select id from order_items where order_id=$1)',[order.orderId]);
    await operation(order.orderId,'paid');
    expect(await operation(order.orderId,'refund_items',{refunds:[{itemId,qty:1}]})).toMatchObject({refundedCents:5999,goodsRefundedCents:5999,shippingRefundedCents:0});
    expect(await operation(order.orderId,'refund_items',{refunds:[{itemId,qty:1}]})).toMatchObject({refundedCents:6999,goodsRefundedCents:5999,shippingRefundedCents:1000,fullyRefunded:true});
  });
  it('uses exact legacy allocations in the reviewed refund quote and commit workflow',async()=>{
    const order=await create();
    const itemId=await rpc('(select id from order_items where order_id=$1)',[order.orderId]);
    expect(await rpc('(select sum(discount_allocated_cents)::int from order_items where order_id=$1)',[order.orderId])).toBe(4000);
    await operation(order.orderId,'paid');
    const selection=JSON.stringify([{itemId,qty:1}]);
    const preview=await rpc<{token:string}>('commerce_refund_quote($1::uuid,$2::jsonb,false)',[order.orderId,selection]);
    expect(preview).toMatchObject({itemCents:7999,discountCents:2000,totalCents:5999,shippingCents:0});
    const args=[order.orderId,selection,preview.token,'legacy-partial','operator@example.test'];
    const result=await rpc('commerce_refund_commit($1::uuid,$2::jsonb,false,$3::uuid,$4,$5)',args);
    expect(result).toMatchObject({refundedCents:5999,fullyRefunded:false});
    expect(await rpc('commerce_refund_commit($1::uuid,$2::jsonb,false,$3::uuid,$4,$5)',args)).toEqual(result);
  });
  it('exposes legacy quote only to service_role', async () => {
    for (const role of ['anon','authenticated','service_role']) {
      expect(await rpc('has_function_privilege($1,$2,$3)',[role,'commerce_legacy_discount_quote(text,text,jsonb)','execute'])).toBe(role==='service_role');
    }
  });
});
