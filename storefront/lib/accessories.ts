/**
 * Research accessories — non-catalog consumables (syringes, swabs, sharps,
 * starter kit) used as cart cross-sells and a shop strip. Client-safe (reads a
 * bundled JSON), so interactive add-to-cart widgets can import it directly.
 */

import accessoriesData from "@/data/accessories.json";

export interface Accessory {
  id: number;
  name: string;
  slug: string;
  price: number; // AUD major units
  icon: string;
  blurb: string;
  unit: string;
}

const ITEMS = (accessoriesData as unknown as { items: Accessory[] }).items;

/** The starter kit ships a bacteriostatic-water vial inside it, so its
 *  availability is additionally gated on bac water stock (see
 *  storefront-catalog getUpsellStock and checkout resolveCart). */
export const RECON_KIT_SLUG = "reconstitution-kit";

export function getAccessories(): Accessory[] {
  return ITEMS.slice();
}

export function getAccessory(slug: string): Accessory | null {
  return ITEMS.find((a) => a.slug === slug) ?? null;
}
