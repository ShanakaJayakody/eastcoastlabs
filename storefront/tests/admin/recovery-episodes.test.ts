import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,it,expect} from 'vitest';
let db:PGlite;
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table cart_sessions(email text primary key,cart jsonb,subtotal_cents integer,status text,reminder_sent_at timestamptz,reminder_stage integer,recovered_order_id uuid,created_at timestamptz default now(),updated_at timestamptz default now());
 create table orders(id uuid primary key,customer_email text,created_at timestamptz,paid_at timestamptz,status text,total_cents integer,refunded_cents integer default 0);
 create table subscribers(email text,source text,unsubscribed_at timestamptz);create table sequence_overrides(email text,sequence text,action text);
 create table email_outbox(id uuid primary key default gen_random_uuid(),to_email text,related_type text,related_id text,created_at timestamptz default now(),payload jsonb,template text default 'abandoned_cart',status text default 'queued',sent_at timestamptz,unique(to_email,template,related_id));
 insert into cart_sessions(email,cart,subtotal_cents,status) values('legacy@test.local','[]',100,'recovered');`);
 try{await db.exec(readFileSync('supabase/migrations/20260908140000_recovery_episodes.sql','utf8'));}catch(e){if(!(e instanceof Error&&e.message.includes('ENOENT')))throw e;}
});
afterAll(async()=>{await db.close();});
const capture=async(email:string,amount:number)=> (await db.query<{id:string}>(`select recovery_capture($1,'[{"name":"Test","quantity":1}]',$2) id`,[email,amount])).rows[0].id;
it('identical active capture reuses an episode; changed capture preserves an immutable earlier episode',async()=>{
 const first=await capture('one@test.local',100);
 expect(await capture('one@test.local',100)).toBe(first);
 const next=await capture('one@test.local',200);expect(next).not.toBe(first);
 expect((await db.query<{state:string;subtotal_cents:number}>('select state,subtotal_cents from recovery_episodes where id=$1',[first])).rows[0]).toEqual({state:'superseded',subtotal_cents:100});
 await expect(db.query('update recovery_episodes set subtotal_cents=300 where id=$1',[first])).rejects.toThrow(/immutable/i);
});
it('attribution requires concrete episode, real sent exposure before order creation and net paid funds',async()=>{
 const id=await capture('pay@test.local',1000);
 await db.query(`insert into orders values('00000000-0000-0000-0000-000000000101','pay@test.local',now()+interval '2 seconds',null,'pending',1000,200)`);
 await db.query(`select recovery_complete('pay@test.local','00000000-0000-0000-0000-000000000101',$1)`,[id]);
 const metrics=async()=> (await db.query<{m:{attributed_net_paid_cents:number;order_created:number;paid:number}}>(`select recovery_episode_metrics('2000-01-01','2100-01-01') m`)).rows[0].m;
 expect((await metrics()).attributed_net_paid_cents).toBe(0);
 await db.query(`insert into email_outbox(payload,status,sent_at) values(jsonb_build_object('recovery_episode_id',$1::text),'sent',now()+interval '1 second')`,[id]);
 expect((await metrics()).attributed_net_paid_cents).toBe(0);
 await db.exec(`update orders set status='paid',paid_at=now()+interval '3 seconds'`);
 expect((await metrics()).attributed_net_paid_cents).toBe(800);
 await db.exec(`update email_outbox set sent_at=now()+interval '5 seconds'`);
 expect((await metrics()).attributed_net_paid_cents).toBe(0);
});
it('email-only completion suppresses reminders without claiming episode attribution',async()=>{
 const id=await capture('organic@test.local',500);
 await db.exec(`insert into orders values('00000000-0000-0000-0000-000000000102','organic@test.local',now(),now(),'paid',500,0)`);
 await db.query(`select recovery_complete('organic@test.local','00000000-0000-0000-0000-000000000102',null)`);
 expect((await db.query<{order_id:string|null}>('select order_id from recovery_episodes where id=$1',[id])).rows[0].order_id).toBeNull();
 expect((await db.query<{status:string}>(`select status from cart_sessions where email='organic@test.local'`)).rows[0].status).toBe('recovered');
});

it('queue insert failure leaves recovery stage unconsumed; consent and pauses gate atomic retry',async()=>{
 await db.exec(`insert into recovery_episodes(id,email,cart,subtotal_cents,captured_at) values('00000000-0000-0000-0000-000000000201','broken@test.local','[{"name":"Test"}]',100,now()-interval '2 hours');
 insert into cart_sessions(email,cart,subtotal_cents,status,reminder_stage,updated_at,current_episode_id) values('broken@test.local','[{"name":"Test"}]',100,'active',0,now()-interval '2 hours','00000000-0000-0000-0000-000000000201');
 insert into subscribers values('broken@test.local','newsletter',null);
 alter table email_outbox add constraint reject_fixture check(to_email<>'broken@test.local');`);
 await expect(db.query('select recovery_queue_due(200)')).rejects.toThrow(/reject_fixture/);
 expect((await db.query<{reminder_stage:number}>("select reminder_stage from cart_sessions where email='broken@test.local'")).rows[0].reminder_stage).toBe(0);
 await db.exec("alter table email_outbox drop constraint reject_fixture;insert into sequence_overrides values('broken@test.local','cart_recovery','pause')");
 expect((await db.query<{n:number}>('select recovery_queue_due(200) n')).rows[0].n).toBe(0);
 await db.exec("delete from sequence_overrides");
 expect((await db.query<{n:number}>('select recovery_queue_due(200) n')).rows[0].n).toBe(1);
 expect((await db.query<{n:number}>('select recovery_queue_due(200) n')).rows[0].n).toBe(0);
 expect((await db.query<{reminder_stage:number}>("select reminder_stage from cart_sessions where email='broken@test.local'")).rows[0].reminder_stage).toBe(1);
});
