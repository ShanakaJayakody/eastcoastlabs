import Providers from "@/components/Providers";
import type {Viewport} from 'next';
import NavyStoreShell from '@/components/rebrand/NavyStoreShell';
import {getCollections} from '@/lib/collections';
import { getSettings } from "@/lib/settings";
import { shippingRules } from '@/lib/shipping-policy';
import { availablePaymentOptions } from '@/lib/payments';
import {
  getUpsellStock,
  getCartPrices,
  getCartVariants,
} from "@/lib/storefront-catalog";
import "./editorial.css";

export const viewport: Viewport = {colorScheme: 'light', themeColor: '#112b43'};

// The storefront shell: everything a shopper sees. Admin routes deliberately do
// NOT inherit this — no cart, no exit-intent, no GA4.
export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Reward thresholds are resolved here, once, and handed to the cart provider.
  // The cart is a client component and can't read settings itself. The same
  // applies to upsell availability: the free-gift auto-add and cart cross-sells
  // must not offer bac water / accessories the ledger says are gone.
  const [settings, stock, prices, variants] = await Promise.all([
    getSettings(),
    getUpsellStock(),
    getCartPrices(),
    getCartVariants(),
  ]);
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "East Coast Labs",
    ...(settings.legalName ? {legalName:settings.legalName} : {}),
    ...(settings.abn ? {taxID:settings.abn} : {}),
    url: "https://www.eastcoastlabs.com.au",
    description:
      "Australian-owned supplier of research-use-only peptides. Browse products and available batch documentation.",
    email: settings.supportEmail,
    areaServed: "AU",
  };

  return (
    <Providers
      thresholds={{
        freeShipping: settings.freeShippingThreshold,
        gift: settings.giftThreshold,
        express: settings.expressShippingEnabled ? settings.expressFreeThreshold : undefined,
      }}
      stock={stock}
      prices={prices}
      variants={variants}
      shipping={shippingRules(settings)}
      paymentLabels={availablePaymentOptions(settings).map(option => option.label)}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd).replace(/</g,'\\u003c') }}
      />
      <NavyStoreShell collections={getCollections()} supportEmail={settings.supportEmail} legalName={settings.legalName} abn={settings.abn} supportHours={settings.supportHours}>
        {children}
      </NavyStoreShell>
    </Providers>
  );
}
