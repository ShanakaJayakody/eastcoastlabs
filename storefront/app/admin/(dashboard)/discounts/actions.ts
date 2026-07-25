"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { adminDb } from "@/lib/admin/db";
import { logAudit } from "@/lib/admin/audit";

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

export interface DiscountInput {
  code: string;
  kind: "percent" | "fixed";
  amount: number; // percent points, or AUD for fixed
  minSpendAud: number;
  usageLimit?: number | null;
  expiresAt?: string | null;
}

export async function createDiscount(input: DiscountInput): Promise<ActionResult> {
  const session = await requireAdmin();
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(code))
    return { ok: false, error: "Code must be 3–32 chars (A–Z, 0–9, - or _)." };
  if (input.kind === "percent" && (input.amount < 1 || input.amount > 100))
    return { ok: false, error: "Percentage must be 1–100." };
  if (input.kind === "fixed" && input.amount <= 0)
    return { ok: false, error: "Fixed amount must be positive." };

  try {
    const { error } = await adminDb()
      .from("discounts")
      .insert({
        code,
        kind: input.kind,
        percent: input.kind === "percent" ? Math.round(input.amount) : null,
        value_cents: input.kind === "fixed" ? Math.round(input.amount * 100) : null,
        min_spend_cents: Math.max(0, Math.round(input.minSpendAud * 100)),
        usage_limit: input.usageLimit && input.usageLimit > 0 ? Math.round(input.usageLimit) : null,
        expires_at: input.expiresAt || null,
        active: true,
      });
    if (error) throw new Error(error.message);

    await logAudit({
      actor: session.email,
      action: "discount.create",
      entityType: "discount",
      entityId: code,
      diff: { ...input, code },
    });
    revalidatePath("/admin/discounts");
    return { ok: true, message: `${code} created` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg.includes("duplicate") ? "That code already exists." : msg };
  }
}

export async function toggleDiscount(code: string, active: boolean): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    const { error } = await adminDb().from("discounts").update({ active }).eq("code", code);
    if (error) throw new Error(error.message);
    await logAudit({
      actor: session.email,
      action: active ? "discount.enable" : "discount.disable",
      entityType: "discount",
      entityId: code,
    });
    revalidatePath("/admin/discounts");
    return { ok: true, message: `${code} ${active ? "enabled" : "disabled"}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteDiscount(code: string): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    const { error } = await adminDb().from("discounts").delete().eq("code", code);
    if (error) throw new Error(error.message);
    await logAudit({ actor: session.email, action: "discount.delete", entityType: "discount", entityId: code });
    revalidatePath("/admin/discounts");
    return { ok: true, message: `${code} deleted` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
