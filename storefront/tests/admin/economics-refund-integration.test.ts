import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {afterAll,beforeAll,expect,it} from 'vitest';
import {summarizeLines,type EconomicLine} from '@/lib/admin/economics';
let db:PGlite;
const variant='20000000-0000-0000-0000-000000000001';
const rpc=async<T>(sql:string,args:unknown[]=[]) => (await db.query<{r:T}>(`select ${sql} r`,args)).rows[0].r;
beforeAll(async()=>{
 db=new PGlite();await db.exec('create role service_role;create role anon;create role authenticated;');
 await db.exec(readFileSync('supabase/migrations/20260724110000_commerce.sql','utf8'));
 await db.exec(`alter table order_items add refunded_qty int not null default 0,add refunded_cents int not null default 0,add unit_cost_cents int;alter table orders add refunded_cents int not null default 0,add payment_reference text,add payment_expires_at timestamptz;alter table products add unit_cost_cents int;alter table order_events drop constraint order_events_type_check;create table admin_audit_log(actor_email text,action text,entity_type text,entity_id text,diff jsonb);`);
 for(const name of ['20260908100000_commerce_integrity.sql','20260908180000_refund_workflow.sql','20260913110000_order_economics.sql'])await db.exec(readFileSync(`supabase/migrations/${name}`,'utf8'));
 await db.exec(`insert into products(id,slug,name,unit_cost_cents) values('10000000-0000-0000-0000-000000000001','sample','Sample',600);insert into product_variants(id,product_id,sku,pack_size,label,price_cents) values('${variant}','10000000-0000-0000-0000-000000000001','SINGLE',1,'1 vial',1000);insert into stock_movements(variant_id,qty,reason) values('${variant}',30,'received');`);
});
afterAll(async()=>{await db.close();});
it('reconciles discount, no-restock refund, restocked refund and replay without double counting COGS or settlements',async()=>{
 const o=await rpc<{orderId:string}>('commerce_create_order($1::jsonb)',[JSON.stringify({email:'buyer@example.test',items:[{variantId:variant,qty:3}],discountCode:'WELCOME10',shippingCents:500})]);
 await rpc('commerce_order_operation($1::uuid,$2,$3::jsonb)',[o.orderId,'paid','{}']);
 const getLines=async()=> (await db.query<EconomicLine>('select * from admin_order_item_economics where order_id=$1',[o.orderId])).rows;
 expect(summarizeLines(await getLines())).toMatchObject({revenueCents:2700,cogsCents:1800,profitCents:900});
 const item=(await db.query<{id:string}>('select id from order_items where order_id=$1',[o.orderId])).rows[0].id;
 for(const [restock,key] of [[false,'no-return'],[true,'physical-return']] as const) {
  const selection=JSON.stringify([{itemId:item,qty:1}]);
  const q=await rpc<{token:string}>('commerce_refund_quote($1::uuid,$2::jsonb,$3)',[o.orderId,selection,restock]);
  const args=[o.orderId,selection,restock,q.token,key,'admin@example.test'];
  await rpc('commerce_refund_commit($1::uuid,$2::jsonb,$3,$4::uuid,$5,$6)',args);
  await rpc('commerce_refund_commit($1::uuid,$2::jsonb,$3,$4::uuid,$5,$6)',args);
 }
 expect(summarizeLines(await getLines())).toMatchObject({revenueCents:900,cogsCents:1200,profitCents:-300});
 await rpc('commerce_refund_settle($1::uuid,1800,$2,current_date,$3,$4)',[o.orderId,'BANK-TEST','settled','admin@example.test']);
 expect(summarizeLines(await getLines())).toMatchObject({revenueCents:900,cogsCents:1200,profitCents:-300});
});
