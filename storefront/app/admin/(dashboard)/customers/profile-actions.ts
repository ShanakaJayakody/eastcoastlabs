"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { adminDb } from "@/lib/admin/db";
import { parseCustomerDetails } from "@/lib/admin/customer-details";

export async function saveCustomerDetails(email: string, input: unknown, version: number): Promise<
  { ok: true; message: string; email: string; version: number } | { ok: false; message: string }
> {
  const session = await requireAdmin();
  const details = parseCustomerDetails(input);
  if (!details || typeof email !== "string" || !Number.isSafeInteger(version) || version < 0) {
    return { ok: false, message: "Enter a valid email and customer details." };
  }
  const original = email.trim().toLowerCase();
  const { data, error } = await adminDb().rpc("admin_save_customer", {
    p_email: original, p_details: details, p_version: version, p_actor: session.email,
  });
  if (error) return { ok: false, message: error.message };
  if (!data || typeof data.email !== "string" || !Number.isSafeInteger(data.version)) {
    return { ok: false, message: "The save result could not be verified. Reload the customer before trying again." };
  }
  for (const value of new Set([original, data.email])) revalidatePath(`/admin/customers/${encodeURIComponent(value)}`);
  revalidatePath("/admin/customers");
  revalidatePath("/admin/orders", "layout");
  revalidatePath("/admin/recovery");
  revalidatePath("/admin/automation");
  revalidatePath("/admin");
  return { ok: true, message: "Customer details saved.", email: data.email, version: data.version };
}
