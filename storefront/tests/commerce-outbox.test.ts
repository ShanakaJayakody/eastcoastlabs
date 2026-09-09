import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, afterAll, expect, it } from 'vitest';
let db:PGlite;
const variant='20000000-0000-0000-0000-000000000001';
type Order={orderId:string;totalCents:number};
beforeAll(async()=>{
 db=new PGlite();await db.exec('create role anon; create role authenticated; create role service_role;');
 await db.exec(readFileSync('supabase/migrations/20260724110000_commerce.sql','utf8'));
 await db.exec(`alter table order_items add refunded_qty int not null default 0,add refunded_cents int not null default 0,add unit_cost_cents int;
 alter table orders add refunded_cents int not null default 0,add payment_reference text,add payment_expires_at timestamptz;
 alter table products add unit_cost_cents int;
 alter table order_events drop constraint order_events_type_check;
 create table admin_audit_log(id uuid primary key default gen_random_uuid(),actor_email text not null,action text,entity_type text,entity_id text,diff jsonb,created_at timestamptz default now());
 create table email_outbox(id uuid primary key default gen_random_uuid(),to_email text,template text,payload jsonb default '{}',status text default 'queued',error text,related_type text,related_id text,created_at timestamptz default now(),sent_at timestamptz,provider_message_id text,unique(to_email,template,related_id));
 create table email_events(id uuid primary key default gen_random_uuid(),outbox_id uuid,to_email text,detail jsonb,provider_event_id text unique);
 create table subscribers(email text,source text,unsubscribed_at timestamptz);
 create table sequence_overrides(email text,sequence text,action text);
 create table cart_sessions(email text,status text,updated_at timestamptz);
 create table reviews(order_id uuid,status text);
 insert into products(id,slug,name) values('10000000-0000-0000-0000-000000000001','sample','Sample');
 insert into product_variants(id,product_id,sku,pack_size,label,price_cents) values('${variant}','10000000-0000-0000-0000-000000000001','SAMPLE',1,'1 vial',1000);`);
 await db.exec(readFileSync('supabase/migrations/20260908100000_commerce_integrity.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20260908120000_outbox_integrity.sql','utf8'));
});
afterAll(async()=>{await db.close()});
beforeEach(async()=>{await db.exec(`truncate orders cascade;truncate email_outbox,stock_movements,inventory;insert into stock_movements(variant_id,qty,reason) values('${variant}',30,'received');`)});
async function create(){return (await db.query<{result:Order}>('select commerce_create_order($1::jsonb) result',[JSON.stringify({email:'buyer@example.test',items:[{variantId:variant,qty:3}],shippingCents:500,paymentExpiryHours:48,discountCode:'WELCOME10'})])).rows[0].result}
async function act(id:string,action:string,options:object={}){return db.query('select commerce_order_operation($1::uuid,$2,$3::jsonb)',[id,action,JSON.stringify(options)])}
async function allowed(id:string){const claim=(await db.query<{lease_token:string}>('select * from claim_email_outbox(1,$1::uuid)',[id])).rows[0];return (await db.query<{allowed:boolean}>('select authorize_email_delivery($1::uuid,$2::uuid) allowed',[id,claim.lease_token])).rows[0].allowed}
it('rolls back order, inventory and events when its durable email insert fails',async()=>{
 await db.exec(`create function test_reject_outbox() returns trigger language plpgsql as $$ begin raise exception 'injected outbox failure';end $$;create trigger test_reject_outbox before insert on email_outbox for each row execute function test_reject_outbox();`);
 try {await expect(create()).rejects.toThrow('injected outbox failure')} finally{await db.exec('drop trigger test_reject_outbox on email_outbox;drop function test_reject_outbox();')}
 expect((await db.query('select count(*)::int n from orders')).rows[0]).toEqual({n:0});expect((await db.query('select reserved from inventory')).rows[0]).toEqual({reserved:0});
});
it('emits one payment confirmation and discounted shipping-inclusive refund deltas',async()=>{
 const o=await create();await act(o.orderId,'paid');await act(o.orderId,'paid');
 const item=(await db.query<{id:string}>('select id from order_items')).rows[0];
 await act(o.orderId,'refund_items',{refunds:[{itemId:item.id,qty:1}]});await act(o.orderId,'refunded');
 const emails=(await db.query<{template:string;payload:{amount_cents:number}}>('select template,payload from email_outbox order by created_at,id')).rows;
 expect(emails.filter(e=>e.template==='order_confirmation')).toHaveLength(1);
 expect(emails.filter(e=>e.template==='order_refunded').map(e=>e.payload.amount_cents).sort((a,b)=>a-b)).toEqual([900,2300]);
});
it('rejects queued instructions for an old total after a pending edit',async()=>{
 const o=await create();const old=(await db.query<{id:string}>("select id from email_outbox where template='payment_instructions'")).rows[0];
 const item=(await db.query<{id:string}>('select id from order_items')).rows[0];
 await act(o.orderId,'edit_item',{itemId:item.id,qty:4,shippingPolicy:{baseCents:500,freeThresholdCents:10000}});
 expect(await allowed(old.id)).toBe(false);
});
it('enqueues expiry atomically and emits no second message on replay',async()=>{
 const o=await create();await db.exec("update orders set payment_expires_at=now()-interval '1 hour'");await act(o.orderId,'expire');await act(o.orderId,'expire');
 expect((await db.query("select count(*)::int n from email_outbox where template='payment_expired'")).rows[0]).toEqual({n:1});
});
