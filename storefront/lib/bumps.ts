/**
 * Order-bump suggestion rules.
 *
 * Which accessory to offer is decided by what KIND of thing is in the basket,
 * not by a hardcoded product id — so a new peptide added to the catalog gets
 * the right suggestions on day one without anyone remembering to update a list.
 *
 * The ordering is deliberate. Bacteriostatic water is first because it is the
 * one item without which a peptide vial cannot be used at all; syringes and
 * swabs follow. An item already in the cart is never suggested (that filtering
 * happens client-side, where the cart lives).
 *
 * Client-safe: reads bundled JSON only.
 */

import { getAccessories } from "./accessories";
import type { BumpProduct } from "@/components/CheckoutBump";

/** Catalog slug of the reconstitution solvent — the universal peptide attach. */
export const BAC_WATER_SLUG = "bacteriostatic-water";

/** Accessory slugs offered as bumps, in priority order. */
const ACCESSORY_PRIORITY = ["insulin-syringes", "alcohol-swabs"];

/**
 * Anything that isn't the solvent or a known accessory is treated as a research
 * compound — the thing that makes accessories relevant.
 */
export function isPeptideSlug(slug: string): boolean {
  if (slug === BAC_WATER_SLUG) return false;
  if (slug.startsWith("stack:")) return true;
  return !getAccessories().some((a) => a.slug === slug);
}

/**
 * The candidate pool for the checkout bump, most useful first.
 *
 * `bacWater` is passed in because it's a real catalog product with a live price
 * (unlike accessories, which are bundled JSON), so only the server knows what
 * it currently costs.
 */
export function buildBumpCandidates(bacWater?: {
  id: number;
  name: string;
  price: number;
} | null): BumpProduct[] {
  const out: BumpProduct[] = [];

  if (bacWater) {
    out.push({
      id: bacWater.id,
      name: bacWater.name,
      slug: BAC_WATER_SLUG,
      price: bacWater.price,
      icon: "💧",
      blurb: "Sterile solvent — needed to reconstitute any peptide",
      unit: "1 vial",
      essential: true,
    });
  }

  const accessories = getAccessories();
  for (const slug of ACCESSORY_PRIORITY) {
    const a = accessories.find((x) => x.slug === slug);
    if (a) {
      out.push({
        id: a.id,
        name: a.name,
        slug: a.slug,
        price: a.price,
        icon: a.icon,
        blurb: a.blurb,
        unit: a.unit,
      });
    }
  }

  return out;
}
