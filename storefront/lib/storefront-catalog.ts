import "server-only";

/**
 * SERVER-ONLY availability and card decoration.
 *
 * This module used to hold the "live overlay" — DB values painted on top of the
 * JSON catalog. lib/catalog.ts now reads the catalog from the DB directly, so
 * the overlay is gone and what's left is the batched availability/ratings work
 * the upsell surfaces and card grids still need.
 *
 * `lib/woo.ts` is in the CLIENT bundle (cart-context imports it), so DB reads can
 * never live there — the service-role key would ship to the browser. This module
 * is marked server-only and is consumed exclusively by server components.
 */
import { getStacks } from "./stacks";
import { supabaseAdmin } from "./supabase";
import { getAggregates } from "./reviews";
import { getAccessories, RECON_KIT_SLUG } from "./accessories";
import { BAC_WATER_SLUG } from "./bumps";

/** Availability for many slugs at once (shop grid / home). */
export async function getAvailabilityMap(slugs: string[]): Promise<Record<string, number>> {
  const db = supabaseAdmin();
  const empty = Object.fromEntries(slugs.map(slug => [slug, 0]));
  if (!db || !slugs.length) return empty;

  const { data, error } = await db
    .from("products")
    .select(`slug, status, product_variants ( active, pack_size, inventory ( on_hand, reserved ) )`)
    .in("slug", slugs);
  if (error || !data) return empty;

  const out: Record<string, number> = empty;
  for (const row of data as unknown as {
    slug: string;
    status: string;
    product_variants: { active: boolean; pack_size: number; inventory: { on_hand: number; reserved: number } | null }[];
  }[]) {
    out[row.slug] = row.status !== "active" ? 0 : (row.product_variants ?? []).filter(v => v.active && v.pack_size === 1).reduce(
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
 * Decorate a list of product cards with live availability + published review
 * aggregates, in two batched queries. Card components stay dumb and client-safe;
 * all data comes from here (server-only).
 */
export async function decorateCards<T extends { slug: string; is_in_stock?: boolean; sizes?: {available:number}[] }>(
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
    is_in_stock: item.sizes?.length ? item.sizes.some(size=>size.available>0) : item.slug in availability ? availability[item.slug] > 0 : item.is_in_stock !== false,
    rating: ratings[item.slug] ?? null,
  }));
}

/** Current cents for restoring saved cart estimates and accessory displays. */
export async function getCartPrices(): Promise<Record<string, number>> {
  const db = supabaseAdmin();
  if (!db) return {};
  const [{data,error}, stacks] = await Promise.all([
    db.from("products").select("slug, product_variants (pack_size, price_cents, active)").eq("status", "active"),
    getStacks(),
  ]);
  if (error || !data) return {};
  const prices: Record<string,number> = {};
  for (const row of data) for (const variant of row.product_variants ?? []) {
    if (variant.active && Number.isSafeInteger(variant.price_cents) && variant.price_cents >= 0) prices[`${row.slug}:${variant.pack_size}`] = variant.price_cents;
  }
  for (const stack of stacks) prices[`${stack.slug}:stack`] = stack.bundlePriceCents;
  return prices;
}

/** Live identities for all modern purchase surfaces; stored legacy carts stay unchanged. */
export async function getCartVariants():Promise<Record<string,string>> {
 const db=supabaseAdmin();if(!db)return {};
 const {data,error}=await db.from("products").select("slug, product_variants (id,pack_size,active)").eq("status","active");
 if(error||!data)return {};
 return Object.fromEntries(data.flatMap(row=>(row.product_variants??[]).filter(v=>v.active).map(v=>[`${row.slug}:${v.pack_size}`,v.id])));
}
