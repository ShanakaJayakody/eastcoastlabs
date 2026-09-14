import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function customerChecks({ db, a, b, check }) {
  const actor = `admin-${randomUUID()}@example.test`;
  await db.query('insert into admin_users(email) values($1)', [actor]);
  const source = `customer-${randomUUID()}@example.test`;
  const target = `corrected-${randomUUID()}@example.test`;
  const details = { email: target, name: 'Corrected customer', phone: '0400123456', address: { line1: '12 Synthetic Street', suburb: 'Melbourne', state: 'VIC', postcode: '3000', country: 'AU' } };
  await db.query("insert into subscribers(email,source) values($1,'footer')", [source]);
  await db.query("select recovery_capture($1,'[{\"name\":\"Synthetic item\",\"quantity\":1}]',1000)", [source]);
  const save = (client, email, input, version = 0) => client.query('select admin_save_customer($1,$2,$3,$4) result', [email, input, version, actor]);

  await check('customer email correction and concurrent stale editor commit only once', async () => {
    const results = await Promise.allSettled([save(a, source, details), save(b, source, { ...details, name: 'Stale draft' })]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal((await db.query("select count(*)::int n from admin_audit_log where action='customer.update' and entity_id=$1", [target])).rows[0].n, 1);
    assert.deepEqual((await db.query('select email from subscribers where email in ($1,$2)', [source, target])).rows, [{ email: target }]);
  });
  await check('previously delivered unsubscribe links suppress the corrected customer', async () => {
    await db.query('select suppress_marketing($1)', [source]);
    assert((await db.query('select bool_and(unsubscribed_at is not null) suppressed from subscribers where email=$1', [target])).rows[0].suppressed);
  });
  await check('an unsubscribe still suppresses its mailbox if that old address signs up again', async () => {
    await db.query("insert into subscribers(email,source) values($1,'footer')", [source]);
    await db.query("insert into email_outbox(to_email,template,payload,related_type,related_id) values($1,'welcome_1','{}','subscriber',$1||':welcome:1')", [source]);
    await db.query('select suppress_marketing($1)', [source]);
    assert((await db.query('select bool_and(unsubscribed_at is not null) suppressed from subscribers where email=$1', [source])).rows[0].suppressed);
    assert.equal((await db.query('select status from email_outbox where to_email=$1', [source])).rows[0].status, 'cancelled');
  });
  await check('customer correction cannot race an in-flight email claim', async () => {
    const next = `next-${randomUUID()}@example.test`;
    const message = (await db.query("insert into email_outbox(to_email,template,payload,related_type,related_id) values($1,'welcome_3','{}','subscriber',$1||':welcome:3') returning id", [target])).rows[0].id;
    await a.query('begin');
    try {
      await a.query("update email_outbox set status='sending' where id=$1", [message]);
      await assert.rejects(save(b, target, { ...details, email: next }, 1), /activity is in progress/);
      assert.equal((await db.query('select email from customer_profiles where email=$1', [target])).rows[0].email, target);
    } finally { await a.query('rollback'); }
  });
}
