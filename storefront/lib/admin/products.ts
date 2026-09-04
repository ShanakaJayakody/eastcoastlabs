/**
 * Product + stock read/write for the admin. Stock changes always go through the
 * ledger (lib/admin/inventory.ts) — nothing here writes inventory.on_hand.
 */
import { cache } from "react";
import { adminDb } from "./db";
import { logAudit } from "./audit";
import { recordMovement, packsAvailable, type MovementReason } from "./inventory";
import { queueBackInStock } from "./notifications";

export interface VariantRow {
  id: string;
  sku: string;
  pack_size: number;
  label: string;
  price_cents: number;
  compare_at_cents: number | null;
  low_stock_threshold: number;
  on_hand: number;
  reserved: number;
  available: number;
  active: boolean;
}

export interface ProductListRow {
  id: string;
  slug: string;
  name: string;
  sku: string | null;
  status: string;
  /** Weighted-average cost of ONE vial, in cents (admin-only). */
  unit_cost_cents: number | null;
  image: string | null;
  variants: VariantRow[];
  totalOnHand: number;
  lowStock: boolean;
  minPriceCents: number;
}

interface RawVariant {
  id: string;
  sku: string;
  pack_size: number;
  label: string;
  price_cents: number;
  compare_at_cents: number | null;
  active: boolean;
  inventory: { on_hand: number; reserved: number; low_stock_threshold: number } | null;
}

/**
 * Map a variant, deriving its availability from the product's VIAL POOL.
 *
 * Stock lives once per product, in vials, on the pack_size = 1 variant. A tier's
 * availability is how many whole packs those vials can fill — so 30 vials means
 * 30 singles OR 10 three-packs OR 5 six-packs, never all at once.
 */
function mapVariant(v: RawVariant, pool: { onHand: number; reserved: number }): VariantRow {
  const packSize = Math.max(1, v.pack_size || 1);
  const vialsAvailable = pool.onHand - pool.reserved;
  return {
    id: v.id,
    sku: v.sku,
    pack_size: v.pack_size,
    label: v.label,
    price_cents: v.price_cents,
    compare_at_cents: v.compare_at_cents,
    low_stock_threshold: v.inventory?.low_stock_threshold ?? 5,
    on_hand: packsAvailable(pool.onHand, packSize),
    reserved: packSize > 1 ? Math.floor(pool.reserved / packSize) : pool.reserved,
    available: packsAvailable(vialsAvailable, packSize),
    active: v.active,
  };
}

/**
 * The vial pool for a product: normally its pack_size = 1 inventory row.
 *
 * Products sold only in multi-vial packs have no 1-vial tier, and reading the
 * pool as "the single's row or zero" made every tier of those products display
 * 0 in stock while they were genuinely sellable. When there is no 1-vial tier,
 * fall back to the smallest pack that carries inventory and convert its count
 * into vials, which is the unit the rest of the system works in.
 */
function poolOf(variants: RawVariant[]): { onHand: number; reserved: number } {
  const single = variants.find((v) => v.pack_size === 1);
  if (single?.inventory) {
    return { onHand: single.inventory.on_hand ?? 0, reserved: single.inventory.reserved ?? 0 };
  }

  const holder = variants
    .filter((v) => v.inventory)
    .sort((a, b) => (a.pack_size || 1) - (b.pack_size || 1))[0];
  if (!holder) return { onHand: 0, reserved: 0 };

  const packSize = Math.max(1, holder.pack_size || 1);
  return {
    onHand: (holder.inventory?.on_hand ?? 0) * packSize,
    reserved: (holder.inventory?.reserved ?? 0) * packSize,
  };
}

/**
 * Vials physically on hand for a product (the number an operator manages).
 * Mirrors poolOf's fallback so the editor's stock figure and the tier
 * availability it explains can never disagree.
 */
export function vialsOnHand(variants: { pack_size: number; on_hand: number }[]): number {
  const single = variants.find((v) => v.pack_size === 1);
  if (single) return single.on_hand;
  // mapVariant already reports pack-level counts, so convert back to vials.
  const smallest = variants.slice().sort((a, b) => (a.pack_size || 1) - (b.pack_size || 1))[0];
  return smallest ? smallest.on_hand * Math.max(1, smallest.pack_size || 1) : 0;
}

const SELECT_PRODUCT = `
  id, slug, name, sku, status, images, short_description, description, seo_title, seo_description, unit_cost_cents,
  product_variants (
    id, sku, pack_size, label, price_cents, compare_at_cents, active, position,
    inventory ( on_hand, reserved, low_stock_threshold )
  )
`;

