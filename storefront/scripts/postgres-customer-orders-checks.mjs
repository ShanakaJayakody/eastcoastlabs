import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function customerOrderChecks({db,a,b,check,race,fixture,create,orderInput}) {
 await check('concurrent verified customers can claim an order only once',async()=>{
  const email=`claim-${randomUUID()}@example.test`,u1=randomUUID(),u2=randomUUID();
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$3,now()),($2,$3,now())',[u1,u2,email]);
  const variant=await fixture(10);const o=await create(db,orderInput(variant,{email}));
  const results=await race('select id from orders where id=$1 for update',[o.orderId],()=>a.query('select customer_claim_orders($1) n',[u1]),()=>b.query('select customer_claim_orders($1) n',[u2]));
  assert(results.every(r=>r.status==='fulfilled'));assert.equal(results.reduce((n,r)=>n+r.value.rows[0].n,0),1);
  const owner=(await db.query('select customer_user_id from orders where id=$1',[o.orderId])).rows[0].customer_user_id;assert([u1,u2].includes(owner));
 });
 await check('simultaneous code requests share the persistent mailbox throttle',async()=>{
  const email=`otp-${randomUUID()}@example.test`;
  const results=await Promise.allSettled([a.query('select customer_begin_login($1,$2)',[email,'synthetic-a']),b.query('select customer_begin_login($1,$2)',[email,'synthetic-b'])]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 });
 await check('one OTP challenge cannot be reserved by two verification workers',async()=>{
  const email=`verify-${randomUUID()}@example.test`,id=(await db.query('select customer_begin_login($1,$2) id',[email,'synthetic-c'])).rows[0].id;
  const results=await race('select id from customer_login_challenges where id=$1 for update',[id],()=>a.query('select customer_reserve_verification($1)',[id]),()=>b.query('select customer_reserve_verification($1)',[id]));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 });
}
