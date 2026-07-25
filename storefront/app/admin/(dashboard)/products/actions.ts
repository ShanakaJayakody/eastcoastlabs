"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import {
  updateProduct,
  updateVariant,
  setLowStockThreshold,
  adjustStockWithNotify,
  type ProductPatch,
} from "@/lib/admin/products";
import type { MovementReason } from "@/lib/admin/inventory";

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
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
): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!Number.isFinite(qty) || qty === 0) return { ok: false, error: "Enter a non-zero quantity." };
  if (!REASONS.includes(reason)) return { ok: false, error: "Choose a reason for this change." };
  try {
    const { notified } = await adjustStockWithNotify({
      variantId,
      qty: Math.round(qty),
      reason,
      actor: session.email,
      note,
    });
    revalidateProduct(slug);
    return {
      ok: true,
      message: notified
        ? `Stock updated — ${notified} back-in-stock ${notified === 1 ? "email" : "emails"} queued`
        : "Stock updated",
    };
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
  try {
    let notified = 0;
    for (const id of variantIds) {
      const res = await adjustStockWithNotify({
        variantId: id,
        qty: Math.round(qty),
        reason,
        actor: session.email,
        note: "bulk update",
      });
      notified += res.notified;
    }
    revalidatePath("/admin/products");
    revalidatePath("/admin");
    revalidatePath("/shop");
    return {
      ok: true,
      message: `Updated ${variantIds.length} variants${notified ? ` · ${notified} emails queued` : ""}`,
    };
  } catch (err) {
    return fail(err);
  }
}

/** Bulk: percentage price change across selected variants. */
export async function bulkPriceChange(variantIds: string[], pct: number): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!variantIds.length) return { ok: false, error: "Nothing selected." };
  if (!Number.isFinite(pct) || pct === 0) return { ok: false, error: "Enter a non-zero percentage." };
  if (pct < -90 || pct > 500) return { ok: false, error: "Percentage out of safe range." };
  try {
    const { adminDb } = await import("@/lib/admin/db");
    const db = adminDb();
    const { data } = await db.from("product_variants").select("id, price_cents").in("id", variantIds);
    for (const v of data ?? []) {
      const next = Math.max(0, Math.round((v.price_cents as number) * (1 + pct / 100)));
      await updateVariant(v.id as string, { price_cents: next }, session.email);
    }
    revalidatePath("/admin/products");
    revalidatePath("/shop");
    revalidatePath("/");
    return { ok: true, message: `Repriced ${(data ?? []).length} variants by ${pct}%` };
  } catch (err) {
    return fail(err);
  }
}