interface RawProduct {
  id: string;
  slug: string;
  name: string;
  sku: string | null;
  status: string;
  images: { src?: string; alt?: string }[] | null;
  short_description: string | null;
  description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  unit_cost_cents: number | null;
  product_variants: RawVariant[];
}

function firstImage(images: RawProduct["images"]): string | null {
  const src = images?.[0]?.src;
  return typeof src === "string" ? src : null;
}

export async function listProducts(opts: { search?: string; lowStockOnly?: boolean } = {}): Promise<ProductListRow[]> {
  const { data, error } = await adminDb().from("products").select(SELECT_PRODUCT).order("name");
  if (error) throw new Error(`listProducts: ${error.message}`);

  let rows: ProductListRow[] = (data as unknown as RawProduct[]).map((p) => {
    const raw = p.product_variants ?? [];
    const pool = poolOf(raw);
    const variants = raw
      .map((v) => mapVariant(v, pool))
      .sort((a, b) => a.pack_size - b.pack_size);
    const totalOnHand = pool.onHand; // vials — summing derived pack counts would double-count
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      sku: p.sku,
      status: p.status,
      unit_cost_cents: p.unit_cost_cents ?? null,
      image: firstImage(p.images),
      variants,
      totalOnHand,
      lowStock: variants.some((v) => v.available <= v.low_stock_threshold),
      minPriceCents: variants.length ? Math.min(...variants.map((v) => v.price_cents)) : 0,
    };
  });

  if (opts.search?.trim()) {
    const s = opts.search.trim().toLowerCase();
    rows = rows.filter(
      (r) => r.name.toLowerCase().includes(s) || r.slug.includes(s) || (r.sku ?? "").toLowerCase().includes(s),
    );
  }
  if (opts.lowStockOnly) rows = rows.filter((r) => r.lowStock);
  return rows;
}

export interface ProductDetail extends ProductListRow {
  short_description: string | null;
  description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  images: { src: string; alt?: string }[];
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const { data, error } = await adminDb()
    .from("products")
    .select(SELECT_PRODUCT)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`getProductBySlug: ${error.message}`);
  if (!data) return null;
  const p = data as unknown as RawProduct;
  const raw = p.product_variants ?? [];
  const pool = poolOf(raw);
  const variants = raw.map((v) => mapVariant(v, pool)).sort((a, b) => a.pack_size - b.pack_size);
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    sku: p.sku,
    status: p.status,
    unit_cost_cents: p.unit_cost_cents ?? null,
    image: firstImage(p.images),
    variants,
    totalOnHand: pool.onHand, // vials
    lowStock: variants.some((v) => v.available <= v.low_stock_threshold),
    minPriceCents: variants.length ? Math.min(...variants.map((v) => v.price_cents)) : 0,
    short_description: p.short_description,
    description: p.description,
    seo_title: p.seo_title,
    seo_description: p.seo_description,
    images: (p.images ?? []).filter((img): img is { src: string; alt?: string } => Boolean(img?.src)),
  };
}

/** Replace a product's images array (upload/remove/reorder all funnel through this). */
export async function setProductImages(
  slug: string,
  images: { src: string; alt?: string }[],
  actor: string,
): Promise<void> {
  const { error } = await adminDb()
    .from("products")
    .update({ images, updated_at: new Date().toISOString() })
    .eq("slug", slug);
  if (error) throw new Error(`setProductImages: ${error.message}`);
  await logAudit({
    actor,
    action: "product.images",
    entityType: "product",
    entityId: slug,
    diff: { count: images.length },
  });
}

// ---------------------------------------------------------------------------
// Create / duplicate
// ---------------------------------------------------------------------------

/** ECL's standard pack economics: 3-pack 10% off, 6-pack 20% off the unit price. */
export const TIER_DISCOUNTS: Record<number, number> = { 1: 0, 3: 0.1, 6: 0.2 };

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Suggested per-pack price in cents, from a 1-vial price. */
export function tierPriceCents(singleCents: number, packSize: number): number {
  const discount = TIER_DISCOUNTS[packSize] ?? 0;
  return Math.round((singleCents * packSize * (1 - discount)) / 100) * 100; // whole dollars
}

/** Unique-ify a slug/sku by appending -2, -3 … so create/duplicate never 409s. */
async function uniqueValue(
  table: "products" | "product_variants",
  column: "slug" | "sku",
  base: string,
): Promise<string> {
  const db = adminDb();
  for (let n = 1; n < 50; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const { data } = await db.from(table).select("id").eq(column, candidate).maybeSingle();
    if (!data) return candidate;
  }
  return `${base}-${Date.now()}`;
}

