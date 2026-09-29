import Link from 'next/link';
import { redirect } from 'next/navigation';
import { customerAccountsEnabled } from '@/lib/customer-orders/flags';
import { listCustomerOrders } from '@/lib/customer-orders/queries';
import { SignOutButton } from '@/components/customer-orders/SignInForm';
import ProductThumbnail from '@/components/customer-orders/ProductThumbnail';
import { orderDate } from '@/components/customer-orders/OrderReceipt';
import { formatAud } from '@/lib/format';
export const metadata = { title: 'My orders' };
export default async function CustomerOrders({ searchParams }: { searchParams: Promise<{ after?: string }> }) {
  if (!customerAccountsEnabled()) redirect('/account/sign-in');
  const result = await listCustomerOrders((await searchParams).after);
  if (!result) redirect('/account/sign-in');
  return <div className="co-receipt"><div className="co-page-heading"><div><p className="co-eyebrow">Your account</p><h1>My orders</h1><p>{result.email}</p></div><SignOutButton /></div>
    {result.orders.length === 0 ? <section className="co-card"><h2>No orders to show yet</h2><p>Orders placed with this email will appear here. If you used another email at checkout, sign out and try that address.</p><Link className="co-button" href="/shop">Explore the range</Link></section> : <ul className="co-history">{result.orders.map(order => <li className="co-card" key={order.id}><Link className="co-history-link" href={`/orders/${order.id}`} aria-label={`View order ${order.number}`}>
      <div className="co-history-images">{order.items.slice(0, 4).map(item => <ProductThumbnail key={item.id} src={item.imageUrl} alt={item.imageAlt} />)}{order.items.length > 4 && <span>+{order.items.length - 4} more</span>}</div>
      <div className="co-page-heading"><div><h2>{order.status.label}</h2><p>{order.number} · {orderDate(order.createdAt)}</p></div><strong>{formatAud(order.totals.totalCents / 100)} AUD</strong></div><span className="co-link-label">View order →</span>
    </Link></li>)}</ul>}
    {result.nextCursor && <Link className="co-secondary" href={`/account/orders?after=${encodeURIComponent(result.nextCursor)}`}>Older orders →</Link>}
  </div>;
}
