import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, beforeEach, expect, it } from 'vitest';
let db:PGlite;
const variant='20000000-0000-0000-0000-000000000001';
type Quote={token:string;itemCents:number;discountCents:number;shippingCents:number;totalCents:number;remainingCents:number};
const rpc=async<T=Record<string,unknown>>(sql:string,args:unknown[]=[]) => (await db.query<{r:T}>(`select ${sql} r`,args)).rows[0].r;
const quote=(id:string,selection:unknown=null,restock=false)=>rpc<Quote>('commerce_refund_quote($1::uuid,$2::jsonb,$3)',[id,JSON.stringify(selection),restock]);
const commit=(id:string,q:Quote,selection:unknown=null,key='refund-1',restock=false)=>rpc('commerce_refund_commit($1::uuid,$2::jsonb,$3,$4::uuid,$5,$6)',[id,JSON.stringify(selection),restock,q.token,key,'operator@example.test']);
const settle=(id:string,cents:number,key='settlement-1',reference='BANK-123')=>rpc('commerce_refund_settle($1::uuid,$2,$3,$4::date,$5,$6)',[id,cents,reference,'2026-01-01',key,'operator@example.test']);
async function order(){const o=await rpc<{orderId:string}>("commerce_create_order($1::jsonb)",[JSON.stringify({email:'buyer@example.test',items:[{variantId:variant,qty:3}],discountCode:'WELCOME10',shippingCents:500})]);await rpc('commerce_order_operation($1::uuid,$2,$3::jsonb)',[o.orderId,'paid','{}']);return o.orderId;}
const item=async()=> (await db.query<{id:string}>('select id from order_items')).rows[0].id;
beforeAll(async()=>{
 db=new PGlite();await db.exec('create role service_role;create role anon;create role authenticated;');
 await db.exec(readFileSync(resolve('supabase/migrations/20260724110000_commerce.sql'),'utf8'));
 await db.exec(`alter table order_items add refunded_qty int not null default 0,add refunded_cents int not null default 0,add unit_cost_cents int;alter table orders add refunded_cents int not null default 0,add payment_reference text,add payment_expires_at timestamptz;alter table products add unit_cost_cents int;alter table order_events drop constraint order_events_type_check;create table admin_audit_log(id uuid primary key default gen_random_uuid(),actor_email text,action text,entity_type text,entity_id text,diff jsonb,created_at timestamptz default now());`);
 await db.exec(readFileSync(resolve('supabase/migrations/20260908100000_commerce_integrity.sql'),'utf8'));
 const path=resolve('supabase/migrations/20260908180000_refund_workflow.sql');if(existsSync(path))await db.exec(readFileSync(path,'utf8'));
});
afterAll(async()=>{await db.close()});
beforeEach(async()=>{await db.exec(`truncate orders cascade;truncate stock_movements,inventory,product_variants,products cascade;insert into products(id,slug,name) values('10000000-0000-0000-0000-000000000001','sample','Sample');insert into product_variants(id,product_id,sku,pack_size,label,price_cents) values('${variant}','10000000-0000-0000-0000-000000000001','SINGLE',1,'1 vial',1000);insert into stock_movements(variant_id,qty,reason) values('${variant}',30,'received');`)});
it('previews discounted partial and final refunds exactly, shipping once, without automatic stock return',async()=>{
 const id=await order(),selection=[{itemId:await item(),qty:1}];const q=await quote(id,selection);
 expect(q).toMatchObject({itemCents:1000,discountCents:100,shippingCents:0,totalCents:900,remainingCents:2300});
 expect(await commit(id,q,selection)).toMatchObject({refundedCents:900,fullyRefunded:false});
 const final=await quote(id);expect(final).toMatchObject({itemCents:2000,discountCents:200,shippingCents:500,totalCents:2300,remainingCents:0});
 await commit(id,final,null,'final');expect((await db.query('select on_hand from inventory')).rows[0]).toEqual({on_hand:27});
 expect((await db.query('select refunded_cents from orders')).rows[0]).toEqual({refunded_cents:3200});
});
it('rejects stale or changed reviews atomically but replays a committed request',async()=>{
 const id=await order(),selection=[{itemId:await item(),qty:1}];const stale=await quote(id),q=await quote(id,selection);
 const results=await Promise.all([commit(id,q,selection),commit(id,q,selection)]);expect(results[0]).toEqual(results[1]);
 await expect(commit(id,stale,null,'stale')).rejects.toThrow(/REFUND_PREVIEW_STALE/);
 await expect(commit(id,q,selection,'refund-1',true)).rejects.toThrow(/IDEMPOTENCY/);
 const fresh=await quote(id);await expect(commit(id,fresh,selection,'changed')).rejects.toThrow(/PREVIEW_SELECTION/);
 expect((await db.query('select count(*)::int n from refund_commits')).rows[0]).toEqual({n:1});
});
it('rejects malformed selections before creating money or stock mutations',async()=>{
 const id=await order(),itemId=await item();
 for(const selection of [[],[{itemId,qty:0}],[{itemId,qty:1.5}],[{itemId,qty:4}],[{itemId,qty:1},{itemId,qty:1}]])await expect(quote(id,selection)).rejects.toThrow();
 expect((await db.query('select refunded_cents from orders')).rows[0]).toEqual({refunded_cents:0});
});
it('settles only recorded refunds with replay, conflict, bounds, and immutable audit evidence',async()=>{
 const id=await order();await expect(settle(id,100)).rejects.toThrow(/exceeds/i);
 await commit(id,await quote(id));
 const first=await settle(id,900);expect(await settle(id,900)).toEqual(first);
 await expect(settle(id,901)).rejects.toThrow(/IDEMPOTENCY/);
 await expect(settle(id,100,'other','BANK-123')).rejects.toThrow(/reference/i);
 const raced=await Promise.allSettled([settle(id,2300,'last','BANK-456'),settle(id,2300,'racer','BANK-789')]);expect(raced.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 expect((await db.query('select sum(amount_cents)::int n from refund_settlements')).rows[0]).toEqual({n:3200});
 await expect(db.exec('update refund_settlements set amount_cents=1')).rejects.toThrow(/immutable/i);
 await expect(db.exec('delete from refund_commits')).rejects.toThrow(/immutable/i);
 expect((await db.query("select count(*)::int n from admin_audit_log where action='order.refund_settlement'")).rows[0]).toEqual({n:2});
});
it('requires real transfer evidence and denies public RPC/table access',async()=>{
 const id=await order();await commit(id,await quote(id));
 await expect(settle(id,0)).rejects.toThrow();await expect(settle(id,100,'key',' ')).rejects.toThrow();
 await expect(rpc('commerce_refund_settle($1::uuid,100,$2,current_date+1,$3,$4)',[id,'REF','future','actor'])).rejects.toThrow();
 for(const name of ['commerce_refund_quote(uuid,jsonb,boolean)','commerce_refund_commit(uuid,jsonb,boolean,uuid,text,text)','commerce_refund_settle(uuid,integer,text,date,text,text)']){
  expect(await rpc('has_function_privilege($1,$2,$3)',['anon',name,'execute'])).toBe(false);
  expect(await rpc('has_function_privilege($1,$2,$3)',['authenticated',name,'execute'])).toBe(false);
  expect(await rpc('has_function_privilege($1,$2,$3)',['service_role',name,'execute'])).toBe(true);
 }
 expect(await rpc("has_table_privilege('anon','refund_settlements','select')")).toBe(false);
});
it('preserves odd discount pennies through three reviewed returns and restores stock only once',async()=>{
 const id=await order();
 // A historical paid three-unit line with a one-cent allocation.
 await db.exec('update orders set discount_cents=1,total_cents=3499;update order_items set discount_allocated_cents=1');
 const selection=[{itemId:await item(),qty:1}];
 const first=await quote(id,selection,true);expect(first).toMatchObject({itemCents:1000,discountCents:0,totalCents:1000});
 await commit(id,first,selection,'one',true);await commit(id,first,selection,'one',true);
 const second=await quote(id,selection,true);expect(second).toMatchObject({discountCents:1,totalCents:999});await commit(id,second,selection,'two',true);
 const last=await quote(id,null,true);expect(last).toMatchObject({discountCents:0,shippingCents:500,totalCents:1500});await commit(id,last,null,'three',true);
 expect((await db.query('select on_hand from inventory')).rows[0]).toEqual({on_hand:30});
 expect((await db.query('select refunded_cents from orders')).rows[0]).toEqual({refunded_cents:3499});
});
it('rolls back the canonical refund and its commit evidence when audit insert fails',async()=>{
 const id=await order(),q=await quote(id,null,true);
 await db.exec("create function reject_refund_audit() returns trigger language plpgsql as $$begin raise exception 'injected audit failure';end $$;create trigger reject_refund_audit before insert on admin_audit_log for each row execute function reject_refund_audit();");
 try{await expect(commit(id,q,null,'rollback',true)).rejects.toThrow('injected audit failure')}finally{await db.exec('drop trigger reject_refund_audit on admin_audit_log;drop function reject_refund_audit()')}
 expect((await db.query('select refunded_cents from orders')).rows[0]).toEqual({refunded_cents:0});
 expect((await db.query('select on_hand from inventory')).rows[0]).toEqual({on_hand:27});
 expect((await db.query('select count(*)::int n from refund_commits')).rows[0]).toEqual({n:0});
 await commit(id,q,null,'rollback',true);
});
