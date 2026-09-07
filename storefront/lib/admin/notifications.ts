import 'server-only';
import { adminDb } from './db';

/** Request claim and durable outbox insertion commit in one transaction. The
 * sender adds a fresh unsubscribe URL and rechecks current request/stock state. */
export async function queueBackInStock(variantId:string):Promise<number> {
  const {data,error}=await adminDb().rpc('queue_back_in_stock',{p_variant:variantId});
  if(error)throw new Error(`Cannot queue stock notifications: ${error.message}`);
  if(typeof data!=='number'||!Number.isSafeInteger(data)||data<0)throw new Error('Invalid stock notification result');
  return data;
}

/** Failed reads must not masquerade as an empty waitlist. */
export async function waitlistCount(productSlug:string):Promise<number> {
  const {count,error}=await adminDb().from('stock_notifications').select('*',{count:'exact',head:true})
    .eq('product_slug',productSlug).eq('notified',false);
  if(error)throw new Error(`Cannot read waitlist count: ${error.message}`);
  if(count===null)throw new Error('Missing waitlist count');
  return count;
}
