import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, afterAll, it, expect } from 'vitest';

let db: PGlite;
const variant = '20000000-0000-0000-0000-000000000099';
beforeAll(async () => {
  db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz); create schema storage; create table storage.buckets(id text primary key,name text,public boolean);');
  for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()) await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
  await db.exec(`insert into products(id,slug,name,status) values('10000000-0000-0000-0000-000000000099','email-fixture','Email fixture','active');
    insert into product_variants(id,product_id,sku,pack_size,label,price_cents) values('${variant}','10000000-0000-0000-0000-000000000099','EMAIL-FIXTURE',1,'1 vial',1000);
    insert into stock_movements(variant_id,qty,reason) values('${variant}',100,'received');`);
});
afterAll(async () => { await db.close(); });
async function create() {
  const email = `${crypto.randomUUID()}@example.test`;
  const { rows } = await db.query<{r:{orderId:string;orderNumber:string}}> ('select commerce_create_order($1) r', [JSON.stringify({email,paymentMethod:'bank_transfer',items:[{variantId:variant,qty:1}],shippingCents:500})]);
  await db.query("insert into subscribers(email,source) values($1,'footer')", [email]);
  return {...rows[0].r,email};
}
const act = (id:string, action:string, options:object={}) => db.query('select commerce_order_operation($1,$2,$3)',[id,action,JSON.stringify(options)]);
const emails = async (id:string) => (await db.query<{template:string;payload:Record<string,unknown>;related_id:string;reason:string|null}>('select template,payload,related_id,email_delivery_ineligible(e) reason from email_outbox e where payload->>\'order_id\'=$1 order by created_at,id',[id])).rows;

it('creates one correct notification at each milestone, including immediate completion, without replay duplicates', async () => {
  const o=await create();
  expect(await emails(o.orderId)).toMatchObject([{template:'payment_instructions',payload:{order_id:o.orderId,amount_cents:1500,reference:o.orderNumber},reason:null}]);
  await act(o.orderId,'paid'); await act(o.orderId,'paid');
  expect((await emails(o.orderId)).filter(e=>e.template==='order_confirmation')).toHaveLength(1);
  await act(o.orderId,'shipped',{trackingNumber:'TRACK-'+o.orderNumber});
  expect((await emails(o.orderId)).find(e=>e.template==='order_shipped')).toMatchObject({payload:{tracking_number:'TRACK-'+o.orderNumber},reason:null});
  expect((await emails(o.orderId)).filter(e=>e.template==='post_purchase_review')).toHaveLength(0);
  await act(o.orderId,'completed'); await act(o.orderId,'completed');
  const review=(await emails(o.orderId)).filter(e=>e.template==='post_purchase_review');
  expect(review).toHaveLength(1);
  expect(review[0]).toMatchObject({related_id:`${o.orderId}:pp:review`,payload:{order_id:o.orderId,products:['Email fixture']},reason:null});
  expect(review[0].payload.completed_at).toBeTruthy();
});

it('refuses shipment without tracking and keeps the order and email history unchanged',async()=>{
  const o=await create();await act(o.orderId,'paid');
  for(const trackingNumber of [undefined,'','   ']) await expect(act(o.orderId,'shipped',{trackingNumber})).rejects.toThrow(/tracking/i);
  expect((await db.query('select status from orders where id=$1',[o.orderId])).rows[0]).toEqual({status:'paid'});
  expect((await emails(o.orderId)).filter(e=>e.template==='order_shipped')).toHaveLength(0);
});

it('rolls back completion if the completion notification cannot be stored',async()=>{
  const o=await create();await act(o.orderId,'paid');await act(o.orderId,'shipped',{trackingNumber:'TRACK-'+o.orderNumber});
  await db.exec("create function reject_completion_email() returns trigger language plpgsql as $$ begin if new.template='post_purchase_review' then raise exception 'injected completion failure';end if;return new;end $$;create trigger reject_completion_email before insert on email_outbox for each row execute function reject_completion_email();");
  try { await expect(act(o.orderId,'completed')).rejects.toThrow('injected completion failure'); }
  finally {await db.exec('drop trigger reject_completion_email on email_outbox;drop function reject_completion_email();');}
  expect((await db.query('select status from orders where id=$1',[o.orderId])).rows[0]).toEqual({status:'shipped'});
});

it('rechecks consent, pause, refund and completion before authorizing a review email',async()=>{
  const o=await create();await act(o.orderId,'paid');await act(o.orderId,'shipped',{trackingNumber:'TRACK-'+o.orderNumber});
  await db.query("insert into email_outbox(to_email,template,payload,related_id) values($1,'post_purchase_review',$2,'premature')",[o.email,JSON.stringify({order_id:o.orderId})]);
  expect((await emails(o.orderId)).find(e=>e.related_id==='premature')?.reason).toMatch(/completed/i);
  await act(o.orderId,'completed');
  await db.query('update subscribers set unsubscribed_at=now() where email=$1',[o.email]);
  expect((await emails(o.orderId)).find(e=>e.template==='post_purchase_review')?.reason).toMatch(/suppressed/i);
  await db.query('update subscribers set unsubscribed_at=null where email=$1',[o.email]);
  await db.query("insert into sequence_overrides(email,sequence,action,actor_email) values($1,'post_purchase_review','pause','admin@example.test')",[o.email]);
  expect((await emails(o.orderId)).find(e=>e.template==='post_purchase_review')?.reason).toMatch(/paused/i);
  await db.query('delete from sequence_overrides where email=$1',[o.email]);
  await db.query('update orders set refunded_cents=100 where id=$1',[o.orderId]);
  expect((await emails(o.orderId)).find(e=>e.template==='post_purchase_review')?.reason).toMatch(/refund/i);
});

