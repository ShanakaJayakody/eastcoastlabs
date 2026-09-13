import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,expect,it} from 'vitest';
let db:PGlite;
const order='00000000-0000-0000-0000-000000000001',item='00000000-0000-0000-0000-000000000002';
beforeAll(async()=>{db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;
create table orders(id uuid primary key,status text,paid_at timestamptz);
create table order_items(id uuid primary key,order_id uuid,qty int,refunded_qty int,returned_qty int,discount_allocated_cents int,line_total_cents int,refunded_cents int,unit_cost_cents int,product_slug text,product_name text);
create table refund_quotes(token uuid primary key,restock boolean,quote jsonb);
create table refund_commits(id uuid primary key,order_id uuid,quote_token uuid unique);
create table admin_audit_log(actor_email text,action text,entity_type text,entity_id text,diff jsonb);
insert into orders values('${order}','refunded',now());
insert into order_items values('${item}','${order}',2,2,2,1500,15000,13500,4750,'test','Test');`);
try{await db.exec(readFileSync('supabase/migrations/20260913110000_order_economics.sql','utf8'));}catch(e){if(!(e instanceof Error&&e.message.includes('ENOENT')))throw e;}
});
afterAll(async()=>{await db.close();});
it('does not trust historical inferred return counters; a committed restock recovers only its quantity',async()=>{
 expect((await db.query<{confirmed_returned_qty:number}>('select confirmed_returned_qty from admin_order_item_economics')).rows[0].confirmed_returned_qty).toBe(0);
 await db.exec(`insert into refund_quotes values('${item}',true,'{"lines":[{"itemId":"${item}","qty":1}]}');insert into refund_commits values('${item}','${order}','${item}');`);
 expect((await db.query<{confirmed_returned_qty:number}>('select confirmed_returned_qty from admin_order_item_economics')).rows[0].confirmed_returned_qty).toBe(1);
});
it('stores explicit zero distinctly from missing expense, audits actor, and rejects stale writes atomically',async()=>{
 await db.query('select admin_save_order_costs($1,$2,0,$3)',[order,JSON.stringify({carrier_cents:0,note:'Carrier receipt',tax_basis_confirmed:false}),'admin@example.test']);
 expect((await db.query('select carrier_cents,payment_cents,revision from order_variable_costs')).rows[0]).toEqual({carrier_cents:0,payment_cents:null,revision:1});
 await expect(db.query('select admin_save_order_costs($1,$2,0,$3)',[order,'{}','other'])).rejects.toThrow(/changed/i);
 await expect(db.query('select admin_save_order_costs($1,$2,1,$3)',[order,'{"payment_cents":-1}','admin'])).rejects.toThrow();
 expect((await db.query('select actor_email from admin_audit_log')).rows).toEqual([{actor_email:'admin@example.test'}]);
});
it('denies public report and expense access and RPC mutation',async()=>{
 await db.exec('set role anon');
 await expect(db.query('select * from order_variable_costs')).rejects.toThrow(/permission/);
 await expect(db.query('select * from admin_order_item_economics')).rejects.toThrow(/permission/);
 await expect(db.query('select admin_save_order_costs($1,$2,0,$3)',[order,'{}','forged'])).rejects.toThrow(/permission/);
 await db.exec('reset role');
});

it('persists signed tax corrections separately, audits them and enforces integer bounds',async()=>{
 await db.exec('truncate order_variable_costs,admin_audit_log');
 for(const [revision,value] of [null,0,-500,500,-2147483648,2147483647].entries()){
  await db.query('select admin_save_order_costs($1,$2,$3,$4)',[order,JSON.stringify({tax_adjustment_cents:value}),revision,'accountant@example.test']);
  expect((await db.query('select tax_adjustment_cents from order_variable_costs')).rows[0]).toEqual({tax_adjustment_cents:value});
 }
 for(const value of [-2147483649,2147483648,0.5,'5']) await expect(db.query('select admin_save_order_costs($1,$2,6,$3)',[order,JSON.stringify({tax_adjustment_cents:value}),'admin'])).rejects.toThrow();
 const audit=(await db.query<{diff:{after:{tax_adjustment_cents:number}}}>('select diff from admin_audit_log')).rows;
 expect(audit).toHaveLength(6);expect(audit[2].diff.after.tax_adjustment_cents).toBe(-500);
});
