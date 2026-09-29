import type { CustomerOrderView } from '@/lib/customer-orders/types';
import { formatAud } from '@/lib/format';
import ProductThumbnail from './ProductThumbnail';
const money = (cents: number) => formatAud(cents / 100);
export const orderDate = (value: string) => new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Melbourne' });
export default function OrderReceipt({ order }: { order: CustomerOrderView }) {
  const { totals, privateDetails } = order;
  const address = privateDetails?.address;
  // The receipt deliberately enumerates address keys; arbitrary stored values are never rendered.
  const addressLines = address ? [address.line1 ?? address.address1, address.line2 ?? address.address2,
    [address.city ?? address.suburb, address.state, address.postcode ?? address.postal_code].filter(Boolean).join(' '), address.country]
    .filter((v): v is string => typeof v === 'string' && v.length > 0) : [];
  return <>
    <section className="co-card co-status" aria-labelledby="order-status">
      <p className="co-eyebrow">Order status</p>
      <h2 id="order-status">{order.status.label}</h2>
      <ol className="co-timeline">{order.milestones.map((step, i) => <li key={step.label}>
        <span className="co-dot" aria-hidden="true">{i + 1}</span><div><strong>{step.label}</strong><time dateTime={step.at}>{orderDate(step.at)}</time></div>
      </li>)}</ol>
      {order.tracking && <div className="co-tracking"><strong>{order.tracking.carrierLabel || 'Shipment tracking'}</strong>
        {order.tracking.url ? <a href={order.tracking.url} target="_blank" rel="noopener noreferrer">Track shipment ↗</a> : <span>Check this number with the carrier.</span>}
        <span className="co-tracking-number">{order.tracking.number}</span></div>}
      {order.status.showPayment && <p>We’ll confirm your payment by email once it has been matched to your order. If you have already transferred, no further payment is needed.</p>}
    </section>
    <section className="co-card" aria-labelledby="order-items"><h2 id="order-items">Your items</h2>
      <ul className="co-items">{order.items.map(item => <li key={item.id}>
        <ProductThumbnail src={item.imageUrl} alt={item.imageAlt} />
        <div className="co-item-info"><h3>{item.name}</h3><p>{item.variantLabel}</p><p>Quantity {item.quantity}</p>
          {item.isGift && <span className="co-badge">Free gift</span>}
          {item.refundedQuantity > 0 && <p className="co-refund">Refunded: {item.refundedQuantity}</p>}</div>
        <strong className="co-line-price">{money(item.lineTotalCents)}</strong>
      </li>)}</ul>
      <dl className="co-totals"><div><dt>Subtotal</dt><dd>{money(totals.subtotalCents)}</dd></div>
        {totals.discountCents > 0 && <div><dt>Discounts</dt><dd>−{money(totals.discountCents)}</dd></div>}
        <div><dt>Shipping</dt><dd>{totals.shippingCents ? money(totals.shippingCents) : 'Free'}</dd></div>
        <div className="co-total"><dt>Order total</dt><dd><small>AUD </small>{money(totals.totalCents)}</dd></div>
        {totals.refundedCents > 0 && <><div><dt>Refunded</dt><dd>−{money(totals.refundedCents)}</dd></div><div><dt>Total after refunds</dt><dd>{money(totals.totalCents - totals.refundedCents)}</dd></div></>}
      </dl>
    </section>
    {privateDetails && <section className="co-card"><h2>Order details</h2><div className="co-detail-grid">
      <div><h3>Contact</h3><p>{privateDetails.name}</p><p>{privateDetails.email}</p></div>
      <div><h3>Ship to</h3>{addressLines.map((line, i) => <p key={i}>{line}</p>)}</div>
      <div><h3>Payment</h3><p>{order.payment.method === 'payid' ? 'PayID' : 'Bank transfer'}</p><p>{order.payment.paidAt ? `Confirmed ${orderDate(order.payment.paidAt)}` : order.status.label}</p></div>
    </div></section>}
  </>;
}