export interface NewVariantInput {
  pack_size: number;
  label: string;
  price_cents: number;
}

export interface CreateProductInput {
  name: string;
  slug?: string;
  sku?: string;
  compound?: string;
  short_description?: string;
  description?: string;
  status?: "active" | "draft" | "archived" | "coming_soon";
  variants: NewVariantInput[];
  /** Optional opening stock, applied to every variant via the ledger. */
  initialStock?: number;
}

/**
 * Create a product with its pack tiers. Variants get inventory rows; opening
 * stock is recorded as a "received" ledger movement (never a direct on_hand
 * write) so the audit trail is complete from the very first unit.
 */
export async function createProduct(
  input: CreateProductInput,
  actor: string,
): Promise<{ slug: string }> {
  const db = adminDb();
  const baseSlug = slugify(input.slug || input.name);
  if (!baseSlug) throw new Error("A product name is required.");
  const slug = await uniqueValue("products", "slug", baseSlug);
  const sku = await uniqueValue(
    "products",
    "sku",
    (input.sku || `ECL-${baseSlug.toUpperCase().replace(/-/g, "").slice(0, 10)}`).toUpperCase(),
  );

  const { data: product, error } = await db
    .from("products")
    .insert({
      slug,
      name: input.name.trim(),
      sku,
      compound: input.compound?.trim() || null,
      short_description: input.short_description ?? null,
      description: input.description ?? null,
      status: input.status ?? "draft",
      images: [],
      categories: [],
    })
    .select("id")
    .single();
  if (error) throw new Error(`createProduct: ${error.message}`);
  const productId = product.id as string;

  const variants = input.variants.length
    ? input.variants
    : [
        { pack_size: 1, label: "1 vial", price_cents: 0 },
        { pack_size: 3, label: "3-pack", price_cents: 0 },
        { pack_size: 6, label: "6-pack", price_cents: 0 },
      ];

  for (const [i, v] of variants.entries()) {
    const variantSku = await uniqueValue("product_variants", "sku", `${sku}-${v.pack_size}`);
    const { data: created, error: vErr } = await db
      .from("product_variants")
      .insert({
        product_id: productId,
        sku: variantSku,
        pack_size: v.pack_size,
        label: v.label,
        price_cents: Math.max(0, Math.round(v.price_cents)),
        position: i,
      })
      .select("id")
      .single();
    if (vErr) throw new Error(`createProduct(variant ${v.pack_size}): ${vErr.message}`);

    const variantId = created.id as string;
    await db.from("inventory").insert({ variant_id: variantId }).select().maybeSingle();
    // Opening stock is vials, so it goes to the pool (pack_size 1) only — the
    // pack tiers derive their availability from it.
    if (input.initialStock && input.initialStock > 0 && v.pack_size === 1) {
      await recordMovement({
        variantId,
        qty: Math.round(input.initialStock),
        reason: "received",
        actor,
        note: "opening stock",
      });
    }
  }

  await logAudit({
    actor,
    action: "product.create",
    entityType: "product",
    entityId: slug,
    diff: { name: input.name, variants: variants.length, status: input.status ?? "draft" },
  });

  return { slug };
}

/**
 * Give an existing product its 1/3/6 tiers. Coming-soon products are created
 * with NO variants and NO inventory (see the coming_soon migration), which
 * means there is no vial pool to hold stock against — so stock can't be
 * entered until the tiers exist. This is the launch step: tiers, inventory
 * rows, opening stock, and (optionally) a flip to active, in one write.
 *
 * Refuses to run on a product that already has variants, so it can never
 * duplicate a tier structure.
 */
