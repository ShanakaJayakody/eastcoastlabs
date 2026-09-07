import { PGlite } from '@electric-sql/pglite';
import { existsSync,readFileSync } from 'node:fs';
import { afterAll,beforeAll,beforeEach,expect,it } from 'vitest';
let db:PGlite;
const variant='20000000-0000-0000-0000-000000000001';
beforeAll(async()=>{
 db=new PGlite();await db.exec('create role anon;create role authenticated;create role service_role;');
 await db.exec(readFileSync('supabase/migrations/20260724110000_commerce.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20260725100000_outbox.sql','utf8'));
 await db.exec(`alter table email_outbox add column provider_attempted_at timestamptz;
 create unique index email_outbox_dedupe on email_outbox(to_email,template,related_id);
 create table stock_notifications(id uuid primary key default gen_random_uuid(),email text,product_slug text,notified boolean default false,created_at timestamptz default now(),unique(email,product_slug));
 create table subscribers(email text,unsubscribed_at timestamptz);
 insert into products(id,slug,name) values('10000000-0000-0000-0000-000000000001','sample','Sample');
 insert into product_variants(id,product_id,sku,pack_size,label,price_cents) values('${variant}','10000000-0000-0000-0000-000000000001','SAMPLE',1,'1 vial',1000);`);
 const file='supabase/migrations/20260908170000_stock_notifications.sql';if(existsSync(file))await db.exec(readFileSync(file,'utf8'));
});
afterAll(async()=>{await db.close()});
beforeEach(async()=>{await db.exec(`truncate stock_notifications,email_outbox,subscribers;update products set status='active';update product_variants set active=true;
 truncate stock_movements,inventory;insert into stock_movements(variant_id,qty,reason) values('${variant}',10,'received');
 insert into stock_notifications(email,product_slug) values('buyer@example.test','sample');`)});
async function queue(){return (await db.query<{n:number}>('select queue_back_in_stock($1) n',[variant])).rows[0].n}
async function eligible(){return (await db.query<{eligible:boolean}>('select back_in_stock_eligible(e) eligible from email_outbox e order by created_at,id')).rows.map(r=>r.eligible)}
it('queues and marks a request atomically, once per request',async()=>{
 expect(await queue()).toBe(1);expect(await queue()).toBe(0);
 expect((await db.query('select notified from stock_notifications')).rows[0]).toEqual({notified:true});expect(await eligible()).toEqual([true]);
});
it('rolls back all notification claims when the durable outbox insert fails',async()=>{
 await db.exec("create function reject_stock_email() returns trigger language plpgsql as $$ begin raise exception 'injected stock outbox failure';end $$;create trigger reject_stock_email before insert on email_outbox for each row execute function reject_stock_email();");
 try{await expect(queue()).rejects.toThrow('injected stock outbox failure')}finally{await db.exec('drop trigger reject_stock_email on email_outbox;drop function reject_stock_email()')}
 expect((await db.query('select notified from stock_notifications')).rows[0]).toEqual({notified:false});expect((await db.query('select count(*)::int n from email_outbox')).rows[0]).toEqual({n:0});
 expect(await queue()).toBe(1);
});
it('a new signup changes request identity and may alert again while superseding the old intent',async()=>{
 await queue();const old=(await db.query<{request_id:string}>('select request_id from stock_notifications')).rows[0].request_id;
 await db.exec("insert into stock_notifications(email,product_slug,notified) values('buyer@example.test','sample',false) on conflict(email,product_slug) do update set notified=false");
 expect((await db.query<{request_id:string}>('select request_id from stock_notifications')).rows[0].request_id).not.toBe(old);expect(await eligible()).toEqual([false]);
 expect(await queue()).toBe(1);expect((await eligible()).sort()).toEqual([false,true]);
});
it('checks current pooled stock and active variant/parent before queueing and before delivery',async()=>{
 await db.exec("update products set status='draft'");expect(await queue()).toBe(0);
 await db.exec('update products set status=\'active\';update product_variants set active=false');expect(await queue()).toBe(0);
 await db.exec('update product_variants set active=true;update inventory set reserved=10');expect(await queue()).toBe(0);
 await db.exec('update inventory set reserved=0');expect(await queue()).toBe(1);
 await db.exec('update inventory set reserved=10');expect(await eligible()).toEqual([false]);
 await db.exec("update inventory set reserved=0;update products set status='draft'");expect(await eligible()).toEqual([false]);
});
it('keeps suppressed requests unclaimed and does not expose the RPC publicly',async()=>{
 await db.exec("insert into subscribers values('buyer@example.test',now())");expect(await queue()).toBe(0);
 expect((await db.query("select has_function_privilege('anon','queue_back_in_stock(uuid)','execute') allowed")).rows[0]).toEqual({allowed:false});
});

it('uses the single-vial inventory pool for pack availability',async()=>{
 const pack='20000000-0000-0000-0000-000000000003';
 await db.exec(`insert into product_variants(id,product_id,sku,pack_size,label,price_cents) values('${pack}','10000000-0000-0000-0000-000000000001','PACK',3,'3-pack',2700);update inventory set reserved=8;`);
 expect((await db.query('select queue_back_in_stock($1) n',[pack])).rows[0]).toEqual({n:0});
 await db.exec('update inventory set reserved=7');
 expect((await db.query('select queue_back_in_stock($1) n',[pack])).rows[0]).toEqual({n:1});expect(await eligible()).toEqual([true]);
});
it('rearms an unsent unavailable alert for the next restock while preserving its original request date',async()=>{
 await queue();const original=(await db.query<{request_id:string;requested_at:string}>('select request_id,requested_at from stock_notifications')).rows[0];
 await db.exec('update inventory set reserved=10');
 expect((await db.query('select rearm_unsent_stock_notification(e) rearmed from email_outbox e')).rows[0]).toEqual({rearmed:true});
 const next=(await db.query<{request_id:string;requested_at:string;notified:boolean}>('select request_id,requested_at,notified from stock_notifications')).rows[0];
 expect(next.request_id).not.toBe(original.request_id);expect(next.requested_at).toEqual(original.requested_at);expect(next.notified).toBe(false);
 expect((await db.query('select rearm_unsent_stock_notification(e) rearmed from email_outbox e')).rows[0]).toEqual({rearmed:false});
 await db.exec('update inventory set reserved=0');expect(await queue()).toBe(1);expect((await eligible()).sort()).toEqual([false,true]);
});
it('does not rearm available, superseded, suppressed or previously attempted notifications',async()=>{
 await queue();expect((await db.query('select rearm_unsent_stock_notification(e) rearmed from email_outbox e')).rows[0]).toEqual({rearmed:false});
 await db.exec("update inventory set reserved=10;insert into subscribers values('buyer@example.test',now())");
 expect((await db.query('select rearm_unsent_stock_notification(e) rearmed from email_outbox e')).rows[0]).toEqual({rearmed:false});
 await db.exec("truncate subscribers;alter table email_outbox add column if not exists provider_attempted_at timestamptz;update email_outbox set provider_attempted_at=now()");
 expect((await db.query('select rearm_unsent_stock_notification(e) rearmed from email_outbox e')).rows[0]).toEqual({rearmed:false});
 await db.exec("update email_outbox set provider_attempted_at=null;update stock_notifications set notified=false");
 expect((await db.query('select rearm_unsent_stock_notification(e) rearmed from email_outbox e')).rows[0]).toEqual({rearmed:false});
});
