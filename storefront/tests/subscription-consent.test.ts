import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll,afterAll,expect,it } from "vitest";
let db:PGlite;
const hash='a'.repeat(64);
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;
 create table subscribers(email text,source text,unsubscribed_at timestamptz,created_at timestamptz default now(),unique(email,source));
 create table email_outbox(id uuid primary key default gen_random_uuid(),to_email text,template text,payload jsonb,status text default 'queued',related_type text,related_id text,unique(to_email,template,related_id));
 insert into subscribers(email,source,unsubscribed_at) values('buyer@example.test','unsubscribe',now());`);
 try{await db.exec(readFileSync('supabase/migrations/20260908130000_subscription_consent.sql','utf8'));}catch(e){if(!(e instanceof Error&&e.message.includes('ENOENT')))throw e;}
});
afterAll(async()=>{await db.close();});
it('a public request never clears existing suppression and is rate bounded',async()=>{
 await db.query(`select request_subscription('buyer@example.test','footer',$1,'https://www.eastcoastlabs.com.au/subscribe/confirm?token=test')`,[hash]);
 expect((await db.query(`select * from subscribers where unsubscribed_at is not null`)).rows).toHaveLength(1);
 await db.query(`select request_subscription('buyer@example.test','footer',$1,'https://www.eastcoastlabs.com.au/subscribe/confirm?token=again')`,['b'.repeat(64)]);
 expect((await db.query('select * from email_outbox')).rows).toHaveLength(1);
});
it('only a matching unexpired mailbox confirmation renews consent once',async()=>{
 expect((await db.query<{ok:boolean}>(`select confirm_subscription($1) as ok`,['c'.repeat(64)])).rows[0].ok).toBe(false);
 expect((await db.query<{ok:boolean}>(`select confirm_subscription($1) as ok`,[hash])).rows[0].ok).toBe(true);
 expect((await db.query(`select * from subscribers where unsubscribed_at is not null`)).rows).toHaveLength(0);
 expect((await db.query<{ok:boolean}>(`select confirm_subscription($1) as ok`,[hash])).rows[0].ok).toBe(false);
 expect((await db.query(`select * from email_outbox where template='welcome_1'`)).rows).toHaveLength(1);
});
it('unsubscribe is durable and cancels pending marketing while retaining order notifications',async()=>{
 await db.exec(`insert into email_outbox(to_email,template) values('buyer@example.test','payment_instructions')`);
 await db.query(`select suppress_marketing('buyer@example.test','unsubscribe')`);
 expect((await db.query<{status:string}>(`select status from email_outbox where template='welcome_1'`)).rows[0].status).toBe('cancelled');
 expect((await db.query<{status:string}>(`select status from email_outbox where template='payment_instructions'`)).rows[0].status).toBe('queued');
});

it('a later unsubscribe invalidates an earlier unconfirmed opt-in link',async()=>{
 const email='later@example.test', token='d'.repeat(64);
 await db.query(`select request_subscription($1,'footer',$2,'https://www.eastcoastlabs.com.au/subscribe/confirm?token=test')`,[email,token]);
 await db.query(`select suppress_marketing($1,'unsubscribe')`,[email]);
 expect((await db.query<{ok:boolean}>(`select confirm_subscription($1) as ok`,[token])).rows[0].ok).toBe(false);
});
it('expired or already confirmed requests cannot authorise an email',async()=>{
 const row=(await db.query<{id:string}>(`select id from subscription_requests where token_hash=$1`,[hash])).rows[0];
 expect((await db.query<{ok:boolean}>(`select subscription_confirmation_eligible($1,$2) as ok`,[row.id,'buyer@example.test'])).rows[0].ok).toBe(false);
 const token='e'.repeat(64);await db.query(`select request_subscription('expired@example.test','footer',$1,'https://www.eastcoastlabs.com.au/subscribe/confirm?token=test')`,[token]);
 const active=(await db.query<{id:string}>(`select id from subscription_requests where token_hash=$1`,[token])).rows[0];
 expect((await db.query<{ok:boolean}>(`select subscription_confirmation_eligible($1,'wrong@example.test') as ok`,[active.id])).rows[0].ok).toBe(false);
 expect((await db.query<{ok:boolean}>(`select subscription_confirmation_eligible($1,'expired@example.test') as ok`,[active.id])).rows[0].ok).toBe(true);
 await db.query(`update subscription_requests set expires_at=now()-interval '1 second' where id=$1`,[active.id]);
 expect((await db.query<{ok:boolean}>(`select subscription_confirmation_eligible($1,'expired@example.test') as ok`,[active.id])).rows[0].ok).toBe(false);
});
it('confirmed welcome uses the same lifetime identity as admin manual sends',async()=>{
 expect((await db.query<{related_id:string}>(`select related_id from email_outbox where template='welcome_1'`)).rows[0].related_id).toBe('buyer@example.test:welcome:1');
});
