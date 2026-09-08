import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll,afterAll,beforeEach,it,expect } from 'vitest';
let db:PGlite;
const pool='20000000-0000-0000-0000-000000000001', pack='20000000-0000-0000-0000-000000000002';
const rpc=async<T=Record<string,unknown>>(sql:string,args:unknown[]=[]) => (await db.query<{r:T}>(`select ${sql} r`,args)).rows[0].r;
async function order(qty=1){const o=await rpc<{orderId:string}>('commerce_create_order($1::jsonb)',[JSON.stringify({email:'buyer@example.test',shippingCents:0,items:[{variantId:pack,qty}]})]);await rpc('commerce_order_operation($1::uuid,$2,$3::jsonb)',[o.orderId,'paid','{}']);return {id:o.orderId,item:(await db.query<{id:string}>('select id from order_items where order_id=$1',[o.orderId])).rows[0].id};}
const lot=(code='LOT-A',units=6,receipt:string|null=null,coa:string|null=null)=>rpc<string>('admin_register_stock_lot($1::uuid,$2,$3,$4::uuid,$5::uuid,$6,$7)',[pool,code,units,receipt,coa,'Physical count and supplier label checked','operator']);
const assign=(o:{id:string;item:string},lots:unknown)=>rpc('admin_allocate_order_lots($1::uuid,$2::uuid,$3::uuid,$4::jsonb,$5,$6)',[o.id,o.item,pool,JSON.stringify(lots),'Physical picking verified','operator']);
beforeAll(async()=>{
 db=new PGlite();await db.exec('create role service_role;create role anon;create role authenticated;');
 await db.exec(readFileSync(resolve('supabase/migrations/20260724110000_commerce.sql'),'utf8'));
 await db.exec(`alter table order_items add refunded_qty int not null default 0,add refunded_cents int not null default 0,add unit_cost_cents int;alter table orders add refunded_cents int not null default 0,add payment_reference text,add payment_expires_at timestamptz;alter table products add unit_cost_cents int;alter table stock_movements add reverses_receipt_id uuid;alter table order_events drop constraint order_events_type_check;create table admin_audit_log(id uuid primary key default gen_random_uuid(),actor_email text,action text,entity_type text,entity_id text,diff jsonb,created_at timestamptz default now());create table coa_batches(id uuid primary key default gen_random_uuid(),batch_id text,compound text,coa_url text,document_verified_at timestamptz);`);
 await db.exec(readFileSync(resolve('supabase/migrations/20260908100000_commerce_integrity.sql'),'utf8'));
 const path=resolve('supabase/migrations/20260908190000_fulfilment_workflows.sql');if(existsSync(path))await db.exec(readFileSync(path,'utf8'));
});
afterAll(async()=>{await db.close()});
beforeEach(async()=>{await db.exec(`truncate orders cascade;truncate stock_movements,inventory,product_variants,products cascade;truncate coa_batches cascade;insert into products(id,slug,name) values('10000000-0000-0000-0000-000000000001','sample','Sample');insert into product_variants(id,product_id,sku,pack_size,label,price_cents) values('${pool}','10000000-0000-0000-0000-000000000001','SINGLE',1,'1 vial',1000),('${pack}','10000000-0000-0000-0000-000000000001','PACK',3,'3 vials',2700);insert into stock_movements(variant_id,qty,reason) values('${pool}',30,'received');`)});
it('registers evidenced existing units without adding stock; rejects excess, reused receipts and unverified certificates',async()=>{
 const receipt=(await db.query<{id:string}>('select id from stock_movements')).rows[0].id;
 await lot('A',20,receipt);await expect(lot('B',11,receipt)).rejects.toThrow(/receipt|physical/i);
 await lot('B',10);await expect(lot('C',1)).rejects.toThrow(/physical/i);
 expect((await db.query('select on_hand from inventory where variant_id=$1',[pool])).rows[0]).toEqual({on_hand:30});
 const c=(await db.query<{id:string}>("insert into coa_batches(batch_id,compound,coa_url) values('A','Sample','https://example.test/a.pdf') returning id")).rows[0].id;
 await expect(lot('UNVERIFIED',1,null,c)).rejects.toThrow(/verified/i);
});
it('serializes competing assignments, counts pack units and rejects foreign pools',async()=>{
 const a=await order(2),b=await order(2),l=await lot();
 const races=await Promise.allSettled([assign(a,[{lotId:l,units:6}]),assign(b,[{lotId:l,units:6}])]);expect(races.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 expect((await db.query('select sum(units)::int n from order_lot_allocations')).rows[0]).toEqual({n:6});
 await expect(assign(b,[{lotId:l,units:7}])).rejects.toThrow(/packable|remaining/i);
 await expect(rpc('admin_allocate_order_lots($1::uuid,$2::uuid,$3::uuid,$4::jsonb,$5,$6)',[a.id,a.item,pack,JSON.stringify([{lotId:l,units:1}]),'checked','actor'])).rejects.toThrow(/pool/i);
});
it('preserves evidence after refund, requires physical release and freezes shipped assignments',async()=>{
 const o=await order(2),l=await lot();await assign(o,[{lotId:l,units:6}]);
 await rpc('commerce_order_operation($1::uuid,$2,$3::jsonb)',[o.id,'refund_items',JSON.stringify({refunds:[{itemId:o.item,qty:1}],restock:false})]);
 await expect(assign(o,[{lotId:l,units:6}])).rejects.toThrow(/packable/i);
 await expect(rpc('commerce_order_operation($1::uuid,$2,$3::jsonb)',[o.id,'shipped','{}'])).rejects.toThrow(/allocation/i);
 await assign(o,[{lotId:l,units:3}]);await rpc('commerce_order_operation($1::uuid,$2,$3::jsonb)',[o.id,'shipped','{}']);
 await expect(assign(o,[])).rejects.toThrow(/shipped|dispatch/i);
});
it('carrier commits reject stale previews and return independent outcomes, using canonical tracking events',async()=>{
 const a=await order(),b=await order();const rows=(await db.query<{order_number:string}>('select order_number from orders order by created_at,id')).rows;
 const p=await rpc<Array<{token:string;orderNumber:string;status:string;error?:string}>>('admin_preview_carrier($1::jsonb)',[JSON.stringify(rows.map((r,i)=>({orderNumber:r.order_number,trackingNumber:`TRACK${i}`})))]);
 expect(p.every(r=>r.token&&r.status==='paid')).toBe(true);
 await rpc('commerce_order_operation($1::uuid,$2,$3::jsonb)',[a.id,'processing','{}']);
 const result=await rpc<Array<{ok:boolean;error?:string}>>('admin_commit_carrier($1::jsonb,$2,$3)',[JSON.stringify(p.map(r=>r.token)),false,'operator']);
 expect(result.filter(r=>r.ok)).toHaveLength(1);expect(result.find(r=>!r.ok)?.error).toMatch(/STALE/);
 expect((await db.query('select status from orders where id=$1',[b.id])).rows[0]).toEqual({status:'shipped'});
 const done=p.find((_,i)=>result[i].ok)!;expect(await rpc('admin_commit_carrier($1::jsonb,$2,$3)',[JSON.stringify([done.token]),false,'operator'])).toMatchObject([{ok:true,replayed:true}]);
});
it('rejects duplicate/conflicting carrier rows and denies public RPC access',async()=>{
 const o=await order();const n=await rpc<string>('(select order_number from orders where id=$1)',[o.id]);
 const p=await rpc<Array<{error:string}>>('admin_preview_carrier($1::jsonb)',[JSON.stringify([{orderNumber:n,trackingNumber:'T'},{orderNumber:n,trackingNumber:'OTHER'}])]);expect(p.every(r=>/duplicate/i.test(r.error))).toBe(true);
 for(const name of ['admin_register_stock_lot(uuid,text,integer,uuid,uuid,text,text)','admin_allocate_order_lots(uuid,uuid,uuid,jsonb,text,text)','admin_preview_carrier(jsonb)','admin_commit_carrier(jsonb,boolean,text)'])expect(await rpc('has_function_privilege($1,$2,$3)',['anon',name,'execute'])).toBe(false);
});
it('rejects manual tracking conflicts too, and emits optional durable notification intent only once',async()=>{
 const a=await order(),b=await order();
 await db.exec(`create table email_outbox(id uuid primary key default gen_random_uuid(),to_email text,template text,payload jsonb,related_type text,related_id text,unique(to_email,template,related_id));create trigger commerce_email_intent after insert on commerce_events for each row execute function enqueue_commerce_email();`);
 try {
  for(const [o,notify,tracking] of [[a,false,'ONE'],[b,true,'TWO']] as const){
   const n=await rpc<string>('(select order_number from orders where id=$1)',[o.id]);
   const p=await rpc<Array<{token:string}>>('admin_preview_carrier($1::jsonb)',[JSON.stringify([{orderNumber:n,trackingNumber:tracking}])]);
   await rpc('admin_commit_carrier($1::jsonb,$2,$3)',[JSON.stringify([p[0].token]),notify,'operator']);
   await rpc('admin_commit_carrier($1::jsonb,$2,$3)',[JSON.stringify([p[0].token]),notify,'operator']);
  }
  expect((await db.query('select count(*)::int n from email_outbox')).rows[0]).toEqual({n:1});
  await expect(rpc('commerce_order_operation($1::uuid,$2,$3::jsonb)',[b.id,'tracking',JSON.stringify({trackingNumber:'ONE'})])).rejects.toThrow(/another order/i);
 }finally{await db.exec('drop trigger commerce_email_intent on commerce_events;drop table email_outbox')}
});
it('prints explicit pool units, real assignments, verified certificate and missing allocation',async()=>{
 const o=await order(2);const c=(await db.query<{id:string}>("insert into coa_batches(batch_id,compound,coa_url,document_verified_at) values('CERT-A','Sample','https://example.test/a.pdf',now()) returning id")).rows[0].id;
 const l=await lot('PHYSICAL-A',6,null,c);await assign(o,[{lotId:l,units:2}]);
 const detail=await rpc<{lines:Array<{requiredUnits:number;unallocatedUnits:number;allocations:Array<{lotCode:string;units:number;coa:{batchId:string;url:string}|null}>}>}>('admin_order_fulfilment($1::uuid)',[o.id]);
 expect(detail.lines[0]).toMatchObject({requiredUnits:6,unallocatedUnits:4,allocations:[{lotCode:'PHYSICAL-A',units:2,coa:{batchId:'CERT-A',url:'https://example.test/a.pdf'}}]});
});
it('rejects a verified wrong-compound certificate and reversal of a registered receipt',async()=>{
 const c=(await db.query<{id:string}>("insert into coa_batches(batch_id,compound,coa_url,document_verified_at) values('WRONG','Other','https://example.test/a.pdf',now()) returning id")).rows[0].id;
 await expect(lot('A',3,null,c)).rejects.toThrow(/match.*compound/i);
 const receipt=(await db.query<{id:string}>('select id from stock_movements')).rows[0].id;await lot('A',3,receipt);
 await expect(db.query("insert into stock_movements(variant_id,qty,reason,reverses_receipt_id) values($1,-30,'recount',$2)",[pool,receipt])).rejects.toThrow(/registered lots/i);
 expect((await db.query('select on_hand from inventory where variant_id=$1',[pool])).rows[0]).toEqual({on_hand:30});
});
it('cancellation keeps evidence until explicit physical release, and a failed audit rolls back allocation',async()=>{
 const o=await order(),l=await lot();await assign(o,[{lotId:l,units:3}]);
 await db.exec("create function reject_lot_audit() returns trigger language plpgsql as $$begin raise exception 'injected audit failure';end $$;create trigger reject_lot_audit before insert on admin_audit_log for each row execute function reject_lot_audit();");
 try{await expect(assign(o,[])).rejects.toThrow('injected audit failure')}finally{await db.exec('drop trigger reject_lot_audit on admin_audit_log;drop function reject_lot_audit()')}
 expect((await db.query('select sum(units)::int n from order_lot_allocations')).rows[0]).toEqual({n:3});
 await rpc('commerce_order_operation($1::uuid,$2,$3::jsonb)',[o.id,'cancelled','{}']);
 expect((await db.query('select sum(units)::int n from order_lot_allocations')).rows[0]).toEqual({n:3});await expect(assign(o,[{lotId:l,units:1}])).rejects.toThrow(/packable/i);
 await assign(o,[]);expect((await db.query('select count(*)::int n from order_lot_allocations')).rows[0]).toEqual({n:0});
});
it('rechecks shipped tracking previews and rolls back a failed notification per row',async()=>{
 const a=await order(),b=await order();await rpc('commerce_order_operation($1::uuid,$2,$3::jsonb)',[a.id,'shipped','{}']);
 const numbers=(await db.query<{id:string;order_number:string}>('select id,order_number from orders')).rows;
 const preview=await rpc<Array<{token:string;orderNumber:string}>>('admin_preview_carrier($1::jsonb)',[JSON.stringify(numbers.map(o=>({orderNumber:o.order_number,trackingNumber:o.id===a.id?'A':'B'})))]);
 await rpc('commerce_order_operation($1::uuid,$2,$3::jsonb)',[a.id,'tracking',JSON.stringify({trackingNumber:'MANUAL'})]);
 await db.exec(`create table email_outbox(id uuid primary key default gen_random_uuid(),to_email text,template text,payload jsonb,related_type text,related_id text,unique(to_email,template,related_id),check(template<>'order_shipped'));create trigger commerce_email_intent after insert on commerce_events for each row execute function enqueue_commerce_email();`);
 try{
  const results=await rpc<Array<{ok:boolean}>>('admin_commit_carrier($1::jsonb,$2,$3)',[JSON.stringify(preview.map(r=>r.token)),true,'operator']);expect(results.every(r=>!r.ok)).toBe(true);
  expect((await db.query('select status,tracking_number from orders where id=$1',[b.id])).rows[0]).toEqual({status:'paid',tracking_number:null});
  expect((await db.query('select count(*)::int n from carrier_previews where committed_at is not null')).rows[0]).toEqual({n:0});
 }finally{await db.exec('drop trigger commerce_email_intent on commerce_events;drop table email_outbox')}
});
it('does not silently replace a lot certificate when the published certificate is edited',async()=>{
 const o=await order();const c=(await db.query<{id:string}>("insert into coa_batches(batch_id,compound,coa_url,document_verified_at) values('CERT-A','Sample','https://example.test/a.pdf',now()) returning id")).rows[0].id;
 const l=await lot('A',3,null,c);await assign(o,[{lotId:l,units:3}]);await db.query("update coa_batches set coa_url='https://example.test/replacement.pdf' where id=$1",[c]);
 const detail=await rpc<{lines:Array<{allocations:Array<{coa:unknown}>}>}>('admin_order_fulfilment($1::uuid)',[o.id]);expect(detail.lines[0].allocations[0].coa).toBeNull();
});
