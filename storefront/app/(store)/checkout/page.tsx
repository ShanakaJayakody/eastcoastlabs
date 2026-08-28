import type { Metadata } from "next";
import CheckoutForm from "@/components/CheckoutForm";
import { getProducts } from "@/lib/woo";
import { minorToMajor } from "@/lib/format";
import { buildBumpCandidates, BAC_WATER_SLUG } from "@/lib/bumps";
import { getAvailabilityMap } from "@/lib/storefront-catalog";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  // Bacteriostatic water is a live catalog product, so its price has to be
  // resolved server-side; the accessories in the bump pool come from bundled
  // JSON. Which of them actually renders is decided client-side against the
  // cart's contents.
  const products = await getProducts(50);
  const bac = products.find((p) => p.slug === BAC_WATER_SLUG);
  const candidates = buildBumpCandidates(
    bac
      ? {
          id: bac.id,
          name: bac.name,
          price: minorToMajor(bac.prices.price, bac.prices.currency_minor_unit),
        }
      : null,
  );
  // Never offer what can't ship: drop candidates the DB knows are out of stock.
  // Slugs the DB doesn't track (no rows yet) stay offered — unknown ≠ sold out.
  const availability = await getAvailabilityMap(candidates.map((c) => c.slug));
  const bumps = candidates.filter((c) => !(c.slug in availability) || availability[c.slug] > 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-fg">Checkout</h1>
      <p className="mt-1 text-sm text-muted">
        Research use only — not for human or animal consumption.
      </p>
      <CheckoutForm bumps={bumps} />
    </div>
  );
}
