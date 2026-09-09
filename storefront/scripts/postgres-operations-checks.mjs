import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

export async function operationsChecks({db,a,b,scalar,check}){
 await check('operator cancellation cannot override a concurrently claimed delivery lease',async()=>{
  const id=await scalar(db,"insert into email_outbox(to_email,template,payload) values($1,'order_confirmation','{}') returning id result",[`lease-${randomUUID()}@example.test`]);
  const claimPid=await scalar(a,'select pg_backend_pid() result'),operatorPid=await scalar(b,'select pg_backend_pid() result');
  let transactionOpen=false,operation;
  try{
   await a.query('begin');transactionOpen=true;
   const lease=(await a.query('select * from claim_email_outbox(1,$1)',[id])).rows[0];
   assert.equal(lease.id,id);
   operation=b.query("select admin_email_operation($1,'cancel','audit@example.test','Native active-lease cancellation check')",[id]).then(value=>({status:'fulfilled',value}),reason=>({status:'rejected',reason}));
   let blocked=false;
   for(let i=0;i<100;i++){
    if((await scalar(db,'select pg_blocking_pids($1) result',[operatorPid])).includes(claimPid)){blocked=true;break;}
    await delay(20);
   }
   assert(blocked,'Operator must reach the row held by the independent claimant');
   await a.query('commit');transactionOpen=false;
   const outcome=await operation;
   assert.equal(outcome.status,'rejected');assert.match(outcome.reason.message,/Active delivery lease/);
   const row=(await db.query('select status,lease_token,lease_expires_at,attempt_count,provider_attempted_at from email_outbox where id=$1',[id])).rows[0];
   assert.equal(row.status,'sending');assert.equal(row.lease_token,lease.lease_token);
   assert.equal(row.attempt_count,1);assert.equal(row.provider_attempted_at,null);
   assert(row.lease_expires_at.getTime()>Date.now());
  }finally{
   if(transactionOpen)await a.query('rollback');
   if(operation)await operation;
  }
 });
}