export async function addTiers(
  slug: string,
  opts: {
    singlePriceCents: number;
    pack3PriceCents?: number;
    pack6PriceCents?: number;
    initialStock?: number;
    activate?: boolean;
  },
  actor: string,
): Promise<void> {
  const db = adminDb();
  const { data: product, error } = await db
    .from("products")
    .select("id, sku, slug, product_variants ( id )")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`addTiers: ${error.message}`);
  if (!product) throw new Error("Product not found.");
  if ((product.product_variants as { id: string }[] | null)?.length) {
    throw new Error("This product already has pack tiers.");
  }

  const single = Math.max(0, Math.round(opts.singlePriceCents));
  const baseSku = (product.sku as string | null) ?? `ECL-${slug.toUpperCase().replace(/-/g, "").slice(0, 10)}`;
  const tiers: NewVariantInput[] = [
    { pack_size: 1, label: "1 vial", price_cents: single },
    { pack_size: 3, label: "3-pack", price_cents: opts.pack3PriceCents ?? tierPriceCents(single, 3) },
    { pack_size: 6, label: "6-pack", price_cents: opts.pack6PriceCents ?? tierPriceCents(single, 6) },
  ];

  for (const [i, tier] of tiers.entries()) {
    const variantSku = await uniqueValue("product_variants", "sku", `${baseSku}-${tier.pack_size}`);
    const { data: created, error: vErr } = await db
      .from("product_variants")
      .insert({
        product_id: product.id,
        sku: variantSku,
        pack_size: tier.pack_size,
        label: tier.label,
        price_cents: Math.max(0, Math.round(tier.price_cents)),
        position: i,
      })
      .select("id")
      .single();
    if (vErr) throw new Error(`addTiers(variant ${tier.pack_size}): ${vErr.message}`);

    const variantId = created.id as string;
    await db.from("inventory").insert({ variant_id: variantId }).select().maybeSingle();
    // Opening stock is vials, so it lands on the pool tier only.
    if (opts.initialStock && opts.initialStock > 0 && tier.pack_size === 1) {
      await recordMovement({
        variantId,
        qty: Math.round(opts.initialStock),
        reason: "received",
        actor,
        note: "opening stock",
      });
    }
  }

  if (opts.activate) {
    await db
      .from("products")
      .update({ status: "active", coming_soon_rank: null, updated_at: new Date().toISOString() })
      .eq("id", product.id);
  }

  await logAudit({
    actor,
    action: "product.tiers.add",
    entityType: "product",
    entityId: slug,
    diff: {
      single_price_cents: single,
      initial_stock: opts.initialStock ?? 0,
      activated: Boolean(opts.activate),
    },
  });
}

/**
 * Clone a product — copy, pricing, images and tier structure, as a draft with a
 * fresh slug/SKU. Stock is deliberately NOT copied (it's a different physical
 * item), so the new product starts at zero.
 */
export async function duplicateProduct(slug: string, actor: string): Promise<{ slug: string }> {
  const source = await getProductBySlug(slug);
  if (!source) throw new Error("Product not found.");

  const created = await createProduct(
    {
      name: `${source.name} (copy)`,
      slug: `${source.slug}-copy`,
      sku: `${source.sku ?? source.slug.toUpperCase()}-COPY`,
      short_description: source.short_description ?? undefined,
      description: source.description ?? undefined,
      status: "draft",
      variants: source.variants.map((v) => ({
        pack_size: v.pack_size,
        label: v.label,
        price_cents: v.price_cents,
      })),
    },
    actor,
  );

  if (source.images.length) {
    await setProductImages(created.slug, source.images, actor);
  }
  await logAudit({
    actor,
    action: "product.duplicate",
    entityType: "product",
    entityId: created.slug,
    diff: { from: slug },
  });
  return created;
}

export interface ProductPatch {
  name?: string;
  short_description?: string;
  description?: string;
  seo_title?: string;
  seo_description?: string;
  status?: "active" | "draft" | "archived" | "coming_soon";
}

export async function updateProduct(slug: string, patch: ProductPatch, actor: string): Promise<void> {
  const db = adminDb();
  const { data: before } = await db
    .from("products")
    .select("name, short_description, description, seo_title, seo_description, status")
    .eq("slug", slug)
    .maybeSingle();

  const { error } = await db
    .from("products")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("slug", slug);
  if (error) throw new Error(`updateProduct: ${error.message}`);

  await logAudit({
    actor,
    action: "product.update",
    entityType: "product",
    entityId: slug,
    diff: { before, after: patch },
  });
}

export async function updateVariant(
  variantId: string,
  patch: { price_cents?: number; compare_at_cents?: number | null; active?: boolean },
  actor: string,
): Promise<void> {
  const db = adminDb();
  const { data: before } = await db
    .from("product_variants")
    .select("sku, price_cents, compare_at_cents, active")
    .eq("id", variantId)
    .maybeSingle();

  const { error } = await db.from("product_variants").update(patch).eq("id", variantId);
  if (error) throw new Error(`updateVariant: ${error.message}`);

  await logAudit({
    actor,
    action: "variant.update",
    entityType: "product_variant",
    entityId: variantId,
    diff: { before, after: patch },
  });
}

