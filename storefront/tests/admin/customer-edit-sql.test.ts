import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";

let db: PGlite;
const migration = "supabase/migrations/20260914100000_customer_details.sql";
const details = { email: "correct@example.test", name: "Correct Name", phone: "+61 400 123 456", address: { line1: "20 New Street", line2: "", suburb: "Melbourne", state: "VIC", postcode: "3000", country: "AU" } };
const save = (patch: unknown = details, version = 0, email = "typo@example.test") =>
  db.query("select admin_save_customer($1,$2::jsonb,$3,$4) result", [email, JSON.stringify(patch), version, "admin@example.test"]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table admin_users(email text primary key, active boolean);
    insert into admin_users values('admin@example.test',true);
    create table orders(id uuid primary key default gen_random_uuid(),customer_email text not null,customer_name text,shipping_address jsonb,status text,total_cents integer,refunded_cents integer default 0,paid_at timestamptz,stock_settled boolean default false,created_at timestamptz default now(),updated_at timestamptz default now());
    create table customer_profiles(email text primary key,tags text[] not null default '{}',created_at timestamptz default now(),updated_at timestamptz default now());
    create table subscribers(email text,source text,unsubscribed_at timestamptz,created_at timestamptz default now(),unique(email,source));
    create table cart_sessions(email text primary key,status text,subtotal_cents integer,reminder_stage integer,updated_at timestamptz);
    create table customer_notes(email text,note text);
    create table sequence_overrides(email text,sequence text,action text,primary key(email,sequence));
    create table stock_notifications(email text,product_slug text,notified boolean,unique(email,product_slug));
    create table recovery_episodes(id uuid primary key default gen_random_uuid(),email text,cart jsonb,subtotal_cents integer,captured_at timestamptz,state text,legacy_unknown boolean,legacy_status text,legacy_order_id uuid,order_id uuid,closed_at timestamptz);
    create table subscription_requests(email text,confirmed_at timestamptz,expires_at timestamptz);
    create table recovery_requests(email text,revoked_at timestamptz);
    create table admin_audit_log(actor_email text,action text,entity_type text,entity_id text,diff jsonb);
    create table email_outbox(id uuid primary key default gen_random_uuid(),to_email text,template text,related_id text,status text,payload jsonb default '{}',provider_attempted_at timestamptz,provider_message_id text,sent_at timestamptz,created_at timestamptz default now(),rendered_subject text,rendered_html text,rendered_from text,rendered_tag text,unique(to_email,template,related_id));
    create table email_events(outbox_id uuid,to_email text,detail jsonb);
  `);
  const existing = readFileSync("supabase/migrations/20260908110000_admin_integrity.sql", "utf8");
  await db.exec(existing.slice(existing.indexOf("create or replace view public.customers as")));
  const recovery = readFileSync("supabase/migrations/20260908140000_recovery_episodes.sql", "utf8");
  await db.exec(recovery.slice(recovery.indexOf("create or replace function recovery_episode_immutable"), recovery.indexOf("create or replace function recovery_capture")));
  await db.exec("alter table cart_sessions add current_episode_id uuid,add reminder_sent_at timestamptz");
  await db.exec(readFileSync(migration, "utf8"));
  await db.exec("create trigger match_email_event before insert on email_events for each row execute function match_email_event()");
});
afterAll(async () => { await db.close(); });
beforeEach(async () => {
  await db.exec(`truncate orders,customer_profiles,subscribers,cart_sessions,customer_notes,sequence_overrides,stock_notifications,recovery_episodes,subscription_requests,recovery_requests,admin_audit_log,email_outbox,email_events;
    insert into orders(customer_email,customer_name,shipping_address,status,total_cents,paid_at) values('typo@example.test','Original Name','{"line1":"10 Original Street","phone":"0400000000"}','paid',2500,now());
    insert into customer_profiles(email,tags) values('typo@example.test',array['vip']);
    insert into subscribers values('typo@example.test','footer','2026-01-01',now());
    insert into customer_notes values('typo@example.test','Keep this note');
    insert into sequence_overrides values('typo@example.test','welcome','pause');
    insert into cart_sessions values('typo@example.test','active',1000,2,'2026-01-02');
    insert into stock_notifications values('typo@example.test','sample',false);
    insert into recovery_episodes(email) values('typo@example.test');
    insert into subscription_requests values('typo@example.test',null,now()+interval '1 day');
    insert into recovery_requests values('typo@example.test',null);
    insert into admin_audit_log values('admin@example.test','note.add','customer','typo@example.test','{}');
  `);
});

it("moves one identity atomically, keeps order snapshots and customer history, and records before/after values", async () => {
  await save();
  expect((await db.query("select email,name,phone,address,tags,edit_version,previous_emails from customer_profiles")).rows[0]).toMatchObject({ email: "correct@example.test", name: "Correct Name", phone: "+61 400 123 456", tags: ["vip"], edit_version: 1, previous_emails: ["typo@example.test"], address: { line1: "20 New Street" } });
  expect((await db.query("select customer_email,customer_name,shipping_address from orders")).rows[0]).toEqual({ customer_email: "correct@example.test", customer_name: "Original Name", shipping_address: { line1: "10 Original Street", phone: "0400000000" } });
  for (const table of ["customer_notes", "sequence_overrides", "cart_sessions", "stock_notifications", "subscribers"]) {
    expect((await db.query(`select email from ${table}`)).rows).toEqual([{ email: "correct@example.test" }]);
  }
  expect((await db.query("select email,customer_email from recovery_episodes")).rows[0]).toEqual({ email: "typo@example.test", customer_email: "correct@example.test" });
  expect((await db.query("select unsubscribed_at is not null suppressed from subscribers")).rows[0]).toEqual({ suppressed: true });
  expect((await db.query("select expires_at<=now() expired from subscription_requests")).rows[0]).toEqual({ expired: true });
  expect((await db.query("select revoked_at is not null revoked from recovery_requests")).rows[0]).toEqual({ revoked: true });
  expect((await db.query("select diff from admin_audit_log where action='customer.update'")).rows[0]).toMatchObject({ diff: { before: { email: "typo@example.test" }, after: { email: "correct@example.test", name: "Correct Name" } } });
  expect((await db.query('select email,name,"ordersCount"::int,"ltvCents"::int from admin_people')).rows[0]).toEqual({ email: "correct@example.test", name: "Correct Name", ordersCount: 1, ltvCents: 2500 });
});

it("supports leads and clearing optional details without resurrecting order data", async () => {
  await db.exec("delete from orders");
  await save({ ...details, email: "typo@example.test" });
  expect((await db.query("select name from admin_people")).rows[0]).toEqual({ name: "Correct Name" });
  await save({ email: "typo@example.test", name: "", phone: "", address: {} }, 1);
  expect((await db.query("select name,phone,address from customer_profiles")).rows[0]).toEqual({ name: null, phone: null, address: {} });
});

it("rejects duplicate identities and rolls back every field", async () => {
  await db.exec("insert into subscribers(email,source) values('Correct@Example.Test','footer')");
  await expect(save()).rejects.toThrow(/already.*use/i);
  expect((await db.query("select email,edit_version from customer_profiles")).rows[0]).toEqual({ email: "typo@example.test", edit_version: 0 });
  expect((await db.query("select customer_email from orders")).rows[0]).toEqual({ customer_email: "typo@example.test" });
});

it("rejects stale editors, unknown customers, and malformed input", async () => {
  await save({ ...details, email: "typo@example.test" });
  await expect(save()).rejects.toThrow(/changed/i);
  await expect(save(details, 0, "missing@example.test")).rejects.toThrow(/not found/i);
  for (const patch of [null, { ...details, email: "bad email" }, { ...details, name: "x".repeat(301) }, { ...details, address: { unexpected: "data" } }, { ...details, active: true }]) {
    await expect(save(patch, 1)).rejects.toThrow(/invalid/i);
  }
});

it("preserves sent recipients and dedupe keys while safely retargeting unsent messages", async () => {
  await db.exec(`insert into email_outbox(to_email,template,related_id,status,provider_message_id,provider_attempted_at,sent_at,rendered_html) values
    ('typo@example.test','welcome_1','typo@example.test:welcome:1','sent','provider-1',now(),now(),'Sent body'),
    ('typo@example.test','welcome_3','typo@example.test:welcome:3','queued',null,null,null,'Stale body');`);
  await save();
  expect((await db.query("select to_email,delivery_email,related_id,rendered_html from email_outbox where status='sent'")).rows[0]).toEqual({ to_email: "correct@example.test", delivery_email: "typo@example.test", related_id: "correct@example.test:welcome:1", rendered_html: "Sent body" });
  expect((await db.query("select to_email,delivery_email,rendered_html from email_outbox where status='queued'")).rows[0]).toEqual({ to_email: "correct@example.test", delivery_email: null, rendered_html: null });
  await db.exec("insert into email_events(to_email,detail) values('typo@example.test','{\"message_id\":\"provider-1\"}')");
  expect((await db.query("select outbox_id is not null matched from email_events")).rows[0]).toEqual({ matched: true });
});

it.each(["sending", "failed", "dead", "cancelled"])("does not retarget %s messages with uncertain provider delivery", async status => {
  await db.query("insert into email_outbox(to_email,template,status,provider_attempted_at) values('typo@example.test','order_confirmation',$1,now())", [status]);
  await expect(save()).rejects.toThrow(/delivery|sending/i);
  expect((await db.query("select customer_email from orders")).rows[0]).toEqual({ customer_email: "typo@example.test" });
});

it("allows correcting an email back to its own previous address", async () => {
  await save();
  await save({ ...details, email: "typo@example.test" }, 1, "correct@example.test");
  expect((await db.query("select email,previous_emails from customer_profiles")).rows[0]).toEqual({ email: "typo@example.test", previous_emails: ["correct@example.test"] });
});

it("denies public execution and requires an active administrator", async () => {
  for (const role of ["anon", "authenticated"]) {
    expect((await db.query("select has_function_privilege($1,'admin_save_customer(text,jsonb,bigint,text)','execute') allowed", [role])).rows[0]).toEqual({ allowed: false });
  }
  await expect(db.query("select admin_save_customer($1,$2::jsonb,0,'not-admin@example.test')", ["typo@example.test", JSON.stringify(details)])).rejects.toThrow(/admin/i);
});
