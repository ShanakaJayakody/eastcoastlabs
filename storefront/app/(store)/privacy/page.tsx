import type { Metadata } from 'next';
import Link from 'next/link';
import StoreInformation from '@/components/StoreInformation';
import AnalyticsConsentControls from '@/components/AnalyticsConsentControls';
import { getSettings } from '@/lib/settings';
export const metadata:Metadata={title:'Privacy',description:'How the store uses order, contact and browsing information, and how to contact us about it.',alternates:{canonical:'/privacy'}};
export default async function PrivacyPage(){
  const s=await getSettings();
  return <StoreInformation title="Privacy" intro="This page explains the information used to run the store, fulfil orders and respond to you.">
    <section><h2>Order and support information</h2><p>Checkout collects your email, name, delivery address and order details. Phone number and delivery instructions are optional. We use this information to manage payment, fulfilment, order communications, support, refunds and business records. Information you send in a support request is used to address that request.</p></section>
    <section><h2>Service providers</h2><p>Store hosting, database, email and delivery providers process information needed to operate those services. Current software integrations include Supabase for store records and Resend for email; the delivery service receives the details needed for your parcel. Provider processing may occur outside Australia. Contact us for current provider and processing-location information.</p></section>
    <section><h2>Cart storage and optional measurement</h2><p>Your browser stores cart selections and a limited checkout-attempt identifier so you can continue shopping and safely recover an uncertain order attempt. Private payment and recovery links contain access credentials; keep them private.</p>
      <p>Optional analytics can record public-page interactions and limited campaign or experiment identifiers when enabled and permitted by your choice. Private payment/recovery URLs, address fields and support messages are not sent as analytics page locations. Browser storage or privacy restrictions can limit measurement.</p><AnalyticsConsentControls compact /></section>
    <section><h2>Email choices</h2><p>Cart reminders require a separate request and email confirmation. Newsletter and marketing choices are separate from receiving essential order messages. Use the unsubscribe link in a marketing or reminder email to stop that category of messages.</p></section>
    <section><h2>Access, corrections and concerns</h2><p>Email <a href={`mailto:${s.supportEmail}`}>{s.supportEmail}</a> to request access or corrections, ask about retention or deletion, or raise a privacy concern. We may need to verify your identity. Some records may need to be retained to meet legal obligations or resolve a transaction.</p>
      <p>Creator applications have a <Link href="/creators/privacy">separate privacy notice</Link>. You can also read the <a href="https://www.oaic.gov.au/privacy/your-privacy-rights">OAIC information about privacy rights</a>.</p></section>
  </StoreInformation>;
}
