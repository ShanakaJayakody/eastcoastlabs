import "server-only";
import { adminDb } from "./db";
import { sendImmediately } from "@/lib/email/sender";

/** Commit each recipient's intent atomically before contacting the provider.
 * If this worker exits, the ordinary hourly outbox sweep retries durable rows. */
export async function remindOverdueOrders() {
  const { data, error } = await adminDb().rpc("queue_overdue_order_reminders", { p_limit: 100 });
  if (error) throw new Error(`Cannot queue overdue order reminders: ${error.message}`);
  const rows = (data ?? []) as { outbox_id: string }[];
  let sent = 0, failed = 0, cancelled = 0;
  for (const row of rows) {
    const result = await sendImmediately(row.outbox_id);
    sent += result.sent;
    failed += result.failed;
    cancelled += result.cancelled;
  }
  return { queued: rows.length, sent, failed, cancelled };
}
