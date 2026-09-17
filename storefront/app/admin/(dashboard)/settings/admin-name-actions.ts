"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { adminDb } from "@/lib/admin/db";
import { logAudit } from "@/lib/admin/audit";

export async function saveAdminName(id: string, name: string): Promise<{ ok: boolean; error?: string; warning?: string }> {
  const session = await requireAdmin();
  if (typeof id !== "string" || !/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id)) {
    return { ok: false, error: "Choose an existing admin." };
  }
  if (typeof name !== "string" || !name.trim() || name.trim().length > 80 || /[@\p{Cc}]/u.test(name)) {
    return { ok: false, error: "Enter a name of up to 80 characters, rather than an email address." };
  }
  const cleanName = name.trim();
  const { data, error } = await adminDb().from("admin_users").update({ name: cleanName }).eq("id", id).select("id").maybeSingle();
  if (error) return { ok: false, error: "The admin name could not be saved. Please try again." };
  if (!data) return { ok: false, error: "This admin no longer exists. Refresh Settings." };
  let warning: string | undefined;
  try {
    await logAudit({ actor: session.email, action: "admin.name.update", entityType: "admin_user", entityId: id, diff: { name: cleanName } }, { strict: true });
  } catch {
    warning = "Name saved, but audit recording could not be confirmed.";
  }
  revalidatePath("/admin", "layout");
  return { ok: true, warning };
}
