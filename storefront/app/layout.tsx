import type { Metadata, Viewport } from "next";
import "./globals.css";

// Minimal root layout. Storefront chrome (Header/Footer/Cart/etc.) lives in the
// (store) route group; the admin panel lives under /admin with its own shell.
// Keeping the root bare is what lets those two worlds not bleed into each other.

export const metadata: Metadata = {
  metadataBase: new URL("https://www.eastcoastlabs.com.au"),
  title: {
    default: "East Coast Labs — Research peptides",
    template: "%s — East Coast Labs",
  },
  description:
    "Australian supplier of research-use-only peptides. Browse current pack prices and available batch documentation. Not for human or animal consumption.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#080b10",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" data-scroll-behavior="smooth">
      <body className="min-h-screen bg-ink text-fg">{children}</body>
    </html>
  );
}
