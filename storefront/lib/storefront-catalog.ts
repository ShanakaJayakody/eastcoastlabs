import "server-only";

/**
 * SERVER-ONLY storefront catalog overlay.
 *
 * `lib/woo.ts` is in the CLIENT bundle (cart-context imports it), so DB reads can
 * never live there — the service-role key would ship to the browser. This module
 * is marked server-only and is consumed exclusively by server components, which
 * overlay live DB values (name/copy/price) and REAL availability on top of the
 * JSON catalog. That's what makes admin edits and true stock visible to shoppers.
 */
import { supabaseAdmin } from "./supabase";
import type { WooProduct } from "./woo";
import { getAggregates } from "./reviews";
import { getAccessories, RECON_KIT_SLUG } from "./accessories";
import { BAC_WATER_SLUG } from "./bumps";

export interface LiveProductOverlay {
  name?: string;
  shortDescription?: string;
  description?: string;
  priceCents?: number;
  compareAtCents?: number | null;
  inStock: boolean;
  available: number;
  status: string;
}

interface VariantRecord {
  pack_size: number;
  price_cents: number;
  compare_at_cents: number | null;
  inventory: { on_hand: number; reserved: number } | null;
}

/** Live overlay for one product slug, or null when the DB has nothing to say. */
export async function getProductOverlay(slug: string): Promise<LiveProductOverlay | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  const { data, error } = await db
    .from("products")
    .select(
      `name, short_description, description, status,
       product_variants ( pack_size, price_cents, compare_at_cents, active,
         inventory ( on_hand, reserved ) )`,
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;

  const row = data as unknown as {
    name: string;
    short_description: string | null;
    description: string | null;
    status: string;
    product_variants: VariantRecord[];
  };

  const variants = row.product_variants ?? [];
  const single = variants.find((v) => v.pack_size === 1) ?? variants[0];
  const available = variants.reduce(
    (sum, v) => sum + Math.max(0, (v.inventory?.on_hand ?? 0) - (v.inventory?.reserved ?? 0)),
    0,
  );

  return {
    name: row.name,
    shortDescription: row.short_description ?? undefined,
    description: row.description ?? undefined,
    priceCents: single?.price_cents,
    compareAtCents: single?.compare_at_cents ?? null,
    inStock: available > 0,
    available,
    status: row.status,
  };
}

/** Availability for many slugs at once (shop grid / home). */
export async function getAvailabilityMap(slugs: string[]): Promise<Record<string, number>> {
  const db = supabaseAdmin();
  if (!db || !slugs.length) return {};

  const { data, error } = await db
    .from("products")
    .select(`slug, product_variants ( inventory ( on_hand, reserved ) )`)
    .in("slug", slugs);
  if (error || !data) return {};

  const out: Record<string, number> = {};
  for (const row of data as unknown as {
    slug: string;
    product_variants: { inventory: { on_hand: number; reserved: number } | null }[];
  }[]) {
    out[row.slug] = (row.product_variants ?? []).reduce(
      (sum, v) => sum + Math.max(0, (v.inventory?.on_hand ?? 0) - (v.inventory?.reserved ?? 0)),
      0,
    );
  }
  return out;
}

/**
 * Availability for the upsell surfaces (bac water + accessories), with one
 * dependency encoded: the Reconstitution Starter Kit ships a bac-water vial
 * inside it, so when bac water is KNOWN to be out of stock the kit is clamped
 * to 0 too — regardless of how many kit boxes the ledger holds. Unknown bac
 * (no DB row) leaves the kit alone: unknown ≠ sold out.
 */
export async function getUpsellStock(): Promise<Record<string, number>> {
  const map = await getAvailabilityMap([BAC_WATER_SLUG, ...getAccessories().map((a) => a.slug)]);
  if (BAC_WATER_SLUG in map && map[BAC_WATER_SLUG] <= 0) map[RECON_KIT_SLUG] = 0;
  return map;
}

/**
 * Merge the live overlay into a WooProduct so existing components keep working
 * unchanged — they just start telling the truth about stock and price.
 */
export async function withLiveData(product: WooProduct): Promise<WooProduct> {
  const overlay = await getProductOverlay(product.slug);
  if (!overlay) return product;

  const minor = product.prices.currency_minor_unit ?? 2;
  const price = overlay.priceCents != null ? String(overlay.priceCents) : product.prices.price;
  const regular =
    overlay.compareAtCents != null ? String(overlay.compareAtCents) : product.prices.regular_price;
  const onSale = regular !== price;

  return {
    ...product,
    name: overlay.name ?? product.name,
    short_description: overlay.shortDescription ?? product.short_description,
    description: overlay.description ?? product.description,
    is_in_stock: overlay.inStock,
    prices: {
      ...product.prices,
      price,
      regular_price: regular,
      sale_price: onSale ? price : "",
      currency_minor_unit: minor,
    },
  };
}

/**
 * Decorate a list of product cards with live availability + published review
 * aggregates, in two batched queries. Card components stay dumb and client-safe;
 * all data comes from here (server-only).
 */
export async function decorateCards<T extends { slug: string; is_in_stock?: boolean }>(
  items: T[],
): Promise<(T & { is_in_stock: boolean; rating: { rating: number; count: number } | null })[]> {
  const slugs = items.map((i) => i.slug);
  const [availability, ratings] = await Promise.all([
    getAvailabilityMap(slugs),
    getAggregates(slugs),
  ]);
  return items.map((item) => ({
    ...item,
    // Only override when the DB actually knows about this product.
    is_in_stock: item.slug in availability ? availability[item.slug] > 0 : item.is_in_stock !== false,
    rating: ratings[item.slug] ?? null,
  }));
}
