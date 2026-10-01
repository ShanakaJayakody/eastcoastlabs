import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {beforeAll,afterAll,beforeEach,afterEach,it,expect} from 'vitest';
import type {OrderWorkspacePage} from '@/lib/admin/order-workspace/types';
let db:PGlite;const at='2026-10-05T04:00:00Z';
beforeAll(async()=>{db=new PGlite();await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema storage;create table storage.buckets(id text primary key,name text,public boolean)');for(const f of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(`supabase/migrations/${f}`,'utf8'));});
afterAll(()=>db.close());beforeEach(()=>db.exec('begin'));afterEach(()=>db.exec('rollback'));
async function workspace(filters:Record<string,unknown>={},exp=false){return (await db.query<{r:OrderWorkspacePage}>(`select ${exp?'admin_order_workspace_export':'admin_order_workspace'}($1::jsonb,$2) r`,[JSON.stringify({status:'all',sort:'created_at',dir:'desc',page:1,shipping:'any',...filters}),at])).rows[0].r;}
async function order(status='pending',fields:Record<string,unknown>={}){
 const values={customer_email:'sample@example.test',status,created_at:'2026-10-01T00:00:00Z',shipping_address:JSON.stringify({line1:'12 Sample Street',suburb:'Melbourne',state:'VIC',postcode:'3000'}),...fields};
 return (await db.query<{id:string}>(`insert into orders(${Object.keys(values).join(',')}) values(${Object.keys(values).map((_,i)=>`$${i+1}`).join(',')}) returning id`,Object.values(values))).rows[0].id;
}
async function item(orderId:string,qty=1,refunded=0){return (await db.query<{id:string}>("insert into order_items(order_id,product_name,variant_label,sku,qty,refunded_qty,unit_price_cents,line_total_cents) values($1,'Historical sample','3-pack · 10 mg','HIST-SKU',$2,$3,1000,1000*$2) returning id",[orderId,qty,refunded])).rows[0].id;}
async function pool(slug:string){const p=(await db.query<{id:string}>('insert into products(slug,name) values($1,$1) returning id',[slug])).rows[0].id;return (await db.query<{id:string}>("insert into product_variants(product_id,sku,pack_size,label,price_cents) values($1,$2,1,'single',1000) returning id",[p,slug])).rows[0].id;}
it('uses frozen claims, including accessories and refunds, without multiplying joins',async()=>{
 const id=await order('paid',{order_number:'WORKSPACE-PACKS',paid_at:'2026-10-01T01:00Z'}), a=await item(id,2,1),b=await item(id),p=await pool('primary'),extra=await pool('accessory');
 await db.query('insert into order_stock_claims values($1,$2,3),($3,$4,1)',[a,p,b,extra]);
 expect((await workspace({status:'to_fulfil'})).rows[0]).toMatchObject({line_count:2,ordered_physical_units:7,remaining_physical_units:4,issue_keys:[]});
 await db.query('update product_variants set pack_size=6 where id=$1',[p]);
 expect((await workspace()).rows[0].ordered_physical_units).toBe(7);
});
it('returns null quantities for missing claim coverage and objective attention only',async()=>{
 const id=await order('paid',{paid_at:'2026-09-01',created_at:'2026-08-01'});await item(id);
 expect((await workspace({status:'needs_attention'})).rows[0]).toMatchObject({ordered_physical_units:null,remaining_physical_units:null,issue_keys:['quantity_unknown']});
 const p=await pool('covered');await db.query('insert into order_stock_claims select id,$2,1 from order_items where order_id=$1',[id,p]);
 expect((await workspace({status:'needs_attention'})).total).toBe(0);
});
it('keeps counts and single-statement export in the same literal search/filter scope',async()=>{
 await order('pending',{payment_ref:'ref(1),20%_',discount_code:'VIP_20',shipping_address:JSON.stringify({shipping_method:'express'}),order_number:'WORKSPACE-LITERAL'});
 await order('paid',{payment_ref:'ref(1),20ZZ',discount_code:'VIP_20',paid_at:'2026-10-01'});
 const filters={q:'ref(1),20%_',discount:'vip_20',shipping:'express',from_at:'2026-09-30T14:00Z',to_at:'2026-10-01T14:00Z'};
 const result=await workspace(filters);expect(result.total).toBe(1);expect(result.counts).toMatchObject({pending:1,paid:0,all:1});
 expect((await workspace(filters,true)).rows.map(r=>r.id)).toEqual(result.rows.map(r=>r.id));
});
it('searches every historical item but returns at most three summaries',async()=>{
 const id=await order();for(let i=0;i<4;i++)await item(id);
 await db.query("update order_items set sku='fourth-needle' where id=(select max(id::text)::uuid from order_items where order_id=$1)",[id]);
 const r=await workspace({q:'fourth-needle'});expect(r.total).toBe(1);expect(r.rows[0].items).toHaveLength(3);expect(r.rows[0].line_count).toBe(4);
});
it('paginates over 1000 orders and clamps pages without corrupting counts',async()=>{
 await db.exec("insert into orders(customer_email,status,created_at) select 'workspace-bulk@example.test','pending','2026-10-01' from generate_series(1,1005)");
 const a=await workspace({status:'pending',q:'workspace-bulk',page:1}),b=await workspace({status:'pending',q:'workspace-bulk',page:999});
 expect(a.total).toBe(1005);expect(a.counts.pending).toBe(1005);expect(a.rows).toHaveLength(25);expect(b.page).toBe(41);expect(b.rows).toHaveLength(5);
 expect(new Set([...a.rows,...b.rows].map(r=>r.id)).size).toBe(30);
});
it('uses elapsed hours across DST and keeps null payment times last both ways',async()=>{
 await order('paid',{created_at:'2026-10-03T13:00Z',paid_at:'2026-10-03T14:00Z'});await order('paid');
 for(const dir of ['asc','desc']){const r=await workspace({status:'to_fulfil',sort:'paid_at',dir});expect(r.rows[1].paid_at).toBeNull();expect(r.rows[0].waiting_seconds).toBe(136800);}
});
it('reports address, timing, tracking and unsettled-refund issues separately',async()=>{
 await order('shipped',{refunded_cents:1000,shipped_at:'2026-10-02',shipping_address:null});
 const r=(await workspace({status:'needs_attention'})).rows[0];expect(r.issue_keys).toEqual(['timing_incomplete','tracking_missing','refund_transfer_pending']);
 await order('paid',{shipping_address:JSON.stringify({line1:' ',city:'Melbourne',state:'VIC',postcode:'3000'}),paid_at:'2026-10-01'});
 expect((await workspace()).rows.some(r=>r.issue_keys.includes('address_incomplete'))).toBe(true);
});
it('denies public roles and makes no write side effects',async()=>{
 await order();const before=(await db.query('select (select count(*) from order_events) events,(select count(*) from email_outbox) mail')).rows;
 for(const role of ['anon','authenticated']){await db.exec(`savepoint acl;set role ${role}`);await expect(workspace()).rejects.toThrow(/permission denied/i);await db.exec('rollback to savepoint acl;reset role');}
 await db.exec('set role service_role');expect((await workspace()).total).toBe(1);await db.exec('reset role');
 expect((await db.query('select (select count(*) from order_events) events,(select count(*) from email_outbox) mail')).rows).toEqual(before);
 const functions=await db.query<{name:string}> ("select oid::regprocedure::text name from pg_proc where proname like 'admin_order_workspace%'");
 for(const f of functions.rows)expect((await db.query<{allowed:boolean}>("select has_function_privilege('anon',$1,'execute') allowed",[f.name])).rows[0].allowed).toBe(false);
});
it('refuses oversize exports rather than truncating',async()=>{
 await db.exec("insert into orders(customer_email,created_at) select 'large@example.test','2026-10-01' from generate_series(1,20001)");
 await expect(workspace({},true)).rejects.toThrow(/ORDER_EXPORT_TOO_LARGE/);
});
it('rejects invalid SQL filter enums and pages',async()=>{
 for(const filters of [{status:'evil'},{shipping:'evil'},{sort:'evil'},{dir:'sideways'},{page:0},{from_at:'2026-10-03',to_at:'2026-10-01'}]){await db.exec('savepoint invalid');await expect(workspace(filters)).rejects.toThrow(/invalid/i);await db.exec('rollback to savepoint invalid');}
});
it('aggregates multiple pools on one item and settlement evidence independently',async()=>{
 const id=await order('refunded',{paid_at:'2026-10-01T01:00:00Z',shipped_at:'2026-10-02T00:00:00Z',tracking_number:'TRACK-LITERAL',refunded_cents:1000}),i=await item(id,2,1),p=await pool('one'),a=await pool('two');
 await db.query('insert into order_stock_claims values($1,$2,3),($1,$3,1)',[i,p,a]);
 await db.query("insert into refund_settlements(order_id,amount_cents,transfer_reference,transfer_date,operation_key,actor_email) values($1,1000,'settled','2026-10-03','unique','operator@example.test')",[id]);
 expect((await workspace({q:'TRACK-LITERAL'})).rows[0]).toMatchObject({ordered_physical_units:8,remaining_physical_units:4,refund_settled_cents:1000,issue_keys:[]});
});
it('keeps a deterministic UUID tie break and measures a 10000-order scope',async()=>{
 await db.exec("insert into orders(customer_email,created_at) select 'performance@example.test','2026-10-01' from generate_series(1,10000);analyze orders");
 const result=await workspace();expect(result.total).toBe(10000);expect(result.rows.map(r=>r.id)).toEqual(result.rows.map(r=>r.id).sort());
 writeFileSync('/tmp/ecl-workspace-query-plan.json',JSON.stringify((await db.query("explain (analyze,buffers) select admin_order_workspace('{\"status\":\"all\",\"page\":1}', '2026-10-05T04:00:00Z')")).rows));
 writeFileSync('/tmp/ecl-workspace-item-plan.json',JSON.stringify((await db.query("explain select * from order_items where order_id='00000000-0000-4000-8000-000000000001'")).rows));
});