it('sends the first carrier-import shipment even when optional tracking-correction notifications are off',async()=>{
  const o=await create();await act(o.orderId,'paid');
  const preview=await db.query<{r:{token:string}[]}>('select admin_preview_carrier($1) r',[JSON.stringify([{orderNumber:o.orderNumber,trackingNumber:'CARRIER-'+o.orderNumber}])]);
  const tokens=JSON.stringify(preview.rows[0].r.map(row=>row.token));
  for(let i=0;i<2;i++) {
    const result=await db.query<{r:{ok:boolean}[]}>('select admin_commit_carrier($1,false,$2) r',[tokens,'admin@example.test']);
    expect(result.rows[0].r[0].ok).toBe(true);
  }
  expect((await emails(o.orderId)).filter(e=>e.template==='order_shipped')).toMatchObject([{payload:{tracking_number:'CARRIER-'+o.orderNumber},reason:null}]);
});

it('keeps tracking corrections silent unless explicitly requested',async()=>{
  const o=await create();await act(o.orderId,'paid');await act(o.orderId,'shipped',{trackingNumber:'TRACK-'+o.orderNumber,notify:false});
  await act(o.orderId,'tracking',{trackingNumber:'CORRECTED-'+o.orderNumber,notify:false});
  expect((await emails(o.orderId)).filter(e=>e.template==='order_shipped')).toHaveLength(1);
  await act(o.orderId,'tracking',{trackingNumber:'NOTIFIED-'+o.orderNumber,notify:true});
  expect((await emails(o.orderId)).filter(e=>e.template==='order_shipped')).toHaveLength(2);
});

it.each(['queued','cancelled'])('refreshes a never-attempted legacy %s review at completion without creating another identity',async(status)=>{
  const o=await create();await act(o.orderId,'paid');await act(o.orderId,'shipped',{trackingNumber:'TRACK-'+o.orderNumber});
  await db.query("insert into email_outbox(to_email,template,payload,related_id,status,error,rendered_html,rendered_subject) values($1,'post_purchase_review',$2,$3,$4,'Order is not completed','old html','old subject')",[o.email,JSON.stringify({order_id:o.orderId}),`${o.orderId}:pp:review`,status]);
  await act(o.orderId,'completed');
  const reviews=(await emails(o.orderId)).filter(e=>e.template==='post_purchase_review');
  expect(reviews).toHaveLength(1);expect(reviews[0].reason).toBeNull();expect(reviews[0].payload.completed_at).toBeTruthy();
  const stored=await db.query('select status,rendered_html,rendered_subject from email_outbox where related_id=$1',[`${o.orderId}:pp:review`]);
  expect(stored.rows[0]).toEqual({status:'queued',rendered_html:null,rendered_subject:null});
});

it('never rearms or changes an ambiguous provider attempt from the legacy schedule',async()=>{
  const o=await create();await act(o.orderId,'paid');await act(o.orderId,'shipped',{trackingNumber:'TRACK-'+o.orderNumber});
  await db.query("insert into email_outbox(to_email,template,payload,related_id,status,provider_attempted_at,rendered_html) values($1,'post_purchase_review',$2,$3,'failed',now(),'frozen provider body')",[o.email,JSON.stringify({order_id:o.orderId}),`${o.orderId}:pp:review`]);
  await act(o.orderId,'completed');
  const stored=await db.query('select status,payload,rendered_html from email_outbox where related_id=$1',[`${o.orderId}:pp:review`]);
  expect(stored.rows).toEqual([{status:'failed',payload:{order_id:o.orderId},rendered_html:'frozen provider body'}]);
});

it('preserves marketing consent while transactional shipment emails remain eligible',async()=>{
  const o=await create();await db.query('delete from subscribers where email=$1',[o.email]);
  await act(o.orderId,'paid');await act(o.orderId,'shipped',{trackingNumber:'TRACK-'+o.orderNumber});await act(o.orderId,'completed');
  const rows=await emails(o.orderId);
  expect(rows.find(e=>e.template==='post_purchase_review')?.reason).toBe('No active marketing consent');
  expect(rows.find(e=>e.template==='order_shipped')?.reason).toBeNull();
  expect(rows.find(e=>e.template==='order_confirmation')?.reason).toBeNull();
});

it('uses only an arrival check-in for accessory-only orders, and retires old review reminders',async()=>{
  const o=await create();
  await db.exec("update products set categories='[\"accessory\"]'::jsonb where slug='email-fixture'");
  try {
    await act(o.orderId,'paid');await act(o.orderId,'shipped',{trackingNumber:'TRACK-'+o.orderNumber});await act(o.orderId,'completed');
  } finally {await db.exec("update products set categories='[]'::jsonb where slug='email-fixture'");}
  const rows=await emails(o.orderId);
  expect(rows.filter(e=>e.template==='post_purchase_review')).toHaveLength(0);
  expect(rows.find(e=>e.template==='arrival_checkin')?.reason).toBeNull();
  await db.query("insert into email_outbox(to_email,template,payload,related_id) values($1,'post_purchase_review_reminder',$2,'legacy-reminder')",[o.email,JSON.stringify({order_id:o.orderId})]);
  expect((await emails(o.orderId)).find(e=>e.related_id==='legacy-reminder')?.reason).toMatch(/retired/i);
});
