import type { Metadata } from 'next';
import StoreInformation from '@/components/StoreInformation';
import { getSettings } from '@/lib/settings';
export const metadata:Metadata={title:'Returns and order problems',description:'How to get help with damaged, incorrect or missing orders and product concerns.',alternates:{canonical:'/returns'}};
export default async function ReturnsPage(){
  const s=await getSettings();
  return <StoreInformation title="Returns and order problems" intro="Contact us promptly if an order arrives damaged, contains an incorrect item, is missing, or does not match its description.">
    <section><h2>Request help</h2><p>Email <a href={`mailto:${s.supportEmail}`}>{s.supportEmail}</a> with your order reference, the affected item and a description of the problem. Photos can help us assess damage or an incorrect item. Keep the packaging and contact us before sending material back so we can provide suitable return instructions.</p></section>
    <section><h2>Your rights</h2><p>Applicable Australian Consumer Law guarantees continue to apply. Our policies do not exclude rights to a remedy for goods that fail those guarantees. A request to report an issue promptly does not impose a seven-day limit on those rights.</p>
      <p>The appropriate remedy depends on the problem and applicable law. Read the <a href="https://www.accc.gov.au/consumers/problem-with-a-product-or-service-you-bought/repair-replace-refund-cancel">ACCC guidance on repair, replacement and refunds</a>.</p></section>
    <section><h2>Cancellations and other requests</h2><p>Contact us as soon as possible if you need to change or cancel an order. Include whether payment has been sent. We will check the order and shipment status before confirming what can be arranged. Contact us before returning a change-of-mind purchase.</p>{s.returnsNotes&&<p className="whitespace-pre-line">{s.returnsNotes}</p>}</section>
    <section><h2>Product documentation concerns</h2><p>If a document or product specification appears inconsistent, include the product name, size and batch details. Please retain the item while we review the evidence with you.</p></section>
  </StoreInformation>;
}
