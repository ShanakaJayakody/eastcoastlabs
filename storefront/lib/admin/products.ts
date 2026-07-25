/**
 * Product + stock read/write for the admin. Stock changes always go through the
 * ledger (lib/admin/inventory.ts) — nothing here writes inventory.on_hand.
 */
import { adminDb } from "./db";
import { logAudit } from "./audit";
import { recordMovement, type MovementReason } from "./inventory";
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

function mapVariant(v: RawVariant): VariantRow {
  const onHand = v.inventory?.on_hand ?? 0;
  const reserved = v.inventory?.reserved ?? 0;
  return {
    id: v.id,
    sku: v.sku,
    pack_size: v.pack_size,
    label: v.label,
    price_cents: v.price_cents,
    compare_at_cents: v.compare_at_cents,
    low_stock_threshold: v.inventory?.low_stock_threshold ?? 5,
    on_hand: onHand,
    reserved,
    available: onHand - reserved,
    active: v.active,
  };
}

const SELECT_PRODUCT = `
  id, slug, name, sku, status, images, short_description, description, seo_title, seo_description,
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
    const variants = (p.product_variants ?? [])
      .map(mapVariant)
      .sort((a, b) => a.pack_size - b.pack_size);
    const totalOnHand = variants.reduce((s, v) => s + v.on_hand, 0);
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      sku: p.sku,
      status: p.status,
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
  const variants = (p.product_variants ?? []).map(mapVariant).sort((a, b) => a.pack_size - b.pack_size);
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    sku: p.sku,
    status: p.status,
    image: firstImage(p.images),
    variants,
    totalOnHand: variants.reduce((s, v) => s + v.on_hand, 0),
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

export interface ProductPatch {
  name?: string;
  short_description?: string;
  description?: string;
  seo_title?: string;
  seo_description?: string;
  status?: "active" | "draft" | "archived";
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
export async function lowStockVariants(): Promise<
  { sku: string; productName: string; slug: string; label: string; available: number; threshold: number }[]
> {
  const products = await listProducts();
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
