import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

/** Additional release races: all helpers target the controller's synthetic DB. */
export async function workflowChecks({db,a,b,scalar,check,race,fixture,orderInput,create,operation}){
 await check('concurrent normalized-email checkouts cannot both consume the last pending slot',async()=>{
  const variant=await fixture(20), email=`mailbox-${randomUUID()}@example.test`;
  for(let i=0;i<4;i++) await create(db,orderInput(variant,{email}));
  const first=orderInput(variant,{email:`  ${email.toUpperCase()}  `}), second=orderInput(variant,{email});
  const results=await race('select pg_advisory_xact_lock(hashtextextended($1,0))',[`checkout-email:${email}`],()=>create(a,first),()=>create(b,second));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.match(results.find(r=>r.status==='rejected').reason.message,/CHECKOUT_RATE_LIMIT/);
  assert.equal(await scalar(db,'select count(*)::int result from orders where customer_email=$1 and status=\'pending\'',[email]),5);
  assert.equal(await scalar(db,'select reserved result from inventory where variant_id=$1',[variant]),5);
  const successfulInput=results[0].status==='fulfilled'?first:second;
  const original=results.find(r=>r.status==='fulfilled').value;
  const replay=await create(db,successfulInput);
  assert.equal(replay.orderId,original.orderId,'Committed attempt must recover despite the mailbox limit');
  assert.equal(await scalar(db,'select reserved result from inventory where variant_id=$1',[variant]),5);
 });
 await check('pack variants contend for the same physical stock pool',async()=>{
  const single=await fixture(5), pack=randomUUID();
  await db.query(`insert into product_variants(id,product_id,sku,pack_size,label,price_cents) select $1,product_id,$2,3,'3-pack',2700 from product_variants where id=$3`,[pack,`AUDIT-${pack}`,single]);
  const results=await race('select * from inventory where variant_id=$1 for update',[single],()=>create(a,orderInput(pack)),()=>create(b,orderInput(pack)));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.match(results.find(r=>r.status==='rejected').reason.message,/OUT_OF_STOCK/);
  assert.equal(await scalar(db,'select reserved result from inventory where variant_id=$1',[single]),3);
 });
 await check('two operators cannot commit the same stale refund preview twice',async()=>{
  const variant=await fixture(1), order=await create(db,orderInput(variant));
  await operation(db,order.orderId,'paid');
  const quote=await scalar(db,'select commerce_refund_quote($1,null,false) result',[order.orderId]);
  const commit=client=>scalar(client,'select commerce_refund_commit($1,null,false,$2,$3,$4) result',[order.orderId,quote.token,randomUUID(),'audit@example.test']);
  const results=await race('select id from orders where id=$1 for update',[order.orderId],()=>commit(a),()=>commit(b));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.match(results.find(r=>r.status==='rejected').reason.message,/REFUND_PREVIEW_STALE/);
  assert.equal(await scalar(db,'select refunded_cents result from orders where id=$1',[order.orderId]),quote.totalCents);
 });
 await check('simultaneous product edits preserve exactly one reviewed revision',async()=>{
  const variant=await fixture();
  const product=(await db.query('select p.id,p.slug,p.edit_version from products p join product_variants v on v.product_id=p.id where v.id=$1',[variant])).rows[0];
  const save=(client,name)=>scalar(client,'select admin_save_product($1,$2,\'[]\',$3,$4) result',[product.slug,JSON.stringify({name}),product.edit_version,'audit@example.test']);
  const results=await race('select id from products where id=$1 for update',[product.id],()=>save(a,'First editor'),()=>save(b,'Second editor'));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.match(results.find(r=>r.status==='rejected').reason.message,/changed in another editor/);
  assert.equal(Number(await scalar(db,'select edit_version result from products where id=$1',[product.id])),Number(product.edit_version)+1);
 });
 await check('simultaneous settings edits reject the stale revision',async()=>{
  const version=await scalar(db,'select version result from settings_revision where singleton');
  const save=(client,cents)=>scalar(client,'select admin_save_settings($1,$2,$3) result',[JSON.stringify({standard_shipping_cents:cents}),version,'audit@example.test']);
  const results=await race('select * from settings_revision for update',[],()=>save(a,900),()=>save(b,1100));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.match(results.find(r=>r.status==='rejected').reason.message,/changed in another editor/);
  assert.equal(Number(await scalar(db,'select version result from settings_revision where singleton')),Number(version)+1);
 });
 await check('receipt reversal cannot rewind stock consumed by a racing sale',async()=>{
  const variant=await fixture(1);
  const receipt=await scalar(db,'select admin_receive_stock($1,1,300,$2,$3) result',[variant,'audit@example.test','Synthetic receipt']);
  const order=await create(db,orderInput(variant,{items:[{variantId:variant,qty:2}]}));
  const results=await race('select * from inventory where variant_id=$1 for update',[variant],()=>operation(a,order.orderId,'paid'),()=>b.query('select admin_reverse_receipt($1,$2)',[receipt.receipt_id,'audit@example.test']));
  assert.equal(results[0].status,'fulfilled');assert.equal(results[1].status,'rejected');
  assert.match(results[1].reason.message,/reserved|Later stock movements/);
  assert.deepEqual((await db.query('select on_hand,reserved from inventory where variant_id=$1',[variant])).rows[0],{on_hand:0,reserved:0});
 });
 await check('webhook arrival racing completion reconciles exact provider and recipient',async()=>{
  const recipient='provider-race@example.test', provider=`synthetic-${randomUUID()}`, event=randomUUID();
  const id=await scalar(db,`insert into email_outbox(to_email,template,payload) values($1,'order_confirmation','{}') returning id result`,[recipient]);
  const lease=(await db.query('select * from claim_email_outbox(1,$1)',[id])).rows[0];
  const results=await race('select pg_advisory_xact_lock(hashtextextended($1,0))',[`email-provider:${provider}:${recipient}`],
   ()=>a.query(`select finish_email_outbox($1,$2,'sent',null,$3)`,[id,lease.lease_token,provider]),
   ()=>b.query(`insert into email_events(to_email,event,provider_event_id,detail) values($1,'delivered',$2,$3)`,[recipient,event,JSON.stringify({message_id:provider})]));
  assert(results.every(r=>r.status==='fulfilled'));
  assert.equal(await scalar(db,'select outbox_id result from email_events where provider_event_id=$1',[event]),id);
  const wrong=await scalar(db,`insert into email_events(to_email,event,provider_event_id,detail) values('different@example.test','delivered',$1,$2) returning outbox_id result`,[randomUUID(),JSON.stringify({message_id:provider})]);
  assert.equal(wrong,null);
 });
 await check('mailbox suppression racing cart confirmation leaves no usable old consent',async()=>{
  const email=`consent-${randomUUID()}@example.test`, id=randomUUID(), hash=randomUUID().replaceAll('-','').repeat(2);
  const cart=JSON.stringify([{key:'synthetic:single',slug:'synthetic',variantLabel:'1 vial',quantity:1}]);
  await db.query('select recovery_request($1,$2,$3,$4::jsonb,1000)',[id,email,hash,cart]);
  const results=await race('select pg_advisory_xact_lock(hashtextextended($1,0))',[`subscription:${email}`],
   ()=>a.query('select recovery_confirm($1)',[hash]),()=>b.query("select suppress_marketing($1,'unsubscribe')",[email]));
  assert(results.every(r=>r.status==='fulfilled'));
  assert.equal(await scalar(db,'select revoked_at is not null result from recovery_requests where id=$1',[id]),true);
  assert.equal(await scalar(db,'select recovery_confirm($1) result',[hash]),null);
  assert.equal(await scalar(db,'select recovery_attribution($1,$2,$3::jsonb) result',[hash,email,cart]),null);
  assert.equal(await scalar(db,"select count(*)::int result from recovery_episodes where email=$1 and state='active'",[email]),0);
  assert(Number(await scalar(db,'select count(*) result from email_outbox where to_email=$1',[email]))>0);
  assert.equal(await scalar(db,'select bool_and(email_delivery_ineligible(e) is not null) result from email_outbox e where to_email=$1',[email]),true);
 });
}
