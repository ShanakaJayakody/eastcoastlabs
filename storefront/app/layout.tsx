import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import AnnouncementBar from "@/components/AnnouncementBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import ExitIntentModal from "@/components/ExitIntentModal";
import Analytics from "@/components/Analytics";

export const metadata: Metadata = {
  metadataBase: new URL("https://eastcoastlabs.com.au"),
  title: {
    default: "East Coast Labs — Lab-grade research peptides, independently tested",
    template: "%s — East Coast Labs",
  },
  description:
    "Australian-owned supplier of research-use-only peptides. Every batch independently tested by JanoShik with the COA published before it ships. Research use only — not for human or animal consumption.",
  openGraph: {
    title: "East Coast Labs — Lab-grade research peptides",
    description:
      "Independently tested. Proof published. Australian owned & operated. Research use only.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "East Coast Labs",
    url: "https://eastcoastlabs.com.au",
    description:
      "Australian-owned supplier of research-use-only peptides. Every batch independently tested by JanoShik with the COA published before it ships.",
    email: "support@eastcoastlabs.com.au",
    areaServed: "AU",
  };

  return (
    <html lang="en-AU">
      <body className="flex min-h-screen flex-col bg-ink text-fg">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <Providers>
          <AnnouncementBar />
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <CartDrawer />
          <ExitIntentModal />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
