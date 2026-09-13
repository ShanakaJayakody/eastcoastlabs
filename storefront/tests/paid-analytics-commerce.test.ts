import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';
let db:PGlite;
const variant='20000000-0000-0000-0000-000000000001';
beforeAll(async()=>{
 db=new PGlite();await db.exec('create role anon;create role authenticated;create role service_role;');
 await db.exec(readFileSync('supabase/migrations/20260724110000_commerce.sql','utf8'));
 await db.exec(`alter table order_items add refunded_qty int not null default 0,add refunded_cents int not null default 0,add unit_cost_cents int;
 alter table orders add refunded_cents int not null default 0,add payment_reference text,add payment_expires_at timestamptz;
 alter table products add unit_cost_cents int,add size_parent_id uuid references products(id),add size_label text;alter table order_events drop constraint order_events_type_check;
 create table admin_audit_log(id uuid primary key default gen_random_uuid(),actor_email text not null,action text,entity_type text,entity_id text,diff jsonb,created_at timestamptz default now());
 insert into products(id,slug,name) values('10000000-0000-0000-0000-000000000001','sample','Sample');
 insert into product_variants(id,product_id,sku,pack_size,label,price_cents) values('${variant}','10000000-0000-0000-0000-000000000001','SAMPLE',1,'1 vial',1000);
 insert into stock_movements(variant_id,qty,reason) values('${variant}',30,'received');`);
 await db.exec(readFileSync('supabase/migrations/20260908100000_commerce_integrity.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20260908160000_paid_analytics.sql','utf8'));
 await db.exec(`alter table paid_analytics_outbox drop constraint paid_analytics_outbox_order_id_key;
  alter table paid_analytics_outbox add column event_kind text not null default 'purchase' check(event_kind in ('purchase','refund')),add column commerce_event_id uuid unique references commerce_events(id);
  create unique index paid_analytics_purchase_order on paid_analytics_outbox(order_id) where event_kind='purchase';`);
 await db.exec(readFileSync('supabase/migrations/20260913120000_order_attribution.sql','utf8'));
 await db.exec(`insert into measurement_campaigns(id,active) values('launch_2026',true);insert into measurement_experiments(id,variants,active) values('offer-holdout',array['control','holdout'],true);`);
});
afterAll(async()=>{await db.close()});
it('follows real commerce creation and discounted payment, with no duplicate after paid reinstatement',async()=>{
 const order=(await db.query<{result:{orderId:string;orderNumber:string}}>('select commerce_create_order($1::jsonb) result',[JSON.stringify({email:'buyer@example.test',analyticsClientId:'123456.789012',orderAttribution:{acquisition:{source:'google',medium:'cpc',campaign:'launch_2026',landingPath:'/product/sample'},experiments:[{experimentId:'offer-holdout',variant:'holdout'}]},items:[{variantId:variant,qty:3}],shippingCents:500,discountCode:'WELCOME10'})])).rows[0].result;
 expect((await db.query('select count(*)::int n from paid_analytics_outbox')).rows[0]).toEqual({n:0});
 const action=(name:string)=>db.query('select commerce_order_operation($1,$2,$3::jsonb)',[order.orderId,name,'{}']);
 await action('paid');const first=(await db.query<{payload:{events:{params:{value:number;shipping:number;transaction_id:string}}[]}}> ('select payload from paid_analytics_outbox')).rows[0];
 expect(first.payload.events[0].params).toMatchObject({value:27,shipping:5,transaction_id:order.orderNumber,acquisition_source:'google',experiment_id:'offer-holdout',items:[{item_id:'sample',item_variant:'1 vial',quantity:3}]});
 await action('cancelled');await action('reinstate');await action('paid');
 expect((await db.query('select payload from paid_analytics_outbox')).rows).toEqual([first]);
});
it.each([
 ['fingerprinted','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a'.repeat(64)],
 ['legacy no-fingerprint','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',undefined],
])('preserves committed attribution when configuration retires before a %s replay and payment',async(_label,key,fingerprint)=>{
 const attributed={acquisition:{source:'google',medium:'cpc',campaign:'launch_2026',landingPath:'/product/sample'},experiments:[{experimentId:'offer-holdout',variant:'holdout'}]};
 const input={email:`${key.slice(0,8)}@example.test`,idempotencyKey:key,...(fingerprint?{requestFingerprint:fingerprint}:{}),analyticsClientId:'123456.789012',orderAttribution:attributed,items:[{variantId:variant,qty:1}],shippingCents:500};
 const first=(await db.query<{result:{orderId:string;replayed:boolean}}>('select commerce_create_order($1::jsonb) result',[JSON.stringify(input)])).rows[0].result;
 await db.exec('update measurement_campaigns set active=false;update measurement_experiments set active=false');
 try {
  const replay=(await db.query<{result:{orderId:string;replayed:boolean}}>('select commerce_create_order($1::jsonb) result',[JSON.stringify(input)])).rows[0].result;
  expect(replay).toMatchObject({orderId:first.orderId,replayed:true});
  const stored=(await db.query<{attribution:unknown;checkout_request:Record<string,unknown>}>('select attribution,checkout_request from orders where id=$1',[first.orderId])).rows[0];
  expect(stored.attribution).toEqual(attributed);
  expect(stored.checkout_request.orderAttribution).toEqual(stored.attribution);
  await db.query('select commerce_order_operation($1,$2,$3::jsonb)',[first.orderId,'paid','{}']);
  const paid=(await db.query<{payload:{events:{params:Record<string,unknown>}[]}}>('select payload from paid_analytics_outbox where order_id=$1',[first.orderId])).rows[0];
  expect(paid.payload.events[0].params).toMatchObject({acquisition_campaign:'launch_2026',experiment_id:'offer-holdout',experiment_variant:'holdout'});
 } finally {
  await db.exec('update measurement_campaigns set active=true;update measurement_experiments set active=true');
 }
});
it('scrubs retired optional dimensions from a new stale-cookie order and its checkout request',async()=>{
 const input={email:'stale@example.test',idempotencyKey:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',requestFingerprint:'c'.repeat(64),orderAttribution:{acquisition:{source:'google',medium:'cpc',campaign:'launch_2026',landingPath:'/product/sample'},experiments:[{experimentId:'offer-holdout',variant:'holdout'}]},items:[{variantId:variant,qty:1}],shippingCents:500};
 await db.exec('update measurement_campaigns set active=false;update measurement_experiments set active=false');
 try {
  const order=(await db.query<{result:{orderId:string}}>('select commerce_create_order($1::jsonb) result',[JSON.stringify(input)])).rows[0].result;
  const stored=(await db.query<{attribution:unknown;checkout_request:Record<string,unknown>}>('select attribution,checkout_request from orders where id=$1',[order.orderId])).rows[0];
  expect(stored.attribution).toEqual({acquisition:{source:'google',medium:'cpc',landingPath:'/product/sample'},experiments:[]});
  expect(stored.checkout_request.orderAttribution).toEqual(stored.attribution);
  expect(JSON.stringify(stored)).not.toMatch(/launch_2026|offer-holdout|holdout/);
 } finally {await db.exec('update measurement_campaigns set active=true;update measurement_experiments set active=true');}
});
