import "server-only";

/**
 * SERVER-ONLY storefront catalog, sourced from the database.
 *
 * This replaces the old arrangement where data/catalog.json listed the products
 * and the DB was only an overlay on top of it. That meant a product created in
 * /admin was invisible to shoppers until someone hand-edited two JSON files —
 * which is exactly how NAD+ ended up active, stocked and 404ing.
 *
 * Now the DB decides which products exist, what they cost and what's in stock.
 * Missing or unavailable database data yields no offers; archived products
 * must never be resurrected from historical JSON.
 *
 * Why not put this in lib/woo.ts: that module is in the CLIENT bundle
 * (cart-context imports wooCart from it), so a service-role DB read there would
 * ship the key to the browser. Same reason lib/storefront-catalog.ts is
 * server-only.
 */
import { cache } from "react";
import { supabaseAdmin } from "./supabase";
import type { WooProduct } from "./woo";
import { type TierCard } from "./pricing";
import { formatAudWhole } from "./format";
import localCatalog from "@/data/catalog.json";

export interface CatalogProduct extends WooProduct {
  /** Pack tiers built from this product's own variants. Null = no pack tiers. */
  tiers: TierCard[] | null;
  /** Vials sellable right now, summed across the pool. */
  available: number;
  seo_title?: string | null;
  seo_description?: string | null;
}

interface VariantRow {
  pack_size: number;
  label: string;
  price_cents: number;
  compare_at_cents: number | null;
  active: boolean;
  inventory: { on_hand: number; reserved: number } | null;
}

interface ProductRow {
  id: string;
  categories: string[] | null;
  slug: string;
  name: string;
  sku: string | null;
  short_description: string | null;
  description: string | null;
  images: { src: string; alt?: string }[] | null;
  status: string;
  seo_title?: string | null;
  seo_description?: string | null;
  product_variants: VariantRow[] | null;
}

/**
 * Legacy numeric ids, keyed by slug.
 *
 * WooProduct.id is a number and cart line keys are built from it, so a shopper
 * with an open cart would get orphaned lines if ids changed under them. Reusing
 * the ids the JSON catalog already published keeps existing carts intact;
 * products that only exist in the DB get a stable id derived from the slug.
 * (Checkout resolves variants by slug + pack_size, not by this id, so it is
 * presentational either way.)
 */
const LEGACY_IDS = new Map<string, number>(
  (localCatalog as { id: number; slug: string }[]).map((p) => [p.slug, p.id]),
);

/** Publication order the JSON catalog established — preserved so the home grid
 *  and shop don't reshuffle just because the source changed. */
const LEGACY_ORDER = new Map<string, number>(
  (localCatalog as { slug: string }[]).map((p, i) => [p.slug, i]),
);

/** Deterministic positive id for a slug the JSON catalog never knew about. */
function derivedId(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) | 0;
  // Offset well clear of the legacy id range so the two can never collide.
  return 900000 + (Math.abs(h) % 99999);
}

const idFor = (slug: string) => LEGACY_IDS.get(slug) ?? derivedId(slug);

/** Category marking a product as a research accessory rather than a peptide. */
const ACCESSORY_CATEGORY = "accessory";

/**
 * Build pack tier cards from the product's own variants.
 *
 * Savings are computed against N x the real single price, so they can never
 * drift from what checkout charges — the old price-table.json could, and did.
 */
function tiersFromVariants(variants: VariantRow[], available: number): TierCard[] | null {
  const sellable = variants.filter((v) => v.active !== false && v.pack_size <= available);
  const single = sellable.find((v) => v.pack_size === 1);
  const packs = sellable.filter((v) => v.pack_size > 1).sort((a, b) => a.pack_size - b.pack_size);
  if (!single) return null;

  const singleMajor = single.price_cents / 100;
  const idOf = (packSize: number): TierCard["id"] =>
    packSize === 1 ? "single" : packSize === 3 ? "pack3" : "pack6";

  const cards: TierCard[] = [
    {
      id: "single",
      label: single.label || "1 vial",
      vials: 1,
      total: singleMajor,
      perVial: singleMajor,
    },
  ];

  for (const v of packs) {
    const total = v.price_cents / 100;
    const undiscounted = singleMajor * v.pack_size;
    const saving = Math.floor(undiscounted - total);
    const pct = undiscounted > 0 ? Math.round((saving / undiscounted) * 100) : 0;
    cards.push({
      id: idOf(v.pack_size),
      label: v.label || `${v.pack_size}-pack`,
      // Badges follow the same convention the price table hard-coded: the
      // smallest pack is the nudge, the largest is the value play.
      badge: v === packs[packs.length - 1] ? `BEST VALUE — save ${pct}%` : "MOST POPULAR",
      vials: v.pack_size,
      total,
      perVial: Math.round((total / v.pack_size) * 100) / 100,
      strikethrough: undiscounted,
      savingLabel: `Save ${formatAudWhole(saving)}`,
      preselected: v === packs[0],
    });
  }

  return cards;
}

