import "server-only";

/**
 * Coming-soon catalog entries.
 *
 * These are compounds ECL has identified as gaps but not yet sourced. They live
 * ONLY in Supabase — unlike the shipping catalog they have no entry in
 * data/catalog.json, because that file is the legacy Woo mirror and new products
 * should not be added to it.
 *
 * The defining property is what they DON'T have: no product_variants and no
 * inventory rows. That makes them unbuyable at the data layer rather than merely
 * hidden in the UI — resolveCart() has no variant to price and reserve_stock()
 * has nothing to reserve, so a forged cart line naming one of these slugs is
 * dropped server-side.
 *
 * Signups against them land in stock_notifications, the same table the
 * back-in-stock flow uses, which turns this shelf into a demand meter: see
 * comingSoonDemand() for the ranked read.
 */

import { supabaseAdmin } from "./supabase";

export interface ComingSoonProduct {
  slug: string;
  name: string;
  /** Intended vial format, carried on the SKU (e.g. ECL-NAD-500 → "500mg"). */
  format: string | null;
  compound: string | null;
  shortDescription: string | null;
  categories: string[];
  rank: number;
}

/** Pull the intended format out of the placeholder SKU's trailing segment. */
function formatFromSku(sku: string | null): string | null {
  if (!sku) return null;
  const tail = sku.split("-").pop();
  if (!tail || !/^\d+$/.test(tail)) return null;
  // NAD+ and glutathione are dosed in the hundreds/thousands of mg; the rest are
  // single- or double-digit mg. Same unit either way.
  return `${tail}mg`;
}

export async function getComingSoonProducts(): Promise<ComingSoonProduct[]> {
  const db = supabaseAdmin();
  if (!db) return [];

  const { data, error } = await db
    .from("products")
    .select("slug, name, sku, compound, short_description, categories, coming_soon_rank")
    .eq("status", "coming_soon")
    .order("coming_soon_rank", { ascending: true, nullsFirst: false });

  if (error || !data) return [];

  return data.map((p) => ({
    slug: p.slug as string,
    name: p.name as string,
    format: formatFromSku(p.sku as string | null),
    compound: (p.compound as string | null) ?? null,
    shortDescription: (p.short_description as string | null) ?? null,
    categories: Array.isArray(p.categories) ? (p.categories as string[]) : [],
    rank: (p.coming_soon_rank as number | null) ?? 9999,
  }));
}

export async function getComingSoonProduct(slug: string): Promise<ComingSoonProduct | null> {
  const all = await getComingSoonProducts();
  return all.find((p) => p.slug === slug) ?? null;
}

/** Slugs only — used to guard the cart against coming-soon items. */
export async function getComingSoonSlugs(): Promise<Set<string>> {
  const db = supabaseAdmin();
  if (!db) return new Set();
  const { data } = await db.from("products").select("slug").eq("status", "coming_soon");
  return new Set((data ?? []).map((r) => r.slug as string));
}

export interface ComingSoonDemandRow extends ComingSoonProduct {
  /** How many people asked to be told when this lands. */
  signups: number;
}

/**
 * The payoff: coming-soon products ranked by how many people actually asked for
 * them. This is first-party demand evidence — ECL's own customers voting — and
 * it beats any competitor-catalog audit for deciding what to source next.
 */
export async function comingSoonDemand(): Promise<ComingSoonDemandRow[]> {
  const db = supabaseAdmin();
  if (!db) return [];

  const products = await getComingSoonProducts();
  if (!products.length) return [];

  const { data } = await db
    .from("stock_notifications")
    .select("product_slug")
    .in(
      "product_slug",
      products.map((p) => p.slug),
    );

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const slug = row.product_slug as string;
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }

  return products
    .map((p) => ({ ...p, signups: counts.get(p.slug) ?? 0 }))
    // Demand first; sourcing rank breaks ties so a zero-signup shelf still reads
    // in priority order rather than arbitrarily.
    .sort((a, b) => b.signups - a.signups || a.rank - b.rank);
}
