import Providers from "@/components/Providers";
import AnnouncementBar from "@/components/AnnouncementBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import ExitIntentModal from "@/components/ExitIntentModal";
import Analytics from "@/components/Analytics";
import { getSettings } from "@/lib/settings";

// The storefront shell: everything a shopper sees. Admin routes deliberately do
// NOT inherit this — no cart, no exit-intent, no GA4.
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  // Reward thresholds are resolved here, once, and handed to the cart provider.
  // The cart is a client component and can't read settings itself.
  const settings = await getSettings();
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
