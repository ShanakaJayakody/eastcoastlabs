import Providers from "@/components/Providers";
import AnnouncementBar from "@/components/AnnouncementBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import StoreEnhancements from "@/components/StoreEnhancements";
import { getSettings } from "@/lib/settings";
import {
  getUpsellStock,
  getCartPrices,
  getCartVariants,
} from "@/lib/storefront-catalog";
import { brandBody, brandDisplay } from "@/lib/editorial-fonts";
import "./editorial.css";

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
      }}
      stock={stock}
      prices={prices}
      variants={variants}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd).replace(/</g,'\\u003c') }}
      />
      <div
        className={`ecl-store ${brandBody.variable} ${brandDisplay.variable} flex min-h-screen flex-col`}
      >
        <AnnouncementBar />
        <Header />
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1">{children}</main>
        <Footer supportEmail={settings.supportEmail} legalName={settings.legalName} abn={settings.abn} supportHours={settings.supportHours} />
        <CartDrawer />
      </div>
      <StoreEnhancements />
    </Providers>
  );
}
