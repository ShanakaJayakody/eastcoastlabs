import type { Metadata } from 'next';
import StoreInformation from '@/components/StoreInformation';
import { getSettings } from '@/lib/settings';
export const metadata:Metadata={title:'Contact',description:'Contact East Coast Labs about an order, product documentation or your information.',alternates:{canonical:'/contact'}};
export default async function ContactPage(){
  const s=await getSettings();
  return <StoreInformation title="Contact East Coast Labs" intro="Contact us for order support, product specifications and available batch documentation.">
    <section><h2>Customer support</h2><p><a href={`mailto:${s.supportEmail}`}>{s.supportEmail}</a></p>{s.supportHours&&<p>{s.supportHours}</p>}
      <p>For an existing order, include your order reference and a short description of the issue. For a product question, include the compound and size. Please do not email bank passwords or unnecessary sensitive information.</p></section>
    {(s.legalName||s.abn||s.publicAddress)&&<section><h2>Business details</h2>{s.legalName&&<p>{s.legalName}</p>}{s.abn&&<p>ABN {s.abn}</p>}{s.publicAddress&&<p className="whitespace-pre-line">{s.publicAddress}</p>}</section>}
    <section><h2>Research enquiries</h2><p>Products are supplied for laboratory research only. We do not provide dosing, administration, therapeutic or veterinary advice. Ask us about a document&apos;s scope before relying on it for a particular batch or specification.</p></section>
  </StoreInformation>;
}
