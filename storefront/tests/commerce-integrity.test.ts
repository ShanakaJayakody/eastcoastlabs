import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';

type CommerceResult = { orderId: string; orderNumber: string; totalCents: number; paymentReference: string; paymentExpiresAt: string; replayed: boolean; refundedCents: number; fullyRefunded: boolean };
let db: PGlite;
const migration = resolve('supabase/migrations/20260908100000_commerce_integrity.sql');
const product = '10000000-0000-0000-0000-000000000001';
const single = '20000000-0000-0000-0000-000000000001';
const pack = '20000000-0000-0000-0000-000000000003';
const key = '30000000-0000-0000-0000-000000000001';
async function create(overrides: Record<string, unknown> = {}) {
 const input = {idempotencyKey:key,email:'buyer@example.test',items:[{variantId:single,qty:3}], shippingCents:500,paymentExpiryHours:48,...overrides};
 return (await db.query<{result: CommerceResult}>('select commerce_create_order($1::jsonb) result',[JSON.stringify(input)])).rows[0].result;
}
async function act(id: string, action: string, options: Record<string,unknown> = {}) {
 return (await db.query<{result:CommerceResult}>('select commerce_order_operation($1::uuid,$2,$3::jsonb) result',[id,action,JSON.stringify(options)])).rows[0].result;
}
async function state() {
 return (await db.query('select on_hand,reserved from inventory where variant_id=$1',[single])).rows[0];
}
beforeAll(async()=>{
 db = new PGlite();
 await db.exec('create role service_role; create role anon; create role authenticated;');
 await db.exec(readFileSync(resolve('supabase/migrations/20260724110000_commerce.sql'),'utf8'));
 await db.exec(`alter table order_items add refunded_qty int not null default 0, add refunded_cents int not null default 0, add unit_cost_cents int;
 alter table orders add refunded_cents int not null default 0, add payment_reference text, add payment_expires_at timestamptz;
 alter table products add unit_cost_cents int;
 alter table order_events drop constraint order_events_type_check;
 create table admin_audit_log(id uuid primary key default gen_random_uuid(),actor_email text,action text,entity_type text,entity_id text,diff jsonb,created_at timestamptz default now());`);
 if (existsSync(migration)) await db.exec(readFileSync(migration,'utf8'));
},30000);
afterAll(async()=>{await db.close()});
beforeEach(async()=>{
 await db.exec(`truncate orders cascade; truncate stock_movements, inventory, product_variants, products cascade;
 insert into products(id,slug,name,unit_cost_cents) values('${product}','sample','Sample',200);
 insert into product_variants(id,product_id,sku,pack_size,label,price_cents) values('${single}','${product}','SINGLE',1,'1 vial',1000),('${pack}','${product}','PACK',3,'3-pack',2700);
 insert into stock_movements(variant_id,qty,reason) values('${single}',30,'received');`);
});
describe('transactional commerce',()=>{
 it('replays one checkout without reserving or creating twice and rejects another customer using its key',async()=>{
  const first=await create(); const second=await create();
  expect(second.orderId).toBe(first.orderId); expect(second.replayed).toBe(true);
  expect(first.paymentReference).toMatch(/^ECL-/); expect(first.paymentExpiresAt).toBeTruthy();
  expect(await state()).toEqual({on_hand:30,reserved:3});
  expect((await db.query('select count(*)::int n from orders')).rows[0]).toEqual({n:1});
  await expect(create({email:'different@example.test'})).rejects.toThrow(/IDEMPOTENCY/);
 });
 it('rolls back the complete order when an item write fails',async()=>{
  await db.exec(`create function test_reject_item() returns trigger language plpgsql as $$ begin raise exception 'injected item failure'; end $$; create trigger test_reject_item before insert on order_items for each row execute function test_reject_item();`);
  try {await expect(create()).rejects.toThrow('injected item failure');} finally {await db.exec('drop trigger test_reject_item on order_items; drop function test_reject_item();')}
  expect((await db.query('select count(*)::int n from orders')).rows[0]).toEqual({n:0});
  expect(await state()).toEqual({on_hand:30,reserved:0});
 });
 it('settles a shared pool once, freezes cost, and paid cannot lose to stale expiry',async()=>{
  const o=await create({items:[{variantId:pack,qty:2},{variantId:single,qty:1}]});
  await act(o.orderId,'paid'); await act(o.orderId,'paid');
  expect(await state()).toEqual({on_hand:23,reserved:0});
  expect((await db.query('select sum(unit_cost_cents*qty)::int cents from order_items')).rows[0]).toEqual({cents:1400});
  await act(o.orderId,'expire'); expect((await db.query('select status from orders')).rows[0]).toEqual({status:'paid'});
 });
 it('cancel before payment releases the claim and prevents payment',async()=>{
  const o=await create(); await act(o.orderId,'cancelled'); await act(o.orderId,'cancelled');
  await expect(act(o.orderId,'paid')).rejects.toThrow(/transition/i);
  expect(await state()).toEqual({on_hand:30,reserved:0});
 });
 it('refunds one of three then the remaining two, allocating discount and final shipping exactly',async()=>{
  const o=await create({discountCode:'WELCOME10'}); await act(o.orderId,'paid');
  const item=(await db.query<{id:string}>('select id from order_items')).rows[0].id;
  const first=await act(o.orderId,'refund_items',{idempotencyKey:'return-1',refunds:[{itemId:item,qty:1}],restock:true});
  expect(first.refundedCents).toBe(900); expect(await state()).toEqual({on_hand:28,reserved:0});
  expect(await act(o.orderId,'refund_items',{idempotencyKey:'return-1',refunds:[{itemId:item,qty:1}],restock:true})).toEqual(first);
  const last=await act(o.orderId,'refunded',{restock:true});
  expect(last.refundedCents).toBe(2300); expect(await state()).toEqual({on_hand:30,reserved:0});
  expect((await db.query('select qty,refunded_qty,returned_qty,refunded_cents from order_items')).rows[0]).toEqual({qty:3,refunded_qty:3,returned_qty:3,refunded_cents:2700});
  expect((await db.query('select refunded_cents,total_cents,status from orders')).rows[0]).toEqual({refunded_cents:3200,total_cents:3200,status:'refunded'});
 });
 it('partial return then cancel restores only the remaining units',async()=>{
  const o=await create(); await act(o.orderId,'paid'); const item=(await db.query<{id:string}>('select id from order_items')).rows[0].id;
  await act(o.orderId,'refund_items',{refunds:[{itemId:item,qty:1}]}); await act(o.orderId,'cancelled');
  expect(await state()).toEqual({on_hand:30,reserved:0});
 });
 it('money-only refunds do not put shipped goods on the shelf',async()=>{
  const o=await create(); await act(o.orderId,'paid'); await act(o.orderId,'refunded',{restock:false});
  expect(await state()).toEqual({on_hand:27,reserved:0});
  expect((await db.query('select returned_qty from order_items')).rows[0]).toEqual({returned_qty:0});
 });
 it('rejects inactive parent or variant and stale totals without writes',async()=>{
  await db.exec(`update products set status='archived'`); await expect(create()).rejects.toThrow(/unavailable/i);
  await db.exec(`update products set status='active'; update product_variants set active=false`); await expect(create()).rejects.toThrow(/unavailable/i);
  await db.exec('update product_variants set active=true'); await expect(create({expectedTotalCents:1})).rejects.toThrow(/QUOTE_CHANGED/);
  expect(await state()).toEqual({on_hand:30,reserved:0});
 });
 it('validates all refund quantities before any money or stock changes',async()=>{
  const o=await create(); await act(o.orderId,'paid'); const item=(await db.query<{id:string}>('select id from order_items')).rows[0].id;
  await expect(act(o.orderId,'refund_items',{refunds:[{itemId:item,qty:1},{itemId:item,qty:3}]})).rejects.toThrow();
  expect(await state()).toEqual({on_hand:27,reserved:0});
  expect((await db.query('select refunded_cents from orders')).rows[0]).toEqual({refunded_cents:0});
 });
 it('reinstates and pays atomically with stock, but cannot revive already refunded units',async()=>{
  const o=await create(); await act(o.orderId,'cancelled'); await act(o.orderId,'reinstate',{toPaid:true});
  expect(await state()).toEqual({on_hand:27,reserved:0});
  await act(o.orderId,'cancelled'); await db.exec('update orders set refunded_cents=1');
  await expect(act(o.orderId,'reinstate')).rejects.toThrow(/refund/i);
 });
 it('edits pending quantities and shipping atomically and cannot remove the final line',async()=>{
  const o=await create(); const item=(await db.query<{id:string}>('select id from order_items')).rows[0].id;
  await act(o.orderId,'edit_item',{itemId:item,qty:4,shippingPolicy:{baseCents:500,freeThresholdCents:4000}});
  expect(await state()).toEqual({on_hand:30,reserved:4});
  expect((await db.query('select total_cents from orders')).rows[0]).toEqual({total_cents:4000});
  await expect(act(o.orderId,'edit_item',{itemId:item,qty:40,shippingPolicy:{baseCents:500,freeThresholdCents:4000}})).rejects.toThrow(/OUT_OF_STOCK/);
  await expect(act(o.orderId,'edit_item',{itemId:item,qty:0,shippingPolicy:{baseCents:500,freeThresholdCents:4000}})).rejects.toThrow(/final line/i);
  expect(await state()).toEqual({on_hand:30,reserved:4});
 });
 it('expiry checks the locked order deadline and is idempotent',async()=>{
  const o=await create(); await act(o.orderId,'expire'); expect(await state()).toEqual({on_hand:30,reserved:3});
  await db.exec("update orders set payment_expires_at=now()-interval '1 hour'");
  await act(o.orderId,'expire'); await act(o.orderId,'expire'); expect(await state()).toEqual({on_hand:30,reserved:0});
  expect((await db.query("select count(*)::int n from commerce_events where kind='expired'")).rows[0]).toEqual({n:1});
 });
 it('tracking correction preserves dispatch time and rejects pending orders',async()=>{
  const o=await create(); await expect(act(o.orderId,'tracking',{trackingNumber:'NEW'})).rejects.toThrow(/shipped/);
  await act(o.orderId,'paid'); await act(o.orderId,'shipped',{trackingNumber:'OLD'});
  const before=(await db.query('select shipped_at from orders')).rows[0];
  await act(o.orderId,'tracking',{trackingNumber:'NEW'});
  expect((await db.query('select shipped_at from orders')).rows[0]).toEqual(before);
  expect((await db.query("select count(*)::int n from commerce_events where kind='shipped'")).rows[0]).toEqual({n:1});
 });

 it('looks up a committed attempt using its original server fingerprint after catalog changes',async()=>{
  const fingerprint='a'.repeat(64); const o=await create({requestFingerprint:fingerprint});
  await db.exec('update product_variants set active=false');
  const replay=(await db.query<{result:CommerceResult}>('select commerce_checkout_replay($1::uuid,$2) result',[key,fingerprint])).rows[0].result;
  expect(replay.orderId).toBe(o.orderId);
  await expect(db.query('select commerce_checkout_replay($1::uuid,$2)',[key,'b'.repeat(64)])).rejects.toThrow(/IDEMPOTENCY/);
  expect((await create({requestFingerprint:fingerprint,shippingCents:999})).orderId).toBe(o.orderId);
 });
 it('protects existing hold deadlines against payment-plan retries',async()=>{
  const o=await create(); await db.query('select commerce_set_payment_plan($1::uuid,$2,$3)',[o.orderId,'OTHER',100]);
  const plan=(await db.query<{payment_reference:string;payment_expires_at:string}>('select payment_reference,payment_expires_at from orders')).rows[0];
  expect(plan.payment_reference).toBe(o.paymentReference); expect(new Date(plan.payment_expires_at as string).toISOString()).toBe(new Date(o.paymentExpiresAt).toISOString());
 });

 it('rolls back payment after the first pool movement when the next movement fails',async()=>{
  const product2='10000000-0000-0000-0000-000000000002';const variant2='20000000-0000-0000-0000-000000000002';
  await db.exec(`insert into products(id,slug,name) values('${product2}','other','Other'); insert into product_variants(id,product_id,sku,pack_size,label,price_cents) values('${variant2}','${product2}','OTHER',1,'1 vial',500); insert into stock_movements(variant_id,qty,reason) values('${variant2}',10,'received');`);
  const o=await create({items:[{variantId:single,qty:1},{variantId:variant2,qty:1}]});
  await db.exec(`create function test_reject_sale() returns trigger language plpgsql as $$ begin if new.reason='sale' and new.variant_id='${variant2}' then raise exception 'injected second sale failure'; end if; return new; end $$; create trigger test_reject_sale before insert on stock_movements for each row execute function test_reject_sale();`);
  try {await expect(act(o.orderId,'paid')).rejects.toThrow('injected second sale failure');} finally {await db.exec('drop trigger test_reject_sale on stock_movements; drop function test_reject_sale();')}
  expect(await state()).toEqual({on_hand:30,reserved:1});
  expect((await db.query('select status from orders')).rows[0]).toEqual({status:'pending'});
  expect((await db.query("select count(*)::int n from commerce_events where kind='paid'")).rows[0]).toEqual({n:0});
 });
 it('allocates odd discount pennies across lines and sequential returns without drift',async()=>{
  await db.exec("insert into discounts(code,kind,value_cents) values('ONECENT','fixed',1) on conflict(code) do nothing");
  const o=await create({discountCode:'ONECENT',items:[{variantId:single,qty:3},{variantId:pack,qty:1}]}); await act(o.orderId,'paid');
  const items=(await db.query<{id:string;qty:number;line_total_cents:number;discount_allocated_cents:number}>('select id,qty,line_total_cents,discount_allocated_cents from order_items order by id')).rows;
  expect(items.reduce((sum,i)=>sum+i.discount_allocated_cents,0)).toBe(1);
  let total=0;for(const item of items) for(let i=0;i<item.qty;i++) total+=(await act(o.orderId,'refund_items',{refunds:[{itemId:item.id,qty:1}]})).refundedCents;
  expect(total).toBe(6199);expect(await state()).toEqual({on_hand:30,reserved:0});
 });
 it('reserves kit water alongside kit stock and returns each dependency once',async()=>{
  const bacProduct='10000000-0000-0000-0000-000000000002';const bacVariant='20000000-0000-0000-0000-000000000002';
  await db.exec(`update products set slug='reconstitution-kit'; insert into products(id,slug,name) values('${bacProduct}','bacteriostatic-water','Water'); insert into product_variants(id,product_id,sku,pack_size,label,price_cents) values('${bacVariant}','${bacProduct}','WATER',1,'1 vial',500); insert into stock_movements(variant_id,qty,reason) values('${bacVariant}',3,'received');`);
  const o=await create(); expect((await db.query('select reserved from inventory where variant_id=$1',[bacVariant])).rows[0]).toEqual({reserved:3});
  await act(o.orderId,'paid'); expect((await db.query('select on_hand from inventory where variant_id=$1',[bacVariant])).rows[0]).toEqual({on_hand:0});
  await act(o.orderId,'refunded'); expect((await db.query('select on_hand from inventory where variant_id=$1',[bacVariant])).rows[0]).toEqual({on_hand:3});
 });
 it('restricts all commerce RPCs to the service role',async()=>{
  const rows=(await db.query<{allowed:boolean}>("select has_function_privilege('anon','commerce_create_order(jsonb)','execute') or has_function_privilege('authenticated','commerce_order_operation(uuid,text,jsonb)','execute') as allowed")).rows;
  expect(rows[0].allowed).toBe(false);
 });

 it('rejects a bundle quote if a component price changes before atomic creation',async()=>{
  await expect(create({items:[{variantId:single,qty:1,priceOverrideCents:900,expectedPriceCents:999}]})).rejects.toThrow(/QUOTE_CHANGED/);
  expect(await state()).toEqual({on_hand:30,reserved:0});
 });
 it('does not fill an unknown historical sale cost during reinstatement',async()=>{
  await db.exec('update products set unit_cost_cents=null');const o=await create();await act(o.orderId,'paid');await act(o.orderId,'cancelled');
  await db.exec('update products set unit_cost_cents=500');await act(o.orderId,'reinstate',{toPaid:true});
  expect((await db.query('select unit_cost_cents from order_items')).rows[0]).toEqual({unit_cost_cents:null});
 });

 it('previews the same combined stock claims and refund eligibility as reinstatement',async()=>{
  const o=await create({items:[{variantId:single,qty:1},{variantId:pack,qty:1}]}); await act(o.orderId,'cancelled');
  await db.exec(`insert into stock_movements(variant_id,qty,reason) values('${single}',-27,'adjustment')`);
  const preview=async()=>(await db.query<{recoverable:boolean;lines:unknown[]}>('select * from commerce_reinstatement_preview($1::uuid[])',[[o.orderId]])).rows[0];
  expect((await preview()).recoverable).toBe(false);
  await db.exec(`insert into stock_movements(variant_id,qty,reason) values('${single}',10,'received')`);
  expect((await preview()).recoverable).toBe(true);
  await db.exec('update orders set refunded_cents=1'); expect((await preview()).recoverable).toBe(false);
 });

 it('holds limited discount capacity until payment or cancellation and rechecks it on reinstatement',async()=>{
  await db.exec("insert into discounts(code,kind,percent,usage_limit) values('LIMITED','percent',10,1) on conflict(code) do update set used_count=0");
  const first=await create({discountCode:'LIMITED'});
  const next={idempotencyKey:'30000000-0000-0000-0000-000000000002',discountCode:'LIMITED'};
  await expect(create(next)).rejects.toThrow(/Discount unavailable/);
  await act(first.orderId,'cancelled');const second=await create(next);
  await expect(act(first.orderId,'reinstate')).rejects.toThrow(/Discount unavailable/);
  await act(second.orderId,'paid');await act(second.orderId,'cancelled');await act(second.orderId,'reinstate',{toPaid:true});
  expect((await db.query("select used_count from discounts where code='LIMITED'")).rows[0]).toEqual({used_count:1});
 });

 it('releases a discount claim when a pending edit removes eligibility',async()=>{
  await db.exec("insert into discounts(code,kind,percent,usage_limit,min_spend_cents) values('MINIMUM','percent',10,1,4000) on conflict(code) do update set used_count=0");
  const o=await create({discountCode:'MINIMUM',items:[{variantId:single,qty:4}]});
  const item=(await db.query<{id:string}>('select id from order_items')).rows[0];
  await act(o.orderId,'edit_item',{itemId:item.id,qty:3,shippingPolicy:{baseCents:500,freeThresholdCents:10000}});
  expect((await db.query('select discount_code,discount_cents from orders')).rows[0]).toEqual({discount_code:null,discount_cents:0});
  expect((await create({idempotencyKey:'30000000-0000-0000-0000-000000000002',discountCode:'MINIMUM',items:[{variantId:single,qty:4}]})).totalCents).toBe(4100);
 });

});
describe('public checkout reservation limits',()=>{
 const publicCreate=(n:number,options:Record<string,unknown>={})=>create({idempotencyKey:`40000000-0000-0000-0000-${String(n).padStart(12,'0')}`,items:[{variantId:single,qty:1}],...options});
 it('limits normalized email to five unexpired pending orders, but allows committed replay and admin creation',async()=>{
  const first=await publicCreate(1,{email:' Buyer@Example.Test '});
  for(let n=2;n<=5;n++)await publicCreate(n);
  await expect(publicCreate(6)).rejects.toThrow('CHECKOUT_RATE_LIMIT');
  expect((await publicCreate(1,{email:' Buyer@Example.Test '})).orderId).toBe(first.orderId);
  expect((await db.query('select count(*)::int n from orders')).rows[0]).toEqual({n:5});
  await create({idempotencyKey:undefined,items:[{variantId:single,qty:1}]});
  expect((await db.query('select count(*)::int n from orders')).rows[0]).toEqual({n:6});
 });
 it('frees the pending slot when a prior order expires, while enforcing ten creates per rolling hour across cancellation',async()=>{
  for(let n=1;n<=5;n++)await publicCreate(n);
  await db.exec("update orders set payment_expires_at=now()-interval '1 second'");
  const sixth=await publicCreate(6);await act(sixth.orderId,'cancelled');
  for(let n=7;n<=10;n++){const o=await publicCreate(n);await act(o.orderId,'cancelled')}
  await expect(publicCreate(11)).rejects.toThrow('CHECKOUT_RATE_LIMIT');
  await db.exec("update orders set created_at=now()-interval '61 minutes'");
  await publicCreate(11);
  expect((await db.query('select count(*)::int n from orders')).rows[0]).toEqual({n:11});
 });
});
it('returns original purchased lines on commit and both replay paths after stock and price change',async()=>{
 const purchasedLines=[{key:'sample:1 vial',slug:'sample',name:'Sample',variantLabel:'1 vial',quantity:3,unitPriceCents:1000,lineTotalCents:3000,isGift:false}];
 const requestFingerprint='b'.repeat(64);
 const first=await create({purchasedLines,requestFingerprint});expect(first).toMatchObject({purchasedLines});
 await db.exec(`update inventory set on_hand=reserved;update product_variants set price_cents=9000,active=false;`);
 expect((await create({purchasedLines:[],requestFingerprint}))).toMatchObject({orderId:first.orderId,replayed:true,purchasedLines});
 expect((await db.query<{result:unknown}>('select commerce_checkout_replay($1,$2) result',[key,requestFingerprint])).rows[0].result).toMatchObject({orderId:first.orderId,replayed:true,purchasedLines});
});
it('rejects a purchased-line snapshot that disagrees with the transaction-resolved goods amount',async()=>{
 const purchasedLines=[{key:'sample:1 vial',slug:'sample',name:'Sample',variantLabel:'1 vial',quantity:3,unitPriceCents:1,lineTotalCents:3,isGift:false}];
 await expect(create({purchasedLines})).rejects.toThrow('Invalid purchased lines');
 expect((await db.query('select count(*)::int n from orders')).rows[0]).toEqual({n:0});expect(await state()).toEqual({on_hand:30,reserved:0});
});
