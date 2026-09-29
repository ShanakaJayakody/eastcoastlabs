import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCustomerOrder } from '@/lib/customer-orders/queries';
import { customerAccountsEnabled, customerOrdersEnabled } from '@/lib/customer-orders/flags';
import { instructionsForOrder } from '@/lib/payments';
import PaymentInstructionsPanel from '@/components/PaymentInstructions';
import RefreshStatus from '@/components/customer-orders/RefreshStatus';
import OrderReceipt, { orderDate } from '@/components/customer-orders/OrderReceipt';
export const metadata: Metadata = { title: 'Your order' };
export default async function CustomerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  if (!customerOrdersEnabled()) notFound();
  const { id } = await params;
  const order = await getCustomerOrder(id);
  if (!order) redirect(`/account/sign-in?returnTo=${encodeURIComponent(`/orders/${id}`)}&link=unavailable`);
  const instructions = order.status.showPayment ? await instructionsForOrder({ method: order.payment.method, reference: order.payment.reference, amountCents: order.totals.totalCents }) : null;
  return <div className="co-receipt"><div className="co-page-heading"><div><p className="co-eyebrow">Your order</p><h1>{order.number}</h1><p>Placed {orderDate(order.createdAt)}</p></div><Link className="co-secondary" href="/shop">Continue shopping</Link></div>
    <OrderReceipt order={order} />
    {order.status.showPayment && <section className="co-card"><h2>Complete your payment</h2><p>Payment deadline: {new Date(order.payment.expiresAt!).toLocaleString('en-AU', { timeZone: 'Australia/Melbourne', dateStyle: 'medium', timeStyle: 'short' })} (Melbourne time).</p>
      {instructions ? <PaymentInstructionsPanel instructions={{...instructions,notes:instructions.notes.filter(note=>!note.startsWith("We hold your order for "))}} /> : <p>Contact us for payment details.</p>}
      <RefreshStatus /></section>}
    {!order.privateDetails && customerAccountsEnabled() && <aside className="co-signin-note"><h2>All your orders, in one place</h2><p>Sign in with the email you used at checkout to see your full receipt, delivery address and order history.</p><Link className="co-secondary" href={`/account/sign-in?returnTo=${encodeURIComponent(`/orders/${id}`)}`}>Sign in with email</Link></aside>}
  </div>;
}
