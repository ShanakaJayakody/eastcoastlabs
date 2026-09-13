import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
let db: PGlite;
beforeAll(async () => {
 db = new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role;
 create table products(id uuid primary key,slug text,name text,short_description text,description text,seo_title text,seo_description text,status text,updated_at timestamptz,unit_cost_cents integer);
 create table product_variants(id uuid primary key,product_id uuid references products(id),price_cents integer, pack_size integer);
 create table inventory(variant_id uuid primary key,on_hand integer default 0,reserved integer default 0,low_stock_threshold integer,updated_at timestamptz);
 create table settings(key text primary key,value jsonb,updated_at timestamptz,updated_by text);
 create table admin_audit_log(actor_email text,action text,entity_type text,entity_id text,diff jsonb);
 create table orders(id uuid primary key,customer_email text,customer_name text,status text,total_cents integer,refunded_cents integer default 0,paid_at timestamptz,created_at timestamptz default now(),stock_settled boolean default false);
 create view customers as select customer_email email,max(customer_name) name,count(*) orders_count,sum(total_cents) ltv_cents,min(created_at) first_order_at,max(created_at) last_order_at from orders group by customer_email;
 create table cart_sessions(email text,subtotal_cents integer,reminder_stage integer,updated_at timestamptz,status text);
 create table subscribers(email text,unsubscribed_at timestamptz);
 create table coa_batches(id uuid, pdf_url text);
 create table stock_movements(id uuid primary key default gen_random_uuid(),variant_id uuid,qty integer,reason text,actor_email text,note text,unit_cost_cents integer,created_at timestamptz default now());
 create function apply_stock_movement() returns trigger language plpgsql as $$begin update inventory set on_hand=on_hand+new.qty where variant_id=new.variant_id;return new;end $$;
 create trigger apply_stock after insert on stock_movements for each row execute function apply_stock_movement();
 insert into products(id,slug,name,status) values('00000000-0000-0000-0000-000000000001','test','Before','draft');
 insert into product_variants values('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',100,1);
 insert into inventory(variant_id,low_stock_threshold) values('00000000-0000-0000-0000-000000000002',5);`);
 const path = 'supabase/migrations/20260908110000_admin_integrity.sql';
 try { await db.exec(readFileSync(path,'utf8')); } catch(e) { if (!(e instanceof Error && e.message.includes('ENOENT'))) throw e; }
 await db.exec(readFileSync('supabase/migrations/20260913130000_public_business_settings.sql','utf8'));
});


afterAll(async()=>{await db.close();});
describe('atomic admin writes',()=>{
 it('a bad middle variant rolls back product and earlier prices',async()=>{
  const variants = JSON.stringify([{id:'00000000-0000-0000-0000-000000000002',price_cents:200,threshold:3},{id:'00000000-0000-0000-0000-000000000099',price_cents:300,threshold:3}]);
  await expect(db.query(`select admin_save_product('test','{"name":"After"}', $1::jsonb,0,'operator')`,[variants])).rejects.toThrow(/variant/i);
  expect((await db.query<{name:string}>('select name from products')).rows[0].name).toBe('Before');
  expect((await db.query<{price_cents:number}>('select price_cents from product_variants')).rows[0].price_cents).toBe(100);
 });
 it('saves all product fields once and rejects stale editors',async()=>{
  await db.query(`select admin_save_product('test','{"name":"After"}','[{"id":"00000000-0000-0000-0000-000000000002","price_cents":200,"threshold":3}]',0,'operator')`);
  expect((await db.query<{name:string}>('select name from products')).rows[0].name).toBe('After');
  await expect(db.query(`select admin_save_product('test','{"name":"Stale"}','[]',0,'operator')`)).rejects.toThrow(/changed/i);
 });
 it('settings save rolls back if any key invalid, then rejects stale revision',async()=>{
  await expect(db.query(`select admin_save_settings('{"support_email":"valid@test.local","standard_shipping_cents":-1}',0,'operator')`)).rejects.toThrow(/shipping/i);
  expect((await db.query('select * from settings')).rows).toHaveLength(0);
  await db.query(`select admin_save_settings('{"support_email":"valid@test.local","standard_shipping_cents":0}',0,'operator')`);
  await expect(db.query(`select admin_save_settings('{"support_email":"stale@test.local"}',0,'operator')`)).rejects.toThrow(/changed/i);
 });
});

it('reversing the latest receipt restores quantity and weighted valuation, but never rewinds later movements',async()=>{
 await db.exec("update inventory set on_hand=10;update products set unit_cost_cents=100;");
 const {rows}=await db.query<{result:{receipt_id:string}}>(`select admin_receive_stock('00000000-0000-0000-0000-000000000002',10,300,'operator','receipt') as result`);
 expect((await db.query<{unit_cost_cents:number}>('select unit_cost_cents from products')).rows[0].unit_cost_cents).toBe(200);
 await db.query("select admin_reverse_receipt($1,'operator')",[rows[0].result.receipt_id]);
 expect((await db.query<{on_hand:number}>('select on_hand from inventory')).rows[0].on_hand).toBe(10);
 expect((await db.query<{unit_cost_cents:number}>('select unit_cost_cents from products')).rows[0].unit_cost_cents).toBe(100);
 const second=await db.query<{result:{receipt_id:string}}>(`select admin_receive_stock('00000000-0000-0000-0000-000000000002',10,300,'operator','receipt') as result`);
 await db.exec("insert into stock_movements(variant_id,qty,reason) values('00000000-0000-0000-0000-000000000002',-1,'sale')");
 await expect(db.query("select admin_reverse_receipt($1,'operator')",[second.rows[0].result.receipt_id])).rejects.toThrow(/later stock/i);
});

it('People database projection searches and counts beyond 1000 before stable pagination',async()=>{
 await db.exec("insert into orders(id,customer_email,customer_name,status,total_cents,paid_at) select md5(i::text)::uuid,'person'||lpad(i::text,4,'0')||'@test.local','Person '||i,'paid',100,now() from generate_series(1,1007) i;");
 expect((await db.query<{count:number}>('select count(*)::int as count from admin_people')).rows[0].count).toBe(1007);
 expect((await db.query<{email:string}>("select email from admin_people where email ilike '%person1007%' and 'one_time'=any(segments)")).rows[0].email).toBe('person1007@test.local');
 expect((await db.query<{email:string}>('select email from admin_people order by "ltvCents" desc,email offset 1000 limit 50')).rows).toHaveLength(7);
});

it('People counts actual paid orders and nets partial/full refunds without treating pending checkout as purchase',async()=>{
 await db.exec(`insert into orders(id,customer_email,status,total_cents,refunded_cents,paid_at) values
 ('00000000-0000-0000-0000-000000000901','pending@test.local','pending',1000,0,null),
 ('00000000-0000-0000-0000-000000000902','partial@test.local','paid',1000,250,now()),
 ('00000000-0000-0000-0000-000000000903','full@test.local','refunded',1000,1000,now());`);
 const result=await db.query<{email:string;orders_count:number;ltv_cents:number;last_order_at:string|null}>("select email,orders_count::int,ltv_cents::int,last_order_at from customers where email in ('pending@test.local','partial@test.local','full@test.local') order by email");
 expect(result.rows.find(r=>r.email==='pending@test.local')).toMatchObject({orders_count:0,ltv_cents:0,last_order_at:null});
 expect(result.rows.find(r=>r.email==='partial@test.local')).toMatchObject({orders_count:1,ltv_cents:750});
 expect(result.rows.find(r=>r.email==='full@test.local')).toMatchObject({orders_count:1,ltv_cents:0});
});

it('saves public business facts atomically and rejects invalid profile fields and stale revisions',async()=>{
 const revision=(await db.query<{version:number}>('select version from settings_revision')).rows[0].version;
 await db.query('select admin_save_settings($1::jsonb,$2,$3)',[JSON.stringify({legal_name:'Example Pty Ltd',abn:'51824753556',public_address:''}),revision,'operator']);
 expect((await db.query<{value:string}>("select value from settings where key='legal_name'")).rows[0].value).toBe('Example Pty Ltd');
 await expect(db.query('select admin_save_settings($1::jsonb,$2,$3)',[JSON.stringify({abn:'invalid'}),Number(revision)+1,'operator'])).rejects.toThrow(/ABN/i);
 await expect(db.query('select admin_save_settings($1::jsonb,$2,$3)',[JSON.stringify({abn:'00000000000'}),Number(revision)+1,'operator'])).rejects.toThrow(/ABN/i);
 await expect(db.query('select admin_save_settings($1::jsonb,$2,$3)',[JSON.stringify({abn:'51824753557'}),Number(revision)+1,'operator'])).rejects.toThrow(/ABN/i);
 expect((await db.query<{value:string}>("select value from settings where key='abn'")).rows[0].value).toBe('51824753556');
 expect((await db.query<{version:number}>('select version from settings_revision')).rows[0].version).toBe(Number(revision)+1);
 await expect(db.query('select admin_save_settings($1::jsonb,$2,$3)',[JSON.stringify({legal_name:'Stale'}),revision,'operator'])).rejects.toThrow(/changed/i);
 expect((await db.query<{allowed:boolean}>("select has_function_privilege('authenticated','admin_save_settings(jsonb,bigint,text)','execute') allowed")).rows[0].allowed).toBe(false);
});
