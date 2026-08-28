import Providers from "@/components/Providers";
import CartDrawer from "@/components/CartDrawer";
import Analytics from "@/components/Analytics";
import DossierHeader from "@/components/variant/v2/DossierHeader";
import DossierFooter from "@/components/variant/v2/DossierFooter";
import { newsreader, inter, plexMono } from "@/lib/fonts";
import { getSettings } from "@/lib/settings";
import { getAvailabilityMap } from "@/lib/storefront-catalog";
import { getAccessories } from "@/lib/accessories";
import { BAC_WATER_SLUG } from "@/lib/bumps";

/**
 * A/B variant shell (route /1) — "The Dossier" redesign.
 *
 * Deliberately does NOT reuse the (store) layout: this is a full visual
 * redesign, not a re-theme. What it DOES share with the control site is
 * everything downstream of the landing page — Providers (cart + UI state),
 * CartDrawer, and Analytics — so a shopper who lands on /1 hits the exact
 * same funnel as one who lands on /. The test isolates design, not mechanics.
 *
 * ExitIntentModal is intentionally omitted: calm confidence, no urgency
 * theatre, is part of the design thesis.
 *
 * `.theme-paper` re-declares the design tokens for this subtree only (see
 * globals.css); the font variables from next/font are applied on the same
 * root element so --font-serif/--font-grotesk/--font-data resolve only here.
 */
export default async function VariantLayout({ children }: { children: React.ReactNode }) {
  // Same funnel as (store): thresholds + upsell availability for the shared cart.
  const [settings, stock] = await Promise.all([
    getSettings(),
    getAvailabilityMap([BAC_WATER_SLUG, ...getAccessories().map((a) => a.slug)]),
  ]);
  return (
    <Providers
      thresholds={{
        freeShipping: settings.freeShippingThreshold,
        gift: settings.giftThreshold,
      }}
      stock={stock}
    >
      <div
        className={`theme-paper flex min-h-screen flex-col bg-ink text-fg ${newsreader.variable} ${inter.variable} ${plexMono.variable}`}
      >
        <DossierHeader />
        <main className="flex-1">{children}</main>
        <DossierFooter />
        <CartDrawer />
      </div>
      <Analytics />
    </Providers>
  );
}
