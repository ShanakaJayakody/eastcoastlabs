import {PGlite} from '@electric-sql/pglite';
import {readFileSync,existsSync} from 'node:fs';
import {beforeAll,afterAll,it,expect} from 'vitest';
let db:PGlite;
const cart=[{key:'sample:1',slug:'sample',variantId:'00000000-0000-0000-0000-000000000001',name:'Sample',variantLabel:'1 vial',quantity:1,unitPriceCents:1000,lineTotalCents:1000,isGift:false}];
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table cart_sessions(email text primary key,cart jsonb,subtotal_cents integer,status text,reminder_sent_at timestamptz,reminder_stage integer,recovered_order_id uuid,created_at timestamptz default now(),updated_at timestamptz default now());
 create table orders(id uuid primary key,order_number text,customer_email text,created_at timestamptz default now(),paid_at timestamptz,status text,total_cents integer,refunded_cents integer default 0,payment_expires_at timestamptz,payment_method text,payment_reference text,tracking_number text);
 create table subscribers(email text,source text,unsubscribed_at timestamptz,unique(email,source));create table sequence_overrides(email text,sequence text,action text);
 create table email_outbox(id uuid primary key default gen_random_uuid(),to_email text,related_type text,related_id text,created_at timestamptz default now(),payload jsonb,template text,status text default 'queued',sent_at timestamptz,error text,provider_message_id text,unique(to_email,template,related_id));
 create table admin_users(email text,active boolean);create table reviews(order_id uuid,status text);
 create table email_events(id uuid primary key default gen_random_uuid(),outbox_id uuid,to_email text,detail jsonb,provider_event_id text unique);
 create table commerce_events(id uuid primary key default gen_random_uuid(),order_id uuid,kind text,payload jsonb,created_at timestamptz default now(),processed_at timestamptz);`);
 for(const name of ['20260908120000_outbox_integrity','20260908130000_subscription_consent','20260908140000_recovery_episodes','20260908200000_cart_recovery_consent']) {
  const p=`supabase/migrations/${name}.sql`;if(existsSync(p))await db.exec(readFileSync(p,'utf8'));
 }
});
afterAll(async()=>{await db.close();});
let seq=0;
async function request(email:string){const id=`00000000-0000-0000-0000-${String(++seq).padStart(12,'0')}`;const hash=seq.toString(16).padStart(64,'0');await db.query('select recovery_request($1,$2,$3,$4,1000)',[id,email,hash,JSON.stringify(cart)]);return {id,hash};}
async function confirm(hash:string){return (await db.query<{r:{episode_id:string;cart:typeof cart}|null}>('select recovery_confirm($1) r',[hash])).rows[0].r;}
it('requires mailbox proof, then repeats the same immutable episode without granting newsletter consent',async()=>{
 const r=await request('proof@test.local');
 expect((await db.query("select * from recovery_episodes where email='proof@test.local'")).rows).toHaveLength(0);
 expect(await confirm('f'.repeat(64))).toBeNull();
 const a=await confirm(r.hash);expect(a?.cart).toEqual(cart);expect(a?.episode_id).toBeTruthy();
 expect((await confirm(r.hash))?.episode_id).toBe(a?.episode_id);
 expect((await db.query('select * from subscribers')).rows).toEqual([]);
 const stored=JSON.stringify((await db.query('select * from recovery_requests')).rows);
 expect(stored).not.toContain('token=');
 expect((await db.query("select payload from email_outbox where template='cart_recovery_confirmation'")).rows).toEqual([{payload:{recovery_request_id:r.id}}]);
});
it('expires confirmation at 24 hours and restore at seven days without reactivation',async()=>{
 const r=await request('expired@test.local');await db.query("update recovery_requests set confirm_expires_at=now()-interval '1 second' where id=$1",[r.id]);expect(await confirm(r.hash)).toBeNull();
 const valid=await request('restore@test.local');await confirm(valid.hash);await db.query("update recovery_requests set restore_expires_at=now()-interval '1 second' where id=$1",[valid.id]);expect(await confirm(valid.hash)).toBeNull();
});
it('a later suppression revokes old pending and confirmed links; a fresh request never restores newsletter permission',async()=>{
 const pending=await request('stop@test.local');await db.query("select suppress_marketing('stop@test.local')");expect(await confirm(pending.hash)).toBeNull();
 // Rate-limit window elapsed; the next explicit request follows that unsubscribe.
 await db.query("update recovery_requests set requested_at=now()-interval '2 hours' where id=$1",[pending.id]);
 const fresh=await request('stop@test.local');expect(await confirm(fresh.hash)).not.toBeNull();
 expect((await db.query("select * from subscribers where unsubscribed_at is null")).rows).toEqual([]);
 await db.query("select suppress_marketing('stop@test.local')");expect(await confirm(fresh.hash)).toBeNull();
});
it('queues only purpose-confirmed current episodes, honors pause and rechecks suppression after claim',async()=>{
 const r=await request('due@test.local');const e=await confirm(r.hash);
 await db.query("update cart_sessions set updated_at=now()-interval '2 hours' where email='due@test.local'");
 await db.exec("insert into sequence_overrides values('due@test.local','cart_recovery','pause')");
 expect((await db.query<{n:number}>('select recovery_queue_due(200) n')).rows[0].n).toBe(0);
 await db.exec('delete from sequence_overrides');expect((await db.query<{n:number}>('select recovery_queue_due(200) n')).rows[0].n).toBe(1);
 const row=(await db.query<{id:string;payload:{recovery_episode_id:string;recovery_request_id:string}}>("select * from email_outbox where to_email='due@test.local' and template='abandoned_cart'")).rows[0];
 expect(row.payload).toMatchObject({recovery_episode_id:e?.episode_id,recovery_request_id:r.id});
 expect((await db.query<{reason:string|null}>('select email_delivery_ineligible(e) reason from email_outbox e where id=$1',[row.id])).rows[0].reason).toBeNull();
 const lease=(await db.query<{lease_token:string}>('select * from claim_email_outbox(1,$1)',[row.id])).rows[0].lease_token;
 await db.query("select suppress_marketing('due@test.local')");
 expect((await db.query<{ok:boolean}>('select authorize_email_delivery($1,$2) ok',[row.id,lease])).rows[0].ok).toBe(false);
});
it('public database roles cannot request, confirm or read bearer hashes',async()=>{
 expect((await db.query<{ok:boolean}>("select has_function_privilege('anon','recovery_confirm(text)','execute') ok")).rows[0].ok).toBe(false);
 expect((await db.query<{ok:boolean}>("select has_table_privilege('authenticated','recovery_requests','select') ok")).rows[0].ok).toBe(false);
 for(const operation of ['INSERT','UPDATE','DELETE','TRUNCATE'])expect((await db.query<{ok:boolean}>("select has_table_privilege('service_role','recovery_requests',$1) ok",[operation])).rows[0].ok).toBe(false);
});
it('credits only the exact restored cart and matching mailbox; changed quantities or identities are organic',async()=>{
 const r=await request('credit@test.local');const e=await confirm(r.hash);
 const credit=async(email:string,lines:unknown)=>(await db.query<{id:string|null}>('select recovery_attribution($1,$2,$3) id',[r.hash,email,JSON.stringify(lines)])).rows[0].id;
 expect(await credit('credit@test.local',cart)).toBe(e?.episode_id);
 expect(await credit('other@test.local',cart)).toBeNull();
 for(const change of [{quantity:2},{variantId:'00000000-0000-0000-0000-000000000099'},{slug:'other'},{key:'other'}])expect(await credit('credit@test.local',[{...cart[0],...change}])).toBeNull();
 expect(await credit('credit@test.local',[])).toBeNull();
});
it('has a bounded sequence, idempotent requests and no general subscriber fallback',async()=>{
 await db.exec("update cart_sessions set status='abandoned'");
 const r=await request('stages@test.local');await confirm(r.hash);
 const count=async()=>(await db.query<{n:number}>('select recovery_queue_due(200) n')).rows[0].n;
 for(const [hours,stage] of [[2,1],[25,2],[73,3]]){
  await db.query("update cart_sessions set updated_at=now()-make_interval(hours=>$1) where email='stages@test.local'",[hours]);
  expect(await count()).toBe(1);expect(await count()).toBe(0);
  expect((await db.query<{n:number}>("select reminder_stage n from cart_sessions where email='stages@test.local'")).rows[0].n).toBe(stage);
 }
 await db.query("update cart_sessions set updated_at=now()-interval '169 hours' where email='stages@test.local'");expect(await count()).toBe(0);
 await request('stages@test.local');expect((await db.query("select * from recovery_requests where email='stages@test.local'")).rows).toHaveLength(1);
});
it('service role can use wrapped eligibility while anonymous callers cannot',async()=>{
 await db.exec('grant select on email_outbox to service_role; set role service_role');
 try {expect((await db.query<{reason:string}>("select email_delivery_ineligible(e) reason from email_outbox e where template='abandoned_cart' limit 1")).rows[0].reason).toBeTruthy();}
 finally{await db.exec('reset role');}
});
it('a link requested before an order cannot restart recovery after that order',async()=>{
 const r=await request('ordered@test.local');
 await db.query("insert into orders(id,customer_email,status,total_cents) values(gen_random_uuid(),'ordered@test.local','pending',1000)");
 expect(await confirm(r.hash)).toBeNull();
 expect((await db.query("select * from recovery_episodes where email='ordered@test.local' and state='active'")).rows).toHaveLength(0);
});

it('manual payload shares the sweep identity and disappears when purpose consent is stopped',async()=>{
 const r=await request('manual@test.local');const e=await confirm(r.hash);
 const payload=async()=>(await db.query<{p:{payload:{recovery_request_id:string;recovery_episode_id:string};related_id:string}|null}>('select recovery_manual_payload($1,$2,1) p',['manual@test.local',e!.episode_id])).rows[0].p;
 expect(await payload()).toMatchObject({payload:{recovery_request_id:r.id,recovery_episode_id:e!.episode_id},related_id:e!.episode_id+':1'});
 await db.query("update cart_sessions set updated_at=now()-interval '2 hours' where email='manual@test.local'");await db.query('select recovery_queue_due(200)');
 expect((await db.query<{id:string}>("select related_id id from email_outbox where to_email='manual@test.local' and template='abandoned_cart'")).rows[0].id).toBe((await payload())!.related_id);
 await db.query("select recovery_stop('manual@test.local')");
 await db.query("insert into subscribers(email,source,unsubscribed_at) values('manual@test.local','newsletter',null)");
 expect(await confirm(r.hash)).toBeNull();expect(await payload()).toBeNull();
});
it('operator purpose stop revokes pending requests without changing newsletter permission',async()=>{
 const r=await request('pending-stop@test.local');await db.query("select recovery_stop('pending-stop@test.local')");
 expect(await confirm(r.hash)).toBeNull();expect((await db.query("select * from subscribers where email='pending-stop@test.local'")).rows).toHaveLength(0);
});
