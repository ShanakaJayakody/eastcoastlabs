import 'server-only';
import { getCustomerSession } from './server';
import { supabaseAdmin } from '@/lib/supabase';
/** Optional post-commit work. History/sign-in safely retries this exact-email claim. */
export async function claimCheckoutOrders(email: string): Promise<void> {
  try {
    const session = await getCustomerSession();
    if (!session || session.email !== email.trim().toLowerCase()) return;
    const db = supabaseAdmin();
    if (db) await db.rpc('customer_claim_orders', { p_user: session.userId });
  } catch { /* A committed checkout must remain successful if Auth is down. */ }
}
