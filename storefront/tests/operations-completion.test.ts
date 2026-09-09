import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync} from 'node:fs';
import {beforeAll,afterAll,it,expect} from 'vitest';
let db:PGlite;
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create role managed_probe_owner;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean);
 grant select on storage.buckets to anon;
 create table public.managed_probe(id int);alter table public.managed_probe owner to managed_probe_owner;grant truncate on public.managed_probe to anon;
 alter default privileges for role managed_probe_owner grant execute on functions to anon;
 alter default privileges grant all on tables to public,anon,authenticated,service_role;
 alter default privileges in schema public grant all on tables to public,anon,authenticated,service_role;
 alter default privileges in schema public grant execute on functions to public,anon,authenticated,service_role;
 alter default privileges grant all on sequences to anon,authenticated,service_role;
 alter default privileges grant execute on functions to anon,authenticated,service_role;`);
 for(const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
 await db.exec("insert into products(id,slug,name,status) values('10000000-0000-0000-0000-000000000091','refund-fixture','Refund fixture','active');insert into product_variants(id,product_id,sku,pack_size,label,price_cents) values('20000000-0000-0000-0000-000000000091','10000000-0000-0000-0000-000000000091','REFUND-FIXTURE',1,'1 vial',1000);insert into stock_movements(variant_id,qty,reason) values('20000000-0000-0000-0000-000000000091',9,'received')");
});
afterAll(async()=>{await db.close()});
async function message(status='queued') {return (await db.query<{id:string}>("insert into email_outbox(to_email,template,payload,status) values('ops@example.test','admin_daily_brief','{}',$1) returning id",[status])).rows[0].id;}
async function control(id:string,action:string,provider:string|null=null){return db.query('select admin_email_operation($1,$2,$3,$4,$5)',[id,action,'operator@example.test','Checked synthetic provider record',provider]);}
it('cancels unattempted intent but refuses active leases and ambiguous provider contact',async()=>{
 const id=await message();await control(id,'cancel');expect((await db.query('select status from email_outbox where id=$1',[id])).rows[0]).toEqual({status:'cancelled'});
 const active=await message();await db.query('select * from claim_email_outbox(1,$1)',[active]);await expect(control(active,'cancel')).rejects.toThrow(/lease/i);
 await db.query("update email_outbox set lease_expires_at=now()-interval '1 second',provider_attempted_at=now() where id=$1",[active]);await expect(control(active,'cancel')).rejects.toThrow(/reconcil/i);
});
it('retry preserves frozen identity, backoff and budget; old or spent sends require reconciliation',async()=>{
 await db.exec("insert into admin_users(email) values('ops@example.test')");
 const id=await message('failed');await db.query("update email_outbox set rendered_tag=id::text,rendered_from='Ops <ops@example.test>',rendered_subject='Frozen',rendered_html='<p>Frozen</p>',provider_attempted_at=now(),first_attempt_at=now(),attempt_count=2,next_attempt_at=now()+interval '1 hour' where id=$1",[id]);
 await expect(control(id,'retry')).rejects.toThrow(/backoff/i);
 await db.query('update email_outbox set next_attempt_at=now() where id=$1',[id]);await control(id,'retry');
 expect((await db.query('select id,rendered_subject,rendered_html,attempt_count,status from email_outbox where id=$1',[id])).rows[0]).toEqual({id,rendered_subject:'Frozen',rendered_html:'<p>Frozen</p>',attempt_count:2,status:'queued'});
 for(const clause of ["first_attempt_at=now()-interval '23 hours'",'attempt_count=6']){
  await db.query(`update email_outbox set status='dead',${clause} where id=$1`,[id]);await expect(control(id,'retry')).rejects.toThrow(/reconcil|budget/i);
 }
});
it('reconciliation requires recorded exact provider identity; recipient-only evidence is insufficient',async()=>{
 const id=await message('dead');await db.query("update email_outbox set provider_attempted_at=now(),first_attempt_at=now()-interval '25 hours' where id=$1",[id]);
 await expect(control(id,'reconcile','provider-ops')).rejects.toThrow(/evidence|identity/i);
 await db.exec(`insert into email_events(to_email,event,detail,provider_event_id) values('ops@example.test','delivered','{"message_id":"provider-ops"}','event-ops')`);
 await expect(control(id,'reconcile','provider-ops')).rejects.toThrow(/evidence|identity/i);
 await db.query("update email_outbox set provider_message_id='provider-ops' where id=$1",[id]);await db.query("update email_events set outbox_id=$1 where provider_event_id='event-ops'",[id]);
 await control(id,'reconcile','provider-ops');await control(id,'reconcile','provider-ops');
 expect((await db.query('select status,provider_message_id from email_outbox where id=$1',[id])).rows[0]).toEqual({status:'sent',provider_message_id:'provider-ops'});
});
it('creates and launches product bundles atomically and records opening pool stock once',async()=>{
 const input={slug:'atomic-sample',sku:'ATOMIC',name:'Atomic sample',status:'active',variants:[{pack_size:1,label:'1 vial',price_cents:1000},{pack_size:3,label:'3-pack',price_cents:2700}],initialStock:9};
 const create=(body:unknown)=>db.query('select admin_create_product($1,$2)',[JSON.stringify(body),'operator@example.test']);
 await expect(create({...input,variants:[...input.variants,{pack_size:1,label:'duplicate',price_cents:5}]})).rejects.toThrow();
 expect((await db.query("select * from products where slug='atomic-sample'")).rows).toHaveLength(0);
 await create(input);expect((await db.query("select sum(on_hand)::int n from inventory join product_variants v on v.id=variant_id join products p on p.id=v.product_id where p.slug='atomic-sample'")).rows[0]).toEqual({n:9});
 await db.exec("insert into products(slug,name,sku,status) values('atomic-launch','Launch','LAUNCH','coming_soon')");
 await expect(db.query("select admin_launch_product('atomic-launch',$1,4,true,'operator@example.test')",[JSON.stringify([{pack_size:1,label:'1 vial',price_cents:100},{pack_size:3,label:'bad',price_cents:-1}])])).rejects.toThrow();
 expect((await db.query("select status from products where slug='atomic-launch'")).rows[0]).toEqual({status:'coming_soon'});
 expect((await db.query("select v.id from product_variants v join products p on p.id=v.product_id where p.slug='atomic-launch'")).rows).toHaveLength(0);
 await db.query("select admin_launch_product('atomic-launch',$1,4,true,'operator@example.test')",[JSON.stringify(input.variants)]);
 await expect(db.query("select admin_launch_product('atomic-launch',$1,4,true,'operator@example.test')",[JSON.stringify(input.variants)])).rejects.toThrow(/already/i);
});
it('records actual net goods and final shipping once with immutable original analytics identity',async()=>{
 const variant=(await db.query<{id:string}>("select v.id from product_variants v join products p on p.id=v.product_id where p.slug='refund-fixture' and pack_size=1")).rows[0]?.id;
 expect(variant).toBeTruthy();
 const order=(await db.query<{r:{orderId:string;orderNumber:string}}>('select commerce_create_order($1) r',[JSON.stringify({email:'refund@example.test',analyticsClientId:'123.456',items:[{variantId:variant,qty:3}],shippingCents:500,discountCode:'WELCOME10'})])).rows[0].r;
 await db.query("select commerce_order_operation($1,'paid','{}')",[order.orderId]);
 const item=(await db.query<{id:string}>('select id from order_items where order_id=$1',[order.orderId])).rows[0].id;
 const partial=JSON.stringify({refunds:[{itemId:item,qty:1}],idempotencyKey:'refund-one',restock:false});
 await db.query("select commerce_order_operation($1,'refund_items',$2)",[order.orderId,partial]);await db.query("select commerce_order_operation($1,'refund_items',$2)",[order.orderId,partial]);
 await db.query("select commerce_order_operation($1,'refunded','{}')",[order.orderId]);
 const refunds=(await db.query<{payload:{events:{params:{value:number;shipping:number}}[]};id:string}>("select id,payload from paid_analytics_outbox where order_id=$1 and event_kind='refund'",[order.orderId])).rows;
 expect(refunds.map(r=>r.payload.events[0].params).sort((a,b)=>a.value-b.value)).toEqual([{transaction_id:order.orderNumber,currency:'AUD',value:9,shipping:0},{transaction_id:order.orderNumber,currency:'AUD',value:18,shipping:5}]);
 expect(JSON.stringify(refunds)).not.toContain('refund@example.test');
 await expect(db.query("update paid_analytics_outbox set payload='{}' where id=$1",[refunds[0].id])).rejects.toThrow(/immutable/i);
 expect((await db.query("select * from refund_analytics_reconciliation() where order_id=$1",[order.orderId])).rows[0]).toMatchObject({recorded_refund_cents:3200,event_refund_cents:3200,queued_refund_cents:3200,unexplained_cents:0});
});
it('removes hostile inherited and default ACLs while preserving safe reads and deliberate helper revocations',async()=>{
 for(const role of ['anon','authenticated','service_role'])for(const permission of ['TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'])expect((await db.query<{ok:boolean}>("select has_table_privilege($1,'refund_settlements',$2) ok",[role,permission])).rows[0].ok).toBe(false);
 for(const role of ['anon','authenticated']){
  await db.exec(`set role ${role}`);try{await expect(db.exec('truncate refund_settlements')).rejects.toThrow(/permission/i);await expect(db.exec('select reserve_stock(gen_random_uuid(),1)')).rejects.toThrow(/permission/i);await db.exec('select id,author from reviews;select * from coa_batches');}finally{await db.exec('reset role');}
 }
 expect((await db.query<{ok:boolean}>("select has_function_privilege('service_role','suppress_marketing_before_recovery(text,text)','execute') ok")).rows[0].ok).toBe(false);
 await db.exec('create table public.operations_default_probe(id int);create function public.operations_default_probe() returns int language sql as $$ select 1 $$');
 for(const role of ['anon','authenticated','service_role'])expect((await db.query<{ok:boolean}>("select has_table_privilege($1,'operations_default_probe','truncate') ok",[role])).rows[0].ok).toBe(false);
 for(const role of ['anon','authenticated'])expect((await db.query<{ok:boolean}>("select has_function_privilege($1,'operations_default_probe()','execute') ok",[role])).rows[0].ok).toBe(false);
 expect((await db.query<{ok:boolean}>("select has_table_privilege('anon','managed_probe','truncate') ok")).rows[0].ok).toBe(true);
 expect((await db.query<{ok:boolean}>("select has_table_privilege('anon','storage.buckets','select') ok")).rows[0].ok).toBe(true);
 expect((await db.query<{n:number}>("select count(*)::int n from pg_default_acl d, lateral aclexplode(d.defaclacl) a where defaclrole=(select oid from pg_roles where rolname='managed_probe_owner') and a.grantee=(select oid from pg_roles where rolname='anon') and privilege_type='EXECUTE'")).rows[0].n).toBe(1);
 await db.exec('set role service_role');try{await db.exec('select refund_analytics_reconciliation();select recovery_stop(\'absent@example.test\')');}finally{await db.exec('reset role');}
});
it('retains refund event evidence without analytics identity and settlements never enqueue a second refund',async()=>{
 const variant=(await db.query<{id:string}>("select v.id from product_variants v join products p on p.id=v.product_id where p.slug='refund-fixture' and pack_size=1")).rows[0].id;
 const order=(await db.query<{r:{orderId:string}}>('select commerce_create_order($1) r',[JSON.stringify({email:'no-identity@example.test',items:[{variantId:variant,qty:1}],shippingCents:500})])).rows[0].r.orderId;
 await db.query("select commerce_order_operation($1,'paid','{}')",[order]);await db.query("select commerce_order_operation($1,'refunded','{}')",[order]);
 expect((await db.query('select * from paid_analytics_outbox where order_id=$1',[order])).rows).toHaveLength(0);
 expect((await db.query('select * from refund_analytics_reconciliation() where order_id=$1',[order])).rows[0]).toMatchObject({recorded_refund_cents:1500,event_refund_cents:1500,queued_refund_cents:0,unexplained_cents:0});
 await db.query("select commerce_refund_settle($1,1500,'SYNTHETIC',current_date,'settle','operator@example.test')",[order]);
 expect((await db.query("select * from commerce_events where order_id=$1 and kind='refunded'",[order])).rows).toHaveLength(1);
 await expect(db.query("update commerce_events set payload='{}' where order_id=$1 and kind='refunded'",[order])).rejects.toThrow(/immutable/i);
 await expect(db.query("delete from commerce_events where order_id=$1 and kind='refunded'",[order])).rejects.toThrow(/immutable/i);
});
it('rechecks reconciliation proof under lock and never reassigns a provider identity',async()=>{
 const id=await message('dead');await db.query("update email_outbox set provider_attempted_at=now(),rendered_tag=id::text,rendered_from='Original <original@example.test>',rendered_subject='Subject',rendered_html='Frozen html' where id=$1",[id]);
 const snapshot=async(target:string)=>(await db.query<{p:unknown}>("select jsonb_build_object('to',to_email,'from',rendered_from,'subject',rendered_subject,'html',rendered_html,'tag',rendered_tag,'provider_attempted_at',provider_attempted_at,'status',status,'lease_token',lease_token) p from email_outbox where id=$1",[target])).rows[0].p;
 const original=await snapshot(id);
 await db.query("update email_outbox set status='sending',lease_token=gen_random_uuid(),lease_expires_at=now()+interval '1 minute' where id=$1",[id]);
 await expect(db.query("select admin_reconcile_email($1,'repaired-provider',$2,'operator@example.test','proof')",[id,JSON.stringify(original)])).rejects.toThrow(/lease/i);
 await db.query("update email_outbox set status='dead',lease_token=null,lease_expires_at=null,rendered_html='New html' where id=$1",[id]);
 await expect(db.query("select admin_reconcile_email($1,'repaired-provider',$2,'operator@example.test','proof')",[id,JSON.stringify(original)])).rejects.toThrow(/changed/i);
 await db.query("select admin_reconcile_email($1,'repaired-provider',$2,'operator@example.test','proof')",[id,JSON.stringify(await snapshot(id))]);
 const other=await message('dead');await db.query("update email_outbox set provider_attempted_at=now(),rendered_tag=id::text,rendered_from='Original <original@example.test>',rendered_subject='Subject',rendered_html='New html' where id=$1",[other]);
 await expect(db.query("select admin_reconcile_email($1,'repaired-provider',$2,'operator@example.test','proof')",[other,JSON.stringify(await snapshot(other))])).rejects.toThrow(/already/i);
 expect((await db.query("select count(*)::int n from email_outbox where provider_message_id='repaired-provider'")).rows[0]).toEqual({n:1});
});
it('freezes the sender before authorization and rejects invented historical sender identity',async()=>{
 const id=await message();const lease=(await db.query<{lease_token:string}>('select * from claim_email_outbox(1,$1)',[id])).rows[0].lease_token;
 const prepare=async(sender:string)=>(await db.query<{p:unknown}>("select prepare_email_delivery_v2($1,$2,'Subject','Body',$3) p",[id,lease,sender])).rows[0].p;
 expect(await prepare('Original')).toEqual({subject:'Subject',html:'Body',from:'Original',tag:id});expect(await prepare('Changed')).toEqual({subject:'Subject',html:'Body',from:'Original',tag:id});
 await db.query('update email_outbox set provider_attempted_at=now(),rendered_from=null where id=$1',[id]);await expect(prepare('Guess')).rejects.toThrow(/Historical sender/i);
});
it('suppressed recovery consent cannot be restored by an operator retry',async()=>{
 const request='00000000-0000-0000-0000-000000000091';const hash='a'.repeat(64);const email='operations-recovery@example.test';
 const cart=[{key:'sample:1',slug:'sample',name:'Sample',variantLabel:'1 vial',quantity:1,unitPriceCents:1000,lineTotalCents:1000,isGift:false}];
 await db.query('select recovery_request($1,$2,$3,$4,1000)',[request,email,hash,JSON.stringify(cart)]);
 const episode=(await db.query<{p:{episode_id:string}}>('select recovery_confirm($1) p',[hash])).rows[0].p.episode_id;
 const payload=(await db.query<{p:{payload:unknown;related_id:string}}>('select recovery_manual_payload($1,$2,1) p',[email,episode])).rows[0].p;
 const id=(await db.query<{id:string}>("insert into email_outbox(to_email,template,payload,related_id,status) values($1,'abandoned_cart',$2,$3,'failed') returning id",[email,JSON.stringify(payload.payload),payload.related_id])).rows[0].id;
 await db.query('select recovery_stop($1)',[email]);await expect(control(id,'retry')).rejects.toThrow(/ineligible/i);
 expect((await db.query('select recovery_confirm($1) p',[hash])).rows[0]).toEqual({p:null});
});

it('never reclaims a refund after an abandoned lease or a recorded transport failure',async()=>{
 const id=(await db.query<{id:string}>("select id from paid_analytics_outbox where event_kind='refund' limit 1")).rows[0].id;
 await db.exec("update paid_analytics_outbox set status='accepted'");
 for(const status of ['sending','failed']){
  await db.query("update paid_analytics_outbox set status=$2,attempts=1,lease_token=gen_random_uuid(),lease_expires_at=now()-interval '1 minute',next_attempt_at=now() where id=$1",[id,status]);
  expect((await db.query('select * from claim_paid_analytics()')).rows).toHaveLength(0);
  expect((await db.query('select status from paid_analytics_outbox where id=$1',[id])).rows[0]).toEqual({status:'dead'});
 }
});

it('only exposes verified COA records through the anonymous database interface',async()=>{
 await db.exec("insert into coa_batches(batch_id,compound,purity_pct,test_date,coa_url,document_verified_at) values('OPS-UNVERIFIED','Fixture',99,current_date,'https://example.test/coa.pdf',null),('OPS-VERIFIED','Fixture',99,current_date,'https://example.test/coa.pdf',now()),('OPS-MISSING','Fixture',99,current_date,null,now()),('OPS-EMPTY-AUTHORITY','Fixture',99,current_date,'https://',now()),('OPS-WHITESPACE-AUTHORITY','Fixture',99,current_date,'https:// /coa.pdf',now()),('OPS-WHITESPACE-PATH','Fixture',99,current_date,'https://example.test/coa file.pdf',now()),('OPS-MALFORMED-AUTHORITY','Fixture',99,current_date,'https://-invalid.test/coa.pdf',now()),('OPS-INVALID-PORT','Fixture',99,current_date,'https://example.test:65536/coa.pdf',now()),('OPS-PORT','Fixture',99,current_date,'https://docs.example.test:8443/coa%20file.pdf?download=1#page=1',now())");
 await db.exec('set role anon');try{expect((await db.query("select batch_id from coa_batches where batch_id like 'OPS-%' order by batch_id")).rows).toEqual([{batch_id:'OPS-PORT'},{batch_id:'OPS-VERIFIED'}]);}finally{await db.exec('reset role');}
});