function mapRow(row: ProductRow): CatalogProduct | null {
  const variants = (row.product_variants ?? []).filter((v) => v.active !== false);
  const single = variants.find((v) => v.pack_size === 1) ?? variants[0];
  // No variant means no price and nothing to sell — a coming-soon product that
  // hasn't been launched yet. Those render from getComingSoonProducts(), not here.
  if (!single) return null;

  const available = variants.reduce(
    (sum, v) =>
      v.pack_size === 1
        ? sum + Math.max(0, (v.inventory?.on_hand ?? 0) - (v.inventory?.reserved ?? 0))
        : sum,
    0,
  );

  const price = String(single.price_cents);
  const regular = String(single.compare_at_cents ?? single.price_cents);
  const onSale = regular !== price;

  return {
    id: idFor(row.slug),
    name: row.name,
    slug: row.slug,
    type: variants.length > 1 ? "variable" : "simple",
    sku: row.sku ?? "",
    permalink: `/product/${row.slug}`,
    short_description: row.short_description ?? "",
    description: row.description ?? "",
    is_in_stock: available > 0,
    prices: {
      price,
      regular_price: regular,
      sale_price: onSale ? price : "",
      currency_code: "AUD",
      currency_minor_unit: 2,
      currency_prefix: "$",
      currency_suffix: "",
    },
    images: (row.images ?? []).map((img) => ({ src: img.src, alt: img.alt })),
    variations: [],
    tiers: tiersFromVariants(variants, available),
    seo_title: row.seo_title,
    seo_description: row.seo_description,
    available,
  };
}

/**
 * The storefront catalog. Active products only, ordered the way the JSON
 * catalog ordered them with anything newer appended.
 *
 * An empty or unavailable database never enables legacy offers.
 */
const CARD_COLUMNS = `id, slug, name, sku, short_description, images, status, categories,
 product_variants ( pack_size, label, price_cents, compare_at_cents, active, inventory ( on_hand, reserved ) )`;
const DETAIL_COLUMNS = `description, seo_title, seo_description, ${CARD_COLUMNS}`;
export const getCatalog = cache(async function getCatalog(limit?: number): Promise<{
  products: CatalogProduct[];
  bySlug: Map<string, CatalogProduct>;
}> {
  const db = supabaseAdmin();
  let products: CatalogProduct[] = [];

  if (db) {
    const rows: ProductRow[] = [];
    let error: { message:string } | null = null;
    const maximum = limit === undefined ? Infinity : Math.max(1, Math.floor(limit));
    for (let start=0; start<maximum; start+=500) {
      const end=Math.min(start+499, maximum-1);
      const result = await db.from("products").select(CARD_COLUMNS)
        .eq("status","active").order("id").range(start,end);
      if (result.error) { error=result.error; break; }
      const page=(result.data??[]) as unknown as ProductRow[];
      rows.push(...page);
      if (page.length<end-start+1) break;
    }
    const data=rows;
    if (error) {
      console.warn(`[catalog] DB read failed, catalog unavailable: ${error.message}`);
    } else {
      products = ((data ?? []) as unknown as ProductRow[])
        // Accessories (syringes, swabs, starter kit) are DB products too, but
        // they belong to the shop's accessories strip and the cart cross-sells,
        // not the peptide grid — see lib/accessories.ts.
        .filter((row) => !(row.categories ?? []).includes(ACCESSORY_CATEGORY))
        .map(mapRow)
        .filter((p): p is CatalogProduct => p != null)
        .sort((a, b) => {
          const oa = LEGACY_ORDER.get(a.slug) ?? Number.MAX_SAFE_INTEGER;
          const ob = LEGACY_ORDER.get(b.slug) ?? Number.MAX_SAFE_INTEGER;
          return oa === ob ? a.name.localeCompare(b.name) : oa - ob;
        });
    }
  }

  return { products, bySlug: new Map(products.map((p) => [p.slug, p])) };
});

/** One product by slug, tiers included. */
export const getCatalogProduct = cache(async function getCatalogProduct(slug: string): Promise<CatalogProduct | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length>120) return null;
  const db=supabaseAdmin();
  if (!db) return null;
  const {data,error}=await db.from("products").select(DETAIL_COLUMNS).eq("slug",slug).eq("status","active").maybeSingle();
  if (error) throw new Error("Product details are temporarily unavailable");
  if (!data || (data.categories??[]).includes(ACCESSORY_CATEGORY)) return null;
  return mapRow(data as unknown as ProductRow);
});

/** A bounded set of related products, without reading the whole catalogue. */
export async function getCatalogProducts(slugs:string[]):Promise<Map<string,CatalogProduct>> {
 const clean=[...new Set(slugs)].filter(s=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)).slice(0,20);
 const db=supabaseAdmin();if(!db||!clean.length)return new Map();
 const {data,error}=await db.from("products").select(CARD_COLUMNS).in("slug",clean).eq("status","active");
 if(error)return new Map();
 const products=((data??[]) as unknown as ProductRow[]).map(mapRow).filter((p):p is CatalogProduct=>p!==null);
 return new Map(products.map(p=>[p.slug,p]));
}
