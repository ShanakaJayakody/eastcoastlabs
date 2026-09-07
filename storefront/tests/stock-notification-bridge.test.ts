import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync} from 'node:fs';
import {beforeAll,afterAll,beforeEach,expect,it} from 'vitest';
let db:PGlite;
const variant='20000000-0000-0000-0000-000000000088';
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema storage;create table storage.buckets(id text primary key,name text,public boolean);`);
 for(const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
 await db.exec(`insert into products(id,slug,name) values('10000000-0000-0000-0000-000000000088','bridge-fixture','Bridge fixture');insert into product_variants(id,product_id,sku,pack_size,label,price_cents) values('${variant}','10000000-0000-0000-0000-000000000088','BRIDGE',1,'1 vial',1000);insert into stock_movements(variant_id,qty,reason) values('${variant}',10,'received');`);
});
afterAll(async()=>{await db.close()});
beforeEach(async()=>{await db.exec(`truncate stock_notifications,email_outbox cascade;update inventory set reserved=0 where variant_id='${variant}';insert into stock_notifications(email,product_slug) values('bridge@example.test','bridge-fixture');`)});
async function queue(){return (await db.query<{n:number}>('select queue_back_in_stock($1) n',[variant])).rows[0].n}
async function claim(){return (await db.query<{id:string;lease_token:string}>('select * from claim_email_outbox(1)')).rows[0]}
async function authorize(row:{id:string;lease_token:string}){return (await db.query<{ok:boolean}>('select authorize_email_delivery($1,$2) ok',[row.id,row.lease_token])).rows[0].ok}
it('retains a never-sent stock request through unavailable stock and the next restock',async()=>{
 expect(await queue()).toBe(1);const row=await claim();await db.query('update inventory set reserved=10 where variant_id=$1',[variant]);
 expect(await authorize(row)).toBe(false);
 expect((await db.query<{notified:boolean}>('select notified from stock_notifications')).rows[0].notified).toBe(false);
 await db.query('update inventory set reserved=0 where variant_id=$1',[variant]);expect(await queue()).toBe(1);
 expect(await authorize(await claim())).toBe(true);
});
it('never rearms an alert after a potentially accepted provider attempt',async()=>{
 await queue();const first=await claim();expect(await authorize(first)).toBe(true);
 await db.query(`select finish_email_outbox($1,$2,'failed','uncertain provider result',null)`,[first.id,first.lease_token]);
 await db.query(`update email_outbox set next_attempt_at=now()-interval '1 minute' where id=$1`,[first.id]);
 await db.query('update inventory set reserved=10 where variant_id=$1',[variant]);expect(await authorize(await claim())).toBe(false);
 expect((await db.query<{notified:boolean}>('select notified from stock_notifications')).rows[0].notified).toBe(true);
 await db.query('update inventory set reserved=0 where variant_id=$1',[variant]);expect(await queue()).toBe(0);
});
