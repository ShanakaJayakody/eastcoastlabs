import type { Metadata } from 'next';
import Link from 'next/link';
import StoreInformation from '@/components/StoreInformation';
export const metadata:Metadata={title:'Purchase terms',description:'Product selection, payment, research-use restrictions and customer information.',alternates:{canonical:'/terms'}};
export default function TermsPage(){
  return <StoreInformation title="Purchase terms" intro="Please review the selected product, size, pack quantity and confirmed order total before placing an order.">
    <section><h2>Research-use supply</h2><p>Products are intended for laboratory research only. They are not supplied for human or animal consumption, therapeutic use, diagnosis or veterinary application. Buyers must have appropriate facilities and training and comply with applicable requirements. We do not provide dosing or administration guidance.</p></section>
    <section><h2>Products and documentation</h2><p>The selected size and pack determine what you order. Check specifications and available documentation for that selection. A certificate relates to the sample and batch stated in the document; it does not establish a connection to your shipment unless that connection is explicitly confirmed. An unavailable certificate is not a verified test result.</p></section>
    <section><h2>Prices, availability and payment</h2><p>Prices are displayed in Australian dollars. The server confirms current prices, stock, discounts and shipping at checkout. Review any updated quote before submitting. Bank-transfer instructions follow order creation; preparation begins after payment confirmation. Your private payment page shows the applicable expiry.</p>
      <p>Gift eligibility depends on current stock and the goods total after discounts. A zero gift threshold still requires a paid purchase. Explicitly included bundle components are shown separately from spend-based gifts.</p></section>
    <section><h2>Support and applicable rights</h2><p>See <Link href="/shipping">shipping information</Link> and <Link href="/returns">returns and order problems</Link>. Nothing in these terms removes rights that cannot lawfully be excluded. For an issue with an order or these terms, <Link href="/contact">contact East Coast Labs</Link>.</p></section>
  </StoreInformation>;
}
