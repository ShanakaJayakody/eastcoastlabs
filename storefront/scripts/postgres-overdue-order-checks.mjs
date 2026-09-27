import assert from 'node:assert/strict';

export async function overdueOrderChecks({ db, a, b, check, race }) {
  await check('concurrent overdue sweeps enqueue one priority reminder per active admin', async () => {
    const id = (await db.query("insert into orders(customer_email,status,created_at,paid_at) values('overdue-race@example.test','paid',now()-interval '48 hours',now()-interval '25 hours') returning id")).rows[0].id;
    const admins = (await db.query('select count(distinct lower(trim(email)))::int n from admin_users where active')).rows[0].n;
    assert(admins > 0);
    const results = await race("select pg_advisory_xact_lock(hashtextextended('overdue-order-reminders',0))", [],
      () => a.query('select * from queue_overdue_order_reminders()'),
      () => b.query('select * from queue_overdue_order_reminders()'));
    assert(results.every(result => result.status === 'fulfilled'));
    assert.equal(results.reduce((sum, result) => sum + result.value.rowCount, 0), admins);
    const queued = await db.query("select * from email_outbox where template='admin_order_overdue' and payload->>'order_id'=$1", [id]);
    assert.equal(queued.rowCount, admins);
    assert.equal(new Set(queued.rows.map(row => row.to_email)).size, admins);
    await db.query("update orders set status='shipped' where id=$1", [id]);
    const eligibility = await db.query("select email_delivery_ineligible(e) reason from email_outbox e where template='admin_order_overdue' and payload->>'order_id'=$1", [id]);
    assert(eligibility.rows.every(row => /no longer overdue/i.test(row.reason)));
  });
}
