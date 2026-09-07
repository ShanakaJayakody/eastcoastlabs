import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, expect, it } from "vitest";
let db: PGlite;
const id="31a1e654-4577-4176-99d8-255613de2911";
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role;
 create table email_outbox(id uuid primary key default gen_random_uuid(),to_email text,template text,payload jsonb default '{}',status text default 'queued',error text,related_type text,related_id text,created_at timestamptz default now(),sent_at timestamptz,provider_message_id text,unique(to_email,template,related_id));
 create table admin_users(email text,active boolean);
 create table email_events(id uuid primary key default gen_random_uuid(),outbox_id uuid,to_email text,detail jsonb,provider_event_id text unique);
 create table subscribers(email text,source text,unsubscribed_at timestamptz);
 create table sequence_overrides(email text,sequence text,action text);
 create table orders(id uuid primary key,order_number text,customer_email text,status text,payment_expires_at timestamptz,payment_method text,payment_reference text,total_cents integer,tracking_number text,created_at timestamptz default now());
 create table cart_sessions(email text,status text,updated_at timestamptz);
 create table reviews(order_id uuid,status text);
 create table commerce_events(id uuid primary key default gen_random_uuid(),order_id uuid,kind text,payload jsonb,created_at timestamptz default now(),processed_at timestamptz);
 insert into orders(id,order_number,customer_email,status,payment_expires_at,total_cents) values('${id}','ECL-1','buyer@example.test','pending',now()+interval '2 days',1000);`);
 try {await db.exec(readFileSync('supabase/migrations/20260908120000_outbox_integrity.sql','utf8'));} catch(e){if(!(e instanceof Error && e.message.includes('ENOENT')))throw e;}
});
afterAll(async()=>{await db.close();});
async function insert(template:string,email="buyer@example.test") {
 return (await db.query<{id:string}>(`insert into email_outbox(to_email,template,payload) values($1,$2,$3::jsonb) returning id`,[email,template,JSON.stringify({order_id:id})])).rows[0].id;
}
it('claims a row once and rejects stale lease completion',async()=>{
 const rowId=await insert('payment_instructions');
 const a=await db.query<{id:string;lease_token:string}>(`select * from claim_email_outbox(1,$1)`,[rowId]);
 expect(a.rows).toHaveLength(1);
 expect((await db.query(`select * from claim_email_outbox(1,$1)`,[rowId])).rows).toHaveLength(0);
 await expect(db.query(`select finish_email_outbox($1,gen_random_uuid(),'sent',null,'provider')`,[rowId])).rejects.toThrow(/lease/i);
 await db.query(`select finish_email_outbox($1,$2,'sent',null,'provider')`,[rowId,a.rows[0].lease_token]);
 expect((await db.query(`select * from claim_email_outbox(1,$1)`,[rowId])).rows).toHaveLength(0);
});
it('rechecks suppression and stale payment state after claim',async()=>{
 const rowId=await insert('welcome_1');
 await db.exec(`insert into subscribers values('buyer@example.test','newsletter',null)`);
 const a=(await db.query<{lease_token:string}>(`select * from claim_email_outbox(1,$1)`,[rowId])).rows[0];
 await db.exec(`update subscribers set unsubscribed_at=now()`);
 expect((await db.query<{ok:boolean}>(`select authorize_email_delivery($1,$2) as ok`,[rowId,a.lease_token])).rows[0].ok).toBe(false);
 expect((await db.query<{status:string}>(`select status from email_outbox where id=$1`,[rowId])).rows[0].status).toBe('cancelled');
 const reminder=await insert('payment_reminder');
 const claim=(await db.query<{lease_token:string}>(`select * from claim_email_outbox(1,$1)`,[reminder])).rows[0];
 await db.exec(`update orders set status='paid'`);
 expect((await db.query<{ok:boolean}>(`select authorize_email_delivery($1,$2) as ok`,[reminder,claim.lease_token])).rows[0].ok).toBe(false);
});
it('failed sends wait for backoff and exhausted attempts become terminal',async()=>{
 const rowId=await insert('order_confirmation');
 const claim=(await db.query<{lease_token:string}>(`select * from claim_email_outbox(1,$1)`,[rowId])).rows[0];
 await db.query(`select finish_email_outbox($1,$2,'failed','offline',null)`,[rowId,claim.lease_token]);
 expect((await db.query(`select * from claim_email_outbox(1,$1)`,[rowId])).rows).toHaveLength(0);
 await db.query(`update email_outbox set attempt_count=6,next_attempt_at=now()-interval '1 minute' where id=$1`,[rowId]);
 expect((await db.query(`select * from claim_email_outbox(1,$1)`,[rowId])).rows).toHaveLength(0);
 expect((await db.query<{status:string}>(`select status from email_outbox where id=$1`,[rowId])).rows[0].status).toBe('dead');
});
it('a committed commerce event creates durable email intent once in the same transaction',async()=>{
 await db.exec(`insert into commerce_events(order_id,kind,payload) values('${id}','paid','{}')`);
 const rows=(await db.query(`select * from email_outbox where related_id like 'event:%'`)).rows;
 expect(rows).toHaveLength(1);
});
it('freezes the provider body across retries and rejects stale payment amounts',async()=>{
 await db.exec(`update orders set status='pending'`);
 const rowId=await insert('payment_instructions');
 const claim=(await db.query<{lease_token:string}>(`select * from claim_email_outbox(1,$1)`,[rowId])).rows[0];
 await db.query(`select prepare_email_delivery($1,$2,'Original','Original body')`,[rowId,claim.lease_token]);
 expect((await db.query<{body:{html:string}}>(`select prepare_email_delivery($1,$2,'Changed','Changed body') as body`,[rowId,claim.lease_token])).rows[0].body.html).toBe('Original body');
 await db.query(`update email_outbox set payload=payload||'{"amount_cents":999}' where id=$1`,[rowId]);
 expect((await db.query<{ok:boolean}>(`select authorize_email_delivery($1,$2) as ok`,[rowId,claim.lease_token])).rows[0].ok).toBe(false);
});

it('reconciles exact provider events received before and after completion, never another recipient',async()=>{
 const rowId=await insert('order_confirmation');
 const claim=(await db.query<{lease_token:string}>(`select * from claim_email_outbox(1,$1)`,[rowId])).rows[0];
 await db.query(`insert into email_events(to_email,detail,provider_event_id) values('buyer@example.test','{"message_id":"early-provider"}','early'),('wrong@example.test','{"message_id":"early-provider"}','wrong')`);
 await db.query(`select finish_email_outbox($1,$2,'sent',null,'early-provider')`,[rowId,claim.lease_token]);
 expect((await db.query<{outbox_id:string}>(`select outbox_id from email_events where provider_event_id='early'`)).rows[0].outbox_id).toBe(rowId);
 expect((await db.query<{outbox_id:string|null}>(`select outbox_id from email_events where provider_event_id='wrong'`)).rows[0].outbox_id).toBeNull();
 await db.query(`insert into email_events(to_email,detail,provider_event_id) values('buyer@example.test','{"message_id":"early-provider"}','late')`);
 expect((await db.query<{outbox_id:string}>(`select outbox_id from email_events where provider_event_id='late'`)).rows[0].outbox_id).toBe(rowId);
});
