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
 alter table products add unit_cost_cents int;alter table order_events drop constraint order_events_type_check;
 create table admin_audit_log(id uuid primary key default gen_random_uuid(),actor_email text not null,action text,entity_type text,entity_id text,diff jsonb,created_at timestamptz default now());
 insert into products(id,slug,name) values('10000000-0000-0000-0000-000000000001','sample','Sample');
 insert into product_variants(id,product_id,sku,pack_size,label,price_cents) values('${variant}','10000000-0000-0000-0000-000000000001','SAMPLE',1,'1 vial',1000);
 insert into stock_movements(variant_id,qty,reason) values('${variant}',30,'received');`);
 await db.exec(readFileSync('supabase/migrations/20260908100000_commerce_integrity.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20260908160000_paid_analytics.sql','utf8'));
});
afterAll(async()=>{await db.close()});
it('follows real commerce creation and discounted payment, with no duplicate after paid reinstatement',async()=>{
 const order=(await db.query<{result:{orderId:string;orderNumber:string}}>('select commerce_create_order($1::jsonb) result',[JSON.stringify({email:'buyer@example.test',analyticsClientId:'123456.789012',items:[{variantId:variant,qty:3}],shippingCents:500,discountCode:'WELCOME10'})])).rows[0].result;
 expect((await db.query('select count(*)::int n from paid_analytics_outbox')).rows[0]).toEqual({n:0});
 const action=(name:string)=>db.query('select commerce_order_operation($1,$2,$3::jsonb)',[order.orderId,name,'{}']);
 await action('paid');const first=(await db.query<{payload:{events:{params:{value:number;shipping:number;transaction_id:string}}[]}}> ('select payload from paid_analytics_outbox')).rows[0];
 expect(first.payload.events[0].params).toMatchObject({value:27,shipping:5,transaction_id:order.orderNumber});
 await action('cancelled');await action('reinstate');await action('paid');
 expect((await db.query('select payload from paid_analytics_outbox')).rows).toEqual([first]);
});