export async function setLowStockThreshold(variantId: string, threshold: number, actor: string): Promise<void> {
  const { error } = await adminDb()
    .from("inventory")
    .update({ low_stock_threshold: Math.max(0, threshold), updated_at: new Date().toISOString() })
    .eq("variant_id", variantId);
  if (error) throw new Error(`setLowStockThreshold: ${error.message}`);
  await logAudit({
    actor,
    action: "inventory.threshold",
    entityType: "product_variant",
    entityId: variantId,
    diff: { low_stock_threshold: threshold },
  });
}

/**
 * Reason-coded stock change. Appends to the ledger and — when availability
 * crosses from nothing to something — queues the back-in-stock waitlist.
 */
export async function adjustStockWithNotify(opts: {
  variantId: string;
  qty: number;
  reason: MovementReason;
  actor: string;
  note?: string;
}): Promise<{ notified: number }> {
  const db = adminDb();
  const { data: before } = await db
    .from("inventory")
    .select("on_hand, reserved")
    .eq("variant_id", opts.variantId)
    .maybeSingle();
  const availableBefore = (before?.on_hand ?? 0) - (before?.reserved ?? 0);

  await recordMovement(opts);
  await logAudit({
    actor: opts.actor,
    action: "stock.adjust",
    entityType: "product_variant",
    entityId: opts.variantId,
    diff: { qty: opts.qty, reason: opts.reason, note: opts.note ?? null },
  });

  const { data: after } = await db
    .from("inventory")
    .select("on_hand, reserved")
    .eq("variant_id", opts.variantId)
    .maybeSingle();
  const availableAfter = (after?.on_hand ?? 0) - (after?.reserved ?? 0);

  // Restock event: nothing available → something available.
  if (availableBefore <= 0 && availableAfter > 0) {
    const notified = await queueBackInStock(opts.variantId);
    return { notified };
  }
  return { notified: 0 };
}

export interface MovementRow {
  qty: number;
  reason: string;
  actor_email: string | null;
  note: string | null;
  created_at: string;
}

export async function variantMovements(variantId: string, limit = 20): Promise<MovementRow[]> {
  const { data } = await adminDb()
    .from("stock_movements")
    .select("qty, reason, actor_email, note, created_at")
    .eq("variant_id", variantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as MovementRow[];
}

/** Variants at or below their low-stock threshold — dashboard + products filter. */
/**
 * The whole catalogue, once per request. (`lowStockVariants` below filters it.)
 *
 * Several dashboard sections need product stock at the same time. React's
 * `cache()` collapses them into a single read for the lifetime of one render,
 * which is what keeps the split-into-sections dashboard from multiplying
 * database round trips.
 */
export const listAllProducts = cache(async (): Promise<ProductListRow[]> => listProducts());

export async function lowStockVariants(): Promise<
  { sku: string; productName: string; slug: string; label: string; available: number; threshold: number }[]
> {
  const products = await listAllProducts();
  return products
    .flatMap((p) =>
      p.variants
        .filter((v) => v.available <= v.low_stock_threshold)
        .map((v) => ({
          sku: v.sku,
          productName: p.name,
          slug: p.slug,
          label: v.label,
          available: v.available,
          threshold: v.low_stock_threshold,
        })),
    )
    .sort((a, b) => a.available - b.available);
}

/** CSV of every variant with price + stock. */
export async function productsCsv(): Promise<string> {
  const products = await listProducts();
  const head = [
    "product",
    "slug",
    "variant_sku",
    "pack_size",
    "label",
    "price_aud",
    "compare_at_aud",
    "cost_aud",
    "margin_aud",
    "margin_pct",
    "on_hand",
    "reserved",
    "available",
    "low_stock_threshold",
    "status",
  ].join(",");
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = products.flatMap((p) =>
    p.variants.map((v) =>
      [
        esc(p.name),
        p.slug,
        v.sku,
        String(v.pack_size),
        esc(v.label),
        (v.price_cents / 100).toFixed(2),
        v.compare_at_cents != null ? (v.compare_at_cents / 100).toFixed(2) : "",
        p.unit_cost_cents != null ? ((p.unit_cost_cents * v.pack_size) / 100).toFixed(2) : "",
        p.unit_cost_cents != null
          ? ((v.price_cents - p.unit_cost_cents * v.pack_size) / 100).toFixed(2)
          : "",
        p.unit_cost_cents != null && v.price_cents > 0
          ? (
              ((v.price_cents - p.unit_cost_cents * v.pack_size) / v.price_cents) *
              100
            ).toFixed(1)
          : "",
        String(v.on_hand),
        String(v.reserved),
        String(v.available),
        String(v.low_stock_threshold),
        p.status,
      ].join(","),
    ),
  );
  return [head, ...lines].join("\n");
}
