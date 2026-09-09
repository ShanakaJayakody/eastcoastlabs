import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

/** Exact suppression/sweep interleaving, using barriers only in the disposable DB. */
export async function recoveryChecks({db,a,b,scalar,check}) {
 await check('manual reminder dedupe cannot deadlock suppression against the sweep',async()=>{
  const email=`sweep-${randomUUID()}@example.test`, id=randomUUID(), hash=randomUUID().replaceAll('-','').repeat(2);
  const cart=JSON.stringify([{key:'synthetic:single',slug:'synthetic',variantLabel:'1 vial',quantity:1}]);
  await db.query('select recovery_request($1,$2,$3,$4::jsonb,1000)',[id,email,hash,cart]);
  const confirmed=await scalar(db,'select recovery_confirm($1) result',[hash]);
  await db.query("update cart_sessions set updated_at=now()-interval '2 hours' where email=$1",[email]);
  const manual=await scalar(db,'select recovery_manual_payload($1,$2,1) result',[email,confirmed.episode_id]);
  assert(manual?.payload,'Synthetic confirmed cart must allow a manual stage');
  await db.query("insert into email_outbox(to_email,template,payload,related_type,related_id) values($1,'abandoned_cart',$2,'cart_session',$3)",[email,JSON.stringify(manual.payload),manual.related_id]);
  const suppressDefinition=await scalar(db,"select pg_get_functiondef('suppress_marketing(text,text)'::regprocedure) result");
  const queueDefinition=await scalar(db,"select pg_get_functiondef('recovery_queue_due(integer)'::regprocedure) result");
  const suppressMarker='perform suppress_marketing_before_recovery(p_email,p_source);';
  const queueMarker="template_name:=case stage when 1 then 'abandoned_cart' when 2 then 'abandoned_cart_2' else 'abandoned_cart_3' end;";
  assert(suppressDefinition.includes(suppressMarker));assert(queueDefinition.includes(queueMarker));
  const suppressGate=8220101, queueGate=8220102;
  const controller=await scalar(db,'select pg_backend_pid() result'), suppressPid=await scalar(a,'select pg_backend_pid() result'), queuePid=await scalar(b,'select pg_backend_pid() result');
  const blockers=pid=>scalar(db,'select pg_blocking_pids($1) result',[pid]);
  async function until(probe,label){for(let i=0;i<100;i++){if(await probe())return;await delay(20);}throw new Error(`Missing deterministic barrier: ${label}`);}
  let suppression, sweep, sweepDone=false;
  try{
   await db.query(suppressDefinition.replace(suppressMarker,`${suppressMarker}\n if p_email='${email}' then perform pg_advisory_xact_lock(${suppressGate});end if;`));
   await db.query(queueDefinition.replace(queueMarker,`${queueMarker}\n if cart.email='${email}' then perform pg_advisory_xact_lock(${queueGate});end if;`));
   await db.query('select pg_advisory_lock($1),pg_advisory_lock($2)',[suppressGate,queueGate]);
   sweep=b.query('select recovery_queue_due(200)').then(value=>({status:'fulfilled',value}),reason=>({status:'rejected',reason})).finally(()=>{sweepDone=true;});
   await until(async()=>(await blockers(queuePid)).includes(controller),'sweep holds cart before its insert');
   suppression=a.query("select suppress_marketing($1,'unsubscribe')",[email]).then(value=>({status:'fulfilled',value}),reason=>({status:'rejected',reason}));
   await until(async()=>{const waits=await blockers(suppressPid);return waits.includes(controller)||waits.includes(queuePid);},'suppression reaches cancellation gate or waits for the cart');
   await db.query('select pg_advisory_unlock($1)',[queueGate]);
   await until(async()=>sweepDone||(await blockers(queuePid)).includes(suppressPid),'sweep completes or waits on the cancelled dedupe row');
   await db.query('select pg_advisory_unlock($1)',[suppressGate]);
   const outcomes=await Promise.all([suppression,sweep]);
   for(const outcome of outcomes)assert.equal(outcome.status,'fulfilled',`Canonical concurrent calls must both commit: ${outcome.reason?.code} ${outcome.reason?.message}`);
   assert.equal(await scalar(db,'select recovery_confirm($1) result',[hash]),null);
   assert.equal(await scalar(db,'select recovery_attribution($1,$2,$3::jsonb) result',[hash,email,cart]),null);
   assert.equal(await scalar(db,'select revoked_at is not null result from recovery_requests where id=$1',[id]),true);
   assert.equal(await scalar(db,"select state result from recovery_episodes where id=$1",[confirmed.episode_id]),'stopped');
   assert.equal(await scalar(db,"select status result from cart_sessions where email=$1",[email]),'abandoned');
   assert.equal(await scalar(db,"select count(*)::int result from email_outbox where to_email=$1 and template='abandoned_cart'",[email]),1);
   assert.equal(await scalar(db,"select status result from email_outbox where to_email=$1 and template='abandoned_cart'",[email]),'cancelled');
   assert.equal(await scalar(db,'select bool_and(email_delivery_ineligible(e) is not null) result from email_outbox e where to_email=$1',[email]),true);
  }finally{
   await db.query('select pg_advisory_unlock($1),pg_advisory_unlock($2)',[suppressGate,queueGate]);
   await Promise.allSettled([suppression,sweep].filter(Boolean));
   await db.query(suppressDefinition);await db.query(queueDefinition);
  }
 });
}
