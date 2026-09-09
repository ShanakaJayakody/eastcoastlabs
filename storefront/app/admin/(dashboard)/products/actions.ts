"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import {
  updateProduct,
  updateVariant,
  setLowStockThreshold,
  adjustStockWithNotify,
  setProductImages,
  getProductBySlug,
  createProduct,
  addTiers,
  duplicateProduct,
  tierPriceCents,
  variantMovements,
  type MovementRow,
  type ProductPatch,
} from "@/lib/admin/products";
import type { MovementReason } from "@/lib/admin/inventory";
import { adminDb } from "@/lib/admin/db";
import { setUnitCost } from "@/lib/admin/costs";
import { queueBackInStock } from "@/lib/admin/notifications";
import { formatAud } from "@/lib/format";

const IMAGE_BUCKET = "product-images";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
  receiptId?: string;
  warning?: string;
  succeeded?:string[];
  failed?:{id:string;error:string}[];
}

const REASONS: MovementReason[] = ["received", "adjustment", "recount", "return", "sale"];

function fail(err: unknown): ActionResult {
  return { ok: false, error: err instanceof Error ? err.message : String(err) };
}

/** Revalidate admin views AND the storefront pages that render this product. */
function revalidateProduct(slug: string) {
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${slug}`);
  revalidatePath("/admin");
  revalidatePath(`/product/${slug}`);
  revalidatePath("/shop");
  revalidatePath("/");
}

export async function saveProduct(slug: string, patch: ProductPatch): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    await updateProduct(slug, patch, session.email);
    revalidateProduct(slug);
    return { ok: true, message: "Product saved" };
  } catch (err) {
    return fail(err);
  }
}

/** Create a product from the "Add product" form. Lands the operator in the editor. */
export async function createProductAction(input: {
  name: string;
  compound?: string;
  shortDescription?: string;
  singlePriceAud: number;
  pack3PriceAud: number;
  pack6PriceAud: number;
  initialStock?: number;
  status: "active" | "draft";
}): Promise<ActionResult & { slug?: string }> {
  const session = await requireAdmin();
  if (!input.name?.trim()) return { ok: false, error: "Product name is required." };
  if (!Number.isFinite(input.singlePriceAud) || input.singlePriceAud <= 0) {
    return { ok: false, error: "Enter a 1-vial price." };
  }
  try {
    const { slug } = await createProduct(
      {
        name: input.name,
        compound: input.compound,
        short_description: input.shortDescription,
        status: input.status,
        initialStock: input.initialStock,
        variants: [
          { pack_size: 1, label: "1 vial", price_cents: Math.round(input.singlePriceAud * 100) },
          { pack_size: 3, label: "3-pack", price_cents: Math.round(input.pack3PriceAud * 100) },
          { pack_size: 6, label: "6-pack", price_cents: Math.round(input.pack6PriceAud * 100) },
        ],
      },
      session.email,
    );
    revalidateProduct(slug);
    return { ok: true, slug, message: "Product created" };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Launch a coming-soon product: create its 1/3/6 tiers, open the stock pool and
 * (by default) put it on the storefront. Until this runs the product has no
 * vial pool, so no quantity can be entered against it.
 */
export async function addTiersAction(
  slug: string,
  input: {
    singlePriceAud: number;
    pack3PriceAud?: number;
    pack6PriceAud?: number;
    initialStock?: number;
    activate?: boolean;
  },
): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!Number.isFinite(input.singlePriceAud) || input.singlePriceAud <= 0) {
    return { ok: false, error: "Enter a 1-vial price." };
  }
  if (input.initialStock != null && (!Number.isFinite(input.initialStock) || input.initialStock < 0)) {
    return { ok: false, error: "Opening stock must be zero or more." };
  }
  try {
    await addTiers(
      slug,
      {
        singlePriceCents: Math.round(input.singlePriceAud * 100),
        pack3PriceCents:
          input.pack3PriceAud && input.pack3PriceAud > 0
            ? Math.round(input.pack3PriceAud * 100)
            : undefined,
        pack6PriceCents:
          input.pack6PriceAud && input.pack6PriceAud > 0
            ? Math.round(input.pack6PriceAud * 100)
            : undefined,
        initialStock: input.initialStock,
        activate: input.activate ?? true,
      },
      session.email,
    );
    revalidateProduct(slug);
    return { ok: true, message: "Tiers created — stock can now be managed" };
  } catch (err) {
    return fail(err);
  }
}

/** Clone an existing product as a draft — fastest path to a near-identical SKU. */
export async function duplicateProductAction(slug: string): Promise<ActionResult & { slug?: string }> {
  const session = await requireAdmin();
  try {
    const created = await duplicateProduct(slug, session.email);
    revalidateProduct(created.slug);
    return { ok: true, slug: created.slug, message: "Product duplicated" };
  } catch (err) {
    return fail(err);
  }
}

/** Suggested 3/6-pack prices for a given 1-vial price (used live by the create form). */
export async function suggestTierPrices(singleAud: number): Promise<{ pack3: number; pack6: number }> {
  const cents = Math.round(singleAud * 100);
  return { pack3: tierPriceCents(cents, 3) / 100, pack6: tierPriceCents(cents, 6) / 100 };
}

/**
 * Atomic save of everything the editor holds: details, SEO, status, per-variant
 * prices and thresholds. One dirty-state, one commit, one toast — replaces the
 * five separate save buttons the editor used to have.
 */
export async function saveProductAll(
  slug: string, patch: ProductPatch,
  variants: { id: string; priceAud: number; threshold: number }[],
  version?: number,
): Promise<ActionResult & {version?:number}> {
  const session = await requireAdmin();
  if (patch.name != null && (!patch.name.trim() || patch.name.length > 300)) return {ok:false,error:"Product name is required (maximum 300 characters)."};
  for (const v of variants) {
    if (!Number.isFinite(v.priceAud) || v.priceAud < 0 || v.priceAud > 1_000_000 || !Number.isInteger(v.threshold) || v.threshold < 0 || v.threshold > 1_000_000)
      return {ok:false,error:"Enter valid prices and whole nonnegative stock thresholds."};
  }
  try {
    const {data,error} = await adminDb().rpc("admin_save_product", {
      p_slug:slug,p_patch:patch,p_variants:variants.map(v=>({id:v.id,price_cents:Math.round(v.priceAud*100),threshold:v.threshold})),p_version:version ?? null,p_actor:session.email,
    });
    if (error) throw new Error(error.message);
    revalidateProduct(slug);
    return {ok:true,version:Number(data),message:"All changes saved"};
  } catch(err) {return fail(err);}
}

export async function saveVariantPrice(
  slug: string,
  variantId: string,
  priceAud: number,
  compareAtAud?: number | null,
): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!Number.isFinite(priceAud) || priceAud < 0) return { ok: false, error: "Invalid price." };
  try {
    await updateVariant(
      variantId,
      {
        price_cents: Math.round(priceAud * 100),
        compare_at_cents:
          compareAtAud == null || compareAtAud <= 0 ? null : Math.round(compareAtAud * 100),
      },
      session.email,
    );
    revalidateProduct(slug);
    return { ok: true, message: "Price updated" };
  } catch (err) {
    return fail(err);
  }
}

export async function saveThreshold(
  slug: string,
  variantId: string,
  threshold: number,
): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    await setLowStockThreshold(variantId, Math.round(threshold), session.email);
    revalidateProduct(slug);
    return { ok: true, message: "Threshold updated" };
  } catch (err) {
    return fail(err);
  }
}

/** Reason-coded stock movement. Reason is mandatory — the ledger demands a why. */
export async function adjustStock(
  slug: string,
  variantId: string,
  qty: number,
  reason: MovementReason,
  note?: string,
  /** Optional purchase price per vial (AUD) — only meaningful on a receipt. */
  unitCostAud?: number | null,
): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!Number.isInteger(qty) || qty===0 || Math.abs(qty)>1_000_000) return {ok:false,error:"Enter a whole nonzero quantity within 1,000,000."};
  if (!REASONS.includes(reason)) return {ok:false,error:"Choose a reason."};
  if(unitCostAud!=null && (!Number.isFinite(unitCostAud)||unitCostAud<0||unitCostAud>1_000_000)) return {ok:false,error:"Enter a valid receipt cost."};
  try {
    if(reason==="received") {
      if(qty<1)return {ok:false,error:"A receipt must add stock. Use its receipt reversal to undo."};
      const {data,error}=await adminDb().rpc("admin_receive_stock",{p_variant:variantId,p_qty:qty,p_cost:unitCostAud==null?null:Math.round(unitCostAud*100),p_actor:session.email,p_note:note??null});
      if(error)throw new Error(error.message);
      const result=data as {receipt_id:string;average_cents:number|null;became_available:boolean};
      let notifications="";
      if(result.became_available){try{const count=await queueBackInStock(variantId);notifications=` · ${count} availability emails queued (reversal cannot unsend them)`;}catch{notifications=" · availability notifications could not be queued; inspect the email queue";}}
      revalidateProduct(slug);
      return {ok:true,receiptId:result.receipt_id,message:`Receipt saved${result.average_cents==null?"":` · average ${formatAud(result.average_cents/100)}/vial`}${notifications}`};
    }
    const {notified,warning}=await adjustStockWithNotify({variantId,qty,reason,actor:session.email,note});
    revalidateProduct(slug);
    return {ok:true,warning,message:`Stock updated${notified?` · ${notified} availability emails queued`:""}`};
  } catch(err){return fail(err);}
}

export async function reverseReceipt(slug:string,receiptId:string):Promise<ActionResult>{
 const session=await requireAdmin();
 try{const {error}=await adminDb().rpc("admin_reverse_receipt",{p_receipt:receiptId,p_actor:session.email});if(error)throw new Error(error.message);revalidateProduct(slug);return {ok:true,message:"Receipt quantity and valuation reversed. Previously sent notifications cannot be recalled."};}catch(err){return fail(err);}
}

/** Movement history for one variant, fetched on demand so the stock drawer can
 *  show a ledger from the products list without every row preloading one. */
export async function fetchMovements(variantId: string): Promise<MovementRow[]> {
  await requireAdmin();
  return variantMovements(variantId);
}

/** Manually set a product's cost per vial (no receipt involved). */
export async function saveUnitCost(slug: string, unitCostAud: number | null): Promise<ActionResult> {
  await requireAdmin();
  if (unitCostAud != null && (!Number.isFinite(unitCostAud) || unitCostAud < 0)) {
    return { ok: false, error: "Enter a valid cost." };
  }
  try {
    const product = await getProductBySlug(slug);
    if (!product) return { ok: false, error: "Product not found." };
    await setUnitCost(product.id, unitCostAud == null ? null : Math.round(unitCostAud * 100));
    revalidateProduct(slug);
    return { ok: true, message: "Cost updated" };
  } catch (err) {
    return fail(err);
  }
}

/** Bulk: apply the same stock movement to many variants at once. */
export async function bulkAdjustStock(
  variantIds: string[],
  qty: number,
  reason: MovementReason,
): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!variantIds.length) return { ok: false, error: "Nothing selected." };
  if (!Number.isFinite(qty) || qty === 0) return { ok: false, error: "Enter a non-zero quantity." };
  if (!REASONS.includes(reason)) return { ok: false, error: "Choose a reason." };
  const succeeded:string[]=[];const failed:{id:string;error:string}[]=[];const warnings:string[]=[];let notified=0;
  for(const id of [...new Set(variantIds)]){
    try{const result=await adjustStockWithNotify({variantId:id,qty:Math.round(qty),reason,actor:session.email,note:"bulk update"});notified+=result.notified;succeeded.push(id);if(result.warning)warnings.push(`${id}: ${result.warning}`);}
    catch(err){failed.push({id,error:err instanceof Error?err.message:String(err)});}
  }
  revalidatePath("/admin/products");revalidatePath("/admin");revalidatePath("/shop");
  return {ok:failed.length===0,succeeded,failed,warning:warnings.length?warnings.join(" "):undefined,message:`Updated ${succeeded.length} variants · ${failed.length} failed${notified?` · ${notified} emails queued`:""}`};
}

/** Bulk: percentage price change across selected variants. */
export async function bulkPriceChange(variantIds: string[], pct: number): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!variantIds.length) return { ok: false, error: "Nothing selected." };
  if (!Number.isFinite(pct) || pct === 0) return { ok: false, error: "Enter a non-zero percentage." };
  if (pct < -90 || pct > 500) return { ok: false, error: "Percentage out of safe range." };
  const succeeded:string[]=[];const failed:{id:string;error:string}[]=[];
  const {data,error}=await adminDb().from("product_variants").select("id,price_cents").in("id",variantIds);
  if(error)return fail(error.message);
  const prices=new Map((data??[]).map(v=>[v.id,v.price_cents]));
  for(const id of [...new Set(variantIds)]){
    try{if(!prices.has(id))throw new Error("Variant no longer exists");const next=Math.max(0,Math.round(Number(prices.get(id))*(1+pct/100)));await updateVariant(id,{price_cents:next},session.email);succeeded.push(id);}
    catch(err){failed.push({id,error:err instanceof Error?err.message:String(err)});}
  }
  revalidatePath("/admin/products");revalidatePath("/shop");revalidatePath("/");
  return {ok:failed.length===0,succeeded,failed,message:`Repriced ${succeeded.length} variants · ${failed.length} failed`};
}

export interface ImageResult extends ActionResult {
  images?: { src: string; alt?: string }[];
}

/** Upload an image to the public product-images bucket and append it to the
 *  product's images array. */
export async function uploadProductImage(slug: string, formData: FormData): Promise<ImageResult> {
  const session = await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image file." };
  if (!file.type.startsWith("image/")) return { ok: false, error: "File must be an image." };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "Image must be under 8MB." };

  try {
    const product = await getProductBySlug(slug);
    if (!product) return { ok: false, error: "Product not found." };

    const db = adminDb();
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${slug}/${Date.now()}.${ext}`;
    const { error: upErr } = await db.storage
      .from(IMAGE_BUCKET)
      .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
    if (upErr) throw new Error(upErr.message);

    const publicUrl = db.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
    const images = [...product.images, { src: publicUrl, alt: product.name }];
    await setProductImages(slug, images, session.email);

    revalidatePath(`/admin/products/${slug}`);
    revalidatePath(`/product/${slug}`);
    return { ok: true, message: "Image uploaded", images };
  } catch (err) {
    return fail(err);
  }
}

