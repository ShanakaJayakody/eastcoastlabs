import 'server-only';
import { after } from 'next/server';
import { adminDb } from '@/lib/admin/db';

/** The transaction has already stored notification intent. Scheduling or provider
 * failure must never turn a committed order into an apparent failed checkout. */
function schedule(resolveOrders: () => Promise<string[]>): void {
  try {
    after(async () => {
      try {
        const { dispatchOrderEmails } = await import('./sender');
        for (const id of new Set(await resolveOrders())) {
          await dispatchOrderEmails(id).catch(() => console.error('Order email awaits outbox retry'));
        }
      } catch {
        console.error('Order email dispatch awaits outbox retry');
      }
    });
  } catch {
    // Maintenance scripts have no response lifecycle; durable intent stays queued.
    console.error('Order email scheduling unavailable; outbox retry required');
  }
}

export function scheduleOrderEmails(orderId: string): void {
  schedule(async () => [orderId]);
}

export function scheduleCarrierEmails(tokens: string[]): void {
  if (!tokens.length) return;
  schedule(async () => {
    const {data,error}=await adminDb().from('carrier_previews').select('order_id').in('token',tokens);
    if(error) throw new Error('Cannot resolve committed carrier orders');
    return (data ?? []).map(row => row.order_id as string);
  });
}
