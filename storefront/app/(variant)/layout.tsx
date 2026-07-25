import Providers from "@/components/Providers";
import CartDrawer from "@/components/CartDrawer";
import Analytics from "@/components/Analytics";
import VariantHeader from "@/components/variant/VariantHeader";
import VariantFooter from "@/components/variant/VariantFooter";

/**
 * A/B variant shell (route /1).
 *
 * Deliberately does NOT reuse the (store) layout: the dark Header/Footer would
 * fight the light page and defeat the point of the test. What it DOES share is
 * everything downstream of the landing page — Providers (cart + UI state),
 * CartDrawer, and Analytics — so a shopper who lands on /1 hits the exact same
 * funnel as one who lands on /. The test isolates design, not mechanics.
 *
 * ExitIntentModal is intentionally omitted: "calm confidence, no urgency
 * theatre" is part of the hypothesis being tested.
 *
 * `.theme-light` re-declares the design tokens for this subtree only — see
 * globals.css. Every shared component inside re-themes automatically.
 */
export default function VariantLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="theme-light flex min-h-screen flex-col bg-ink text-fg">
        <VariantHeader />
        <main className="flex-1">{children}</main>
        <VariantFooter />
        <CartDrawer />
      </div>
      <Analytics />
    </Providers>
  );
}
