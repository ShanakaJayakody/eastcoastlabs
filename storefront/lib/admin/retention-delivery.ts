import 'server-only';
import { adminDb } from './db';
import { RETENTION_TEMPLATES } from './retention-policy';
import type { EmailTemplate } from './email';
const REVIEW_TEMPLATES: readonly EmailTemplate[] = ['arrival_checkin', 'post_purchase_review', 'post_purchase_review_reminder'];
/** Additional checks against source-order changes before optional lifecycle mail.
 * Existing database authorization remains authoritative for consent and operator pauses. */
export async function retentionDeliveryReason(email: string, template: EmailTemplate, payload: Record<string, unknown>): Promise<string | null> {
    const retention = RETENTION_TEMPLATES.includes(template), review = REVIEW_TEMPLATES.includes(template);
    if (!retention && !review)
        return null;
    const db = adminDb();
    if (template === 'replenishment' || review) {
        let query = db.from('orders').select('id,status,refunded_cents,shipped_at').eq('customer_email', email);
        if (typeof payload.order_id === 'string')
            query = query.eq('id', payload.order_id);
        else if (review && typeof payload.order_number === 'string')
            query = query.eq('order_number', payload.order_number);
        else
            return 'Lifecycle source order unavailable';
        const { data: order, error } = await query.maybeSingle();
        if (error)
            throw new Error(`Cannot verify lifecycle source order: ${error.message}`);
        if (!order || !order.shipped_at || !['shipped', 'completed'].includes(order.status))
            return 'Lifecycle source order is not fulfilled';
        if (order.refunded_cents > 0)
            return 'Lifecycle source order was refunded';
    }
    if (!retention)
        return null;
    const { data: latest, error } = await db.from('orders').select('id,status,refunded_cents').eq('customer_email', email).neq('status', 'cancelled').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
    if (error)
        throw new Error(`Cannot verify latest order: ${error.message}`);
    if (!latest)
        return 'Lifecycle source order unavailable';
    if (latest.refunded_cents > 0 || latest.status === 'refunded')
        return 'Latest order was refunded';
    if (!['shipped', 'completed'].includes(latest.status))
        return 'Latest order is unpaid or unfulfilled';
    if (template === 'replenishment' && latest.id !== payload.order_id)
        return 'Customer placed a newer order';
    return null;
}
