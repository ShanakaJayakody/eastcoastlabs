import type { Metadata } from 'next';
import StoreInformation from '@/components/StoreInformation';
import { getSettings } from '@/lib/settings';
import { shippingRules, shippingSummary } from '@/lib/shipping-policy';
export const metadata:Metadata={title:'Shipping and payment',description:'Payment confirmation, Australian shipping options and order support.',alternates:{canonical:'/shipping'}};
export default async function ShippingPage(){
  const s=await getSettings();
  return <StoreInformation title="Shipping and payment" intro="We ship from Australia to Australian addresses. Your checkout shows the available services and confirmed total before you place an order.">
    <section><h2>Payment and preparation</h2><p>After placing an order, use the private payment page to transfer the exact amount with the supplied reference. Order preparation begins after we confirm receipt of payment. Selecting a payment method or reporting a transfer does not itself confirm that funds have arrived.</p>
      <p>The payment page shows your order&apos;s hold and expiry times. If you have paid after expiry, or cannot identify your transfer, contact us before paying again.</p>{s.dispatchNotes&&<p className="whitespace-pre-line">{s.dispatchNotes}</p>}</section>
    <section><h2>Current shipping options</h2><ul>{shippingRules(s).map(rule => <li key={rule.method}><strong>{shippingSummary(rule)}.</strong> Estimated transit: {rule.eta} after dispatch.</li>)}</ul>
      <p>Free-shipping thresholds apply to the goods total after discounts.</p>
      <p>Transit estimates are separate from payment confirmation and preparation time. Carrier delays and destination can affect arrival. Review the checkout quote for your order&apos;s charges.</p></section>
    <section><h2>Tracking and delivery problems</h2><p>Tracking details are provided when your shipment is recorded. If a parcel is delayed, missing, damaged or incorrect, email <a href={`mailto:${s.supportEmail}`}>{s.supportEmail}</a> with your order reference so we can investigate and arrange an appropriate resolution.</p></section>
  </StoreInformation>;
}
