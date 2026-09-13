import { PGlite } from '@electric-sql/pglite';
import { existsSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
let db:PGlite;
const order='10000000-0000-0000-0000-000000000001';
const parent='20000000-0000-0000-0000-000000000001',child='20000000-0000-0000-0000-000000000002',sizeVariant='30000000-0000-0000-0000-000000000001';
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;
 create table orders(id uuid primary key,order_number text,checkout_request jsonb,paid_at timestamptz,subtotal_cents int,discount_cents int,shipping_cents int,currency text);
 create table products(id uuid primary key,slug text,size_parent_id uuid references products(id));
 create table product_variants(id uuid primary key,product_id uuid references products(id));
 create table order_items(id uuid default gen_random_uuid(),order_id uuid references orders(id),variant_id uuid references product_variants(id),sku text,product_slug text,product_name text,variant_label text,qty int,line_total_cents int,discount_allocated_cents int);
 create table commerce_events(id uuid primary key default gen_random_uuid(),order_id uuid references orders(id),kind text,payload jsonb default '{}');`);
 await db.exec(`insert into products values('${parent}','sample',null),('${child}','sample-size-private','${parent}');insert into product_variants values('${sizeVariant}','${child}');`);
 const file='supabase/migrations/20260908160000_paid_analytics.sql';if(existsSync(file))await db.exec(readFileSync(file,'utf8'));
 await db.exec(`alter table paid_analytics_outbox drop constraint paid_analytics_outbox_order_id_key;
  alter table paid_analytics_outbox add column event_kind text not null default 'purchase' check(event_kind in ('purchase','refund')),add column commerce_event_id uuid unique references commerce_events(id);
  create unique index paid_analytics_purchase_order on paid_analytics_outbox(order_id) where event_kind='purchase';`);
 await db.exec(readFileSync('supabase/migrations/20260913120000_order_attribution.sql','utf8'));
 await db.exec(`insert into measurement_campaigns(id,active) values('launch_2026',true);insert into measurement_experiments(id,variants,active) values('offer-holdout',array['control','holdout'],true);`);
});
afterAll(async()=>{await db.close()});
beforeEach(async()=>{await db.exec(`truncate orders cascade;
 insert into orders(id,order_number,checkout_request,paid_at,subtotal_cents,discount_cents,shipping_cents,currency) values('${order}','ECL-1001','{"analyticsClientId":"123456.789012","email":"private@example.test","name":"Private Buyer","token":"secret","orderAttribution":{"acquisition":{"source":"google","medium":"cpc","campaign":"launch_2026","landingPath":"/product/sample"},"experiments":[{"experimentId":"offer-holdout","variant":"holdout"}]}}',now()-interval '1 hour',3001,301,500,'AUD');
 insert into order_items(order_id,variant_id,sku,product_slug,product_name,variant_label,qty,line_total_cents,discount_allocated_cents) values('${order}','${sizeVariant}','SAMPLE-SKU','sample-size-private','Sample','5 mg · 3 vials',3,3001,301);`)});
async function paid(){await db.exec(`insert into commerce_events(order_id,kind) values('${order}','paid')`)}
async function row(){return (await db.query<Record<string,unknown>>('select * from paid_analytics_outbox')).rows[0]}
it('durably snapshots one privacy-safe net purchase at the first payment time',async()=>{
 await paid();
 expect((await db.query("select to_regclass('paid_analytics_outbox')::text name")).rows[0]).toEqual({name:'paid_analytics_outbox'});
 const first=await row();const payload=first.payload as {client_id:string;timestamp_micros:number;events:{params:{value:number;shipping:number;items:{price:number;quantity:number}[]}}[]};
 expect(payload.client_id).toBe('123456.789012');expect(payload.events[0].params.value).toBe(27);expect(payload.events[0].params.shipping).toBe(5);
 expect(payload.events[0].params).toEqual({transaction_id:'ECL-1001',currency:'AUD',value:27,shipping:5,acquisition_source:'google',acquisition_medium:'cpc',acquisition_campaign:'launch_2026',acquisition_landing_page:'/product/sample',experiment_id:'offer-holdout',experiment_variant:'holdout',items:[{item_id:'sample',item_name:'Sample',item_variant:'5 mg · 3 vials',quantity:3,price:9,discount:1.0033333333333333}]});
 expect((await db.query('select attribution from orders')).rows[0]).toEqual({attribution:{acquisition:{source:'google',medium:'cpc',campaign:'launch_2026',landingPath:'/product/sample'},experiments:[{experimentId:'offer-holdout',variant:'holdout'}]}});
 expect(JSON.stringify(payload)).not.toMatch(/private|secret|email|address|token|user_id|page_location/i);
 await db.exec("update orders set paid_at=now(),subtotal_cents=9000");await paid();expect(await row()).toEqual(first);
});
it('rejects order attribution containing unknown or personal fields before an order can retain it',async()=>{
 await expect(db.exec(`update orders set checkout_request=jsonb_set(checkout_request,'{orderAttribution}', '{"acquisition":{"source":"google","landingPath":"/shop","email":"private@example.test"},"experiments":[]}'::jsonb)`)).rejects.toThrow(/attribution/i);
});
it('scrubs structurally valid inactive campaign and experiment dimensions instead of blocking commerce',async()=>{
 await db.exec(`update orders set checkout_request=jsonb_set(checkout_request,'{orderAttribution}', '{"acquisition":{"source":"google","medium":"cpc","campaign":"unknown","landingPath":"/shop"},"experiments":[]}'::jsonb)`);
 expect((await db.query('select attribution,checkout_request->\'orderAttribution\' copied from orders')).rows[0]).toEqual({attribution:{acquisition:{source:'google',medium:'cpc',landingPath:'/shop'},experiments:[]},copied:{acquisition:{source:'google',medium:'cpc',landingPath:'/shop'},experiments:[]}});
 await db.exec(`update orders set checkout_request=jsonb_set(checkout_request,'{orderAttribution}', '{"acquisition":{"source":"google","medium":"cpc","campaign":"launch_2026","landingPath":"/shop"},"experiments":[{"experimentId":"offer-holdout","variant":"invented"}]}'::jsonb)`);
 expect((await db.query('select attribution from orders')).rows[0]).toEqual({attribution:{acquisition:{source:'google',medium:'cpc',campaign:'launch_2026',landingPath:'/shop'},experiments:[]}});
});
it('does not create events without an authentic-shaped analytics client ID or for unpaid events',async()=>{
 await db.exec(`update orders set checkout_request='{}';insert into commerce_events(order_id,kind) values('${order}','created')`);await paid();
 await db.exec(`update orders set checkout_request='{"analyticsClientId":"invented-user@example.test"}'`);await paid();
 expect((await db.query('select count(*)::int n from paid_analytics_outbox')).rows[0]).toEqual({n:0});
});
it('rolls back payment event when its durable purchase insert fails',async()=>{
 await db.exec("create function reject_purchase() returns trigger language plpgsql as $$ begin raise exception 'injected analytics failure';end $$;create trigger reject_purchase before insert on paid_analytics_outbox for each row execute function reject_purchase();");
 try{await expect(paid()).rejects.toThrow('injected analytics failure')}finally{await db.exec('drop trigger reject_purchase on paid_analytics_outbox;drop function reject_purchase()')}
 expect((await db.query('select count(*)::int n from commerce_events')).rows[0]).toEqual({n:0});
});
it('claims exclusively, reclaims expired leases, and rejects stale completion',async()=>{
 await paid();const first=(await db.query<{id:string;lease_token:string}>('select * from claim_paid_analytics()')).rows[0];
 expect((await db.query('select * from claim_paid_analytics()')).rows).toHaveLength(0);
 await db.exec("update paid_analytics_outbox set lease_expires_at=now()-interval '1 second'");
 const next=(await db.query<{lease_token:string}>('select * from claim_paid_analytics()')).rows[0];expect(next.lease_token).not.toBe(first.lease_token);
 expect((await db.query('select finish_paid_analytics($1,$2,true,false,null) finished',[first.id,first.lease_token])).rows[0]).toEqual({finished:false});
 expect((await db.query('select finish_paid_analytics($1,$2,true,false,null) finished',[first.id,next.lease_token])).rows[0]).toEqual({finished:true});
 expect((await row()).status).toBe('accepted');
});
it('backs off failures and retires attempts older than the GA4 72-hour window',async()=>{
 await paid();const first=(await db.query<{id:string;lease_token:string}>('select * from claim_paid_analytics()')).rows[0];
 await db.query('select finish_paid_analytics($1,$2,false,false,$3)',[first.id,first.lease_token,'HTTP 503']);
 expect((await row()).status).toBe('failed');expect((await db.query('select * from claim_paid_analytics()')).rows).toHaveLength(0);
 await db.exec("update paid_analytics_outbox set next_attempt_at=now(),occurred_at=now()-interval '73 hours'");
 expect((await db.query('select * from claim_paid_analytics()')).rows).toHaveLength(0);expect((await row()).status).toBe('dead');
});
it('denies public execution and retires the final failed attempt',async()=>{
 expect((await db.query("select has_function_privilege('anon','claim_paid_analytics()','execute') allowed")).rows[0]).toEqual({allowed:false});
 expect((await db.query("select has_table_privilege('authenticated','paid_analytics_outbox','select') allowed")).rows[0]).toEqual({allowed:false});
 await paid();await db.exec('update paid_analytics_outbox set attempts=7');
 const claimed=(await db.query<{id:string;lease_token:string}>('select * from claim_paid_analytics()')).rows[0];
 await db.query('select finish_paid_analytics($1,$2,false,false,$3)',[claimed.id,claimed.lease_token,'HTTP 503']);
 expect((await row()).status).toBe('dead');expect((await db.query('select * from claim_paid_analytics()')).rows).toHaveLength(0);
});

it('exposes retired-only queues as unhealthy through a service-only dead count',async()=>{
 await paid();await db.exec("update paid_analytics_outbox set occurred_at=now()-interval '73 hours'");
 expect((await db.query('select * from claim_paid_analytics()')).rows).toHaveLength(0);
 expect((await db.query('select paid_analytics_dead_count() n')).rows[0]).toEqual({n:1});
 expect((await db.query("select has_function_privilege('anon','paid_analytics_dead_count()','execute') allowed")).rows[0]).toEqual({allowed:false});
});