export async function removeProductImage(slug: string, src: string): Promise<ImageResult> {
  const session = await requireAdmin();
  try {
    const product = await getProductBySlug(slug);
    if (!product) return { ok: false, error: "Product not found." };
    const images = product.images.filter((img) => img.src !== src);
    await setProductImages(slug, images, session.email);

    // Best-effort storage cleanup — path is the part of the public URL after the bucket name.
    const marker = `/${IMAGE_BUCKET}/`;
    const idx = src.indexOf(marker);
    if (idx !== -1) {
      const path = src.slice(idx + marker.length);
      await adminDb().storage.from(IMAGE_BUCKET).remove([path]).catch(() => {});
    }

    revalidatePath(`/admin/products/${slug}`);
    revalidatePath(`/product/${slug}`);
    return { ok: true, message: "Image removed", images };
  } catch (err) {
    return fail(err);
  }
}

export async function reorderProductImages(slug: string, orderedSrcs: string[]): Promise<ImageResult> {
  const session = await requireAdmin();
  try {
    const product = await getProductBySlug(slug);
    if (!product) return { ok: false, error: "Product not found." };
    const bySrc = new Map(product.images.map((img) => [img.src, img]));
    const images = orderedSrcs.map((src) => bySrc.get(src)).filter((img): img is { src: string; alt?: string } => Boolean(img));
    await setProductImages(slug, images, session.email);
    revalidatePath(`/admin/products/${slug}`);
    revalidatePath(`/product/${slug}`);
    return { ok: true, images };
  } catch (err) {
    return fail(err);
  }
}
