import assert from 'node:assert/strict';

export async function adminSmsChecks({db,a,b,check}) {
  const phone='61400000091';
  const queueSql=`select enqueue_admin_sms((now() at time zone 'Australia/Melbourne')::date,
    'Synthetic director update',2,'61400000099',$1,$2::jsonb,now()+interval '2 hours','{}'::jsonb) queued`;
  const params=['a'.repeat(64),JSON.stringify([{contactId:901,name:'Synthetic director',phone}])];
  await db.query('update admin_sms_settings set enabled=true');
  try {
    await check('SMS concurrent daily enqueue and duplicate contacts create one intent',async()=>{
      const results=await Promise.all([a.query(queueSql,params),b.query(queueSql,params)]);
      assert.equal(results.reduce((n,r)=>n+r.rows[0].queued,0),1);
      assert.equal((await db.query('select * from admin_sms_outbox where to_phone=$1',[phone])).rowCount,1);
    });
    await check('SMS competing workers obtain one lease and a stable retry identity',async()=>{
      const sql="select * from claim_admin_sms((now() at time zone 'Australia/Melbourne')::date)";
      const results=await Promise.all([a.query(sql),b.query(sql)]);
      const claimed=results.flatMap(r=>r.rows); assert.equal(claimed.length,1);
      const r=claimed[0];
      await db.query('select authorize_admin_sms($1,$2,$3,$4)',[r.id,r.lease_token,[phone],params[0]]);
      await db.query("update admin_sms_outbox set lease_until=now()-interval '1 second' where id=$1",[r.id]);
      const retry=(await b.query(sql)).rows[0];
      assert.equal(retry.idempotency_key,r.idempotency_key); assert.equal(retry.body,r.body);
      await db.query('update admin_sms_settings set enabled=false');
      assert.equal((await a.query('select authorize_admin_sms($1,$2,$3,$4) allowed',[r.id,retry.lease_token,[phone],params[0]])).rows[0].allowed,false);
      await db.query('update admin_sms_settings set enabled=true');
      await db.query('select authorize_admin_sms($1,$2,$3,$4)',[r.id,retry.lease_token,[phone],params[0]]);
      await a.query("select report_admin_sms($1,'native-sms-message',$2,1,2,'delivered')",[r.id,phone]);
      await b.query("select finish_admin_sms($1,$2,'accepted','native-sms-message',2,null)",[r.id,retry.lease_token]);
      assert.equal((await db.query('select status from admin_sms_outbox where id=$1',[r.id])).rows[0].status,'accepted');
      await a.query("select report_admin_sms($1,'native-sms-message',$2,2,2,'delivered')",[r.id,phone]);
      assert.equal((await db.query('select status from admin_sms_outbox where id=$1',[r.id])).rows[0].status,'delivered');
      assert.equal((await b.query(sql)).rowCount,0);
    });
  } finally {
    await db.query('delete from admin_sms_outbox where to_phone=$1',[phone]);
    await db.query('update admin_sms_settings set enabled=false');
  }
}
