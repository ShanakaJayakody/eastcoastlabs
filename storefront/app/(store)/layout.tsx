import Providers from "@/components/Providers";
import AnnouncementBar from "@/components/AnnouncementBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import ExitIntentModal from "@/components/ExitIntentModal";
import Analytics from "@/components/Analytics";
import { getSettings } from "@/lib/settings";
import { getAvailabilityMap } from "@/lib/storefront-catalog";
import { getAccessories } from "@/lib/accessories";
import { BAC_WATER_SLUG } from "@/lib/bumps";

// The storefront shell: everything a shopper sees. Admin routes deliberately do
// NOT inherit this — no cart, no exit-intent, no GA4.
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  // Reward thresholds are resolved here, once, and handed to the cart provider.
  // The cart is a client component and can't read settings itself. The same
  // applies to upsell availability: the free-gift auto-add and cart cross-sells
  // must not offer bac water / accessories the ledger says are gone.
  const [settings, stock] = await Promise.all([
    getSettings(),
    getAvailabilityMap([BAC_WATER_SLUG, ...getAccessories().map((a) => a.slug)]),
  ]);
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "East Coast Labs",
    url: "https://eastcoastlabs.com.au",
    description:
      "Australian-owned supplier of research-use-only peptides. Every batch independently tested by JanoShik with the COA published before it ships.",
    email: "eclpeptides@gmail.com",
    areaServed: "AU",
  };

  return (
    <Providers
      thresholds={{
        freeShipping: settings.freeShippingThreshold,
        gift: settings.giftThreshold,
      }}
      stock={stock}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <div className="flex min-h-screen flex-col">
        <AnnouncementBar />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <CartDrawer />
        <ExitIntentModal />
      </div>
      <Analytics />
    </Providers>
  );
}
