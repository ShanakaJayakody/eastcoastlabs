/**
 * Tier pricing (1 vial / 3-pack / 6-pack) sourced from data/price-table.json.
 *
 * The live catalog currently exposes every product as a "simple" WooCommerce
 * product (single price, no variations). The tier conversion runs server-side
 * later. Until then this table is the source of truth for pack pricing so the
 * PDP can render real 1/3/6 tier cards. When the backend exposes true
 * `variations`, the PDP prefers those (see product page) and this becomes a
 * graceful fallback.
 */

import priceTable from "@/data/price-table.json";
import { formatAud, formatAudWhole } from "./format";

interface RawPrices {
  "1_vial": number;
  "3_pack": number;
  "3_pack_per_vial": number;
  "6_pack": number;
  "6_pack_per_vial": number;
  "6_pack_saving_shown": string;
}

interface RawProduct {
  name: string;
  slug: string;
  sku: string;
  prices: RawPrices;
}

const TABLE = priceTable as unknown as {
  discount_3pk_pct: number;
  discount_6pk_pct: number;
  products: RawProduct[];
  bacteriostatic_water: { name: string; slug: string; sku: string; price: number };
};

/** Live catalog slug -> price-table slug aliases (naming drift on the backend). */
const SLUG_ALIASES: Record<string, string> = {
  igf: "igf-1-lr3",
};

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export interface TierCard {
  id: "single" | "pack3" | "pack6";
  label: string;
  badge?: string;
  vials: number;
  total: number; // AUD major units
  perVial: number; // AUD major units
  strikethrough?: number; // N x single (real comparison)
  savingLabel?: string;
  preselected?: boolean;
}

export interface ProductPricing {
  slug: string;
  singleVial: number;
  tiers: TierCard[];
  savingsPct3: number;
  savingsPct6: number;
}

function findRaw(slug: string, name?: string): RawProduct | null {
  const target = SLUG_ALIASES[slug] ?? slug;
  const bySlug = TABLE.products.find((p) => p.slug === target || p.slug === slug);
  if (bySlug) return bySlug;
  if (name) {
    const n = normalize(name);
    const byName = TABLE.products.find(
      (p) => normalize(p.name) === n || normalize(p.name).includes(n) || n.includes(normalize(p.name)),
    );
    if (byName) return byName;
  }
  return null;
}

/**
 * Resolve tier pricing for a product. `livePriceMinor` (if provided) lets us
 * prefer the live single-vial price for the 1-vial tier so it always matches
 * the catalog; pack tiers come from the table.
 */
export function getPricing(slug: string, name?: string, liveSingleVial?: number): ProductPricing | null {
  const raw = findRaw(slug, name);
  if (!raw) return null;

  const single = liveSingleVial && liveSingleVial > 0 ? liveSingleVial : raw.prices["1_vial"];
  const p = raw.prices;

  const tiers: TierCard[] = [
    {
      id: "single",
      label: "1 vial",
      vials: 1,
      total: single,
      perVial: single,
    },
    {
      id: "pack3",
      label: "3-pack",
      badge: "MOST POPULAR",
      vials: 3,
      total: p["3_pack"],
      perVial: p["3_pack_per_vial"],
      strikethrough: single * 3,
      savingLabel: `Save ${formatAudWhole(single * 3 - p["3_pack"])}`,
      preselected: true,
    },
    {
      id: "pack6",
      label: "6-pack",
      badge: `BEST VALUE — save ${TABLE.discount_6pk_pct}%`,
      vials: 6,
      total: p["6_pack"],
      perVial: p["6_pack_per_vial"],
      strikethrough: single * 6,
      savingLabel: p["6_pack_saving_shown"] || `Save ${formatAudWhole(single * 6 - p["6_pack"])}`,
    },
  ];

  return {
    slug: raw.slug,
    singleVial: single,
    tiers,
    savingsPct3: TABLE.discount_3pk_pct,
    savingsPct6: TABLE.discount_6pk_pct,
  };
}

/** Lowest per-vial price for "from $X/vial" copy. */
export function fromPerVial(slug: string, name?: string, liveSingleVial?: number): number | null {
  const pricing = getPricing(slug, name, liveSingleVial);
  if (!pricing) return null;
  return Math.min(...pricing.tiers.map((t) => t.perVial));
}

export function fromPerVialLabel(slug: string, name?: string, liveSingleVial?: number): string | null {
  const v = fromPerVial(slug, name, liveSingleVial);
  return v == null ? null : `from ${formatAud(v)}/vial`;
}
