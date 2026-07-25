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

const BUCKET = "coa";

/** Create/update a COA batch, optionally uploading the PDF to the public `coa` bucket. */
export async function saveCoaBatch(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();

  const batchId = String(formData.get("batch_id") ?? "").trim();
  const compound = String(formData.get("compound") ?? "").trim();
  const purity = Number(formData.get("purity_pct") ?? 0);
  const lab = String(formData.get("lab") ?? "JanoShik").trim() || "JanoShik";
  const testDate = String(formData.get("test_date") ?? "").trim();
  const labVerifyUrl = String(formData.get("lab_verify_url") ?? "").trim();
  const file = formData.get("pdf");

  if (!batchId) return { ok: false, error: "Batch ID is required." };
  if (!compound) return { ok: false, error: "Compound is required." };
  if (!Number.isFinite(purity) || purity <= 0 || purity > 100)
    return { ok: false, error: "Purity must be between 0 and 100." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(testDate)) return { ok: false, error: "Test date is required." };

  try {
    const db = adminDb();
    let coaUrl: string | null = null;

    if (file instanceof File && file.size > 0) {
      if (file.type !== "application/pdf") return { ok: false, error: "COA must be a PDF." };
      if (file.size > 10 * 1024 * 1024) return { ok: false, error: "PDF must be under 10MB." };
      const path = `${batchId.replace(/[^A-Za-z0-9._-]/g, "_")}.pdf`;
      const { error: upErr } = await db.storage
        .from(BUCKET)
        .upload(path, await file.arrayBuffer(), { contentType: "application/pdf", upsert: true });
      if (upErr) throw new Error(`upload: ${upErr.message}`);
      coaUrl = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    }

    const row: Record<string, unknown> = {
      batch_id: batchId,
      compound,
      purity_pct: purity,
      lab,
      test_date: testDate,
      lab_verify_url: labVerifyUrl || null,
    };
    if (coaUrl) row.coa_url = coaUrl;

    const { error } = await db.from("coa_batches").upsert(row, { onConflict: "batch_id" });
    if (error) throw new Error(error.message);

    await logAudit({
      actor: session.email,
      action: "coa.save",
      entityType: "coa_batch",
      entityId: batchId,
      diff: { compound, purity, testDate, uploaded: Boolean(coaUrl) },
    });

    revalidatePath("/admin/coas");
    revalidatePath("/lab-results");
    return { ok: true, message: coaUrl ? "Batch saved with PDF" : "Batch saved" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteCoaBatch(batchId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    const { error } = await adminDb().from("coa_batches").delete().eq("batch_id", batchId);
    if (error) throw new Error(error.message);
    await logAudit({ actor: session.email, action: "coa.delete", entityType: "coa_batch", entityId: batchId });
    revalidatePath("/admin/coas");
    revalidatePath("/lab-results");
    return { ok: true, message: `${batchId} deleted` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
