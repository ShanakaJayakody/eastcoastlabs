/** Discount validation + application. Totals are always computed server-side. */
import { adminDb } from "./db";

export interface DiscountValidation {
  ok: boolean;
  discountCents: number;
  code?: string;
  error?: string;
}

/** Validate a code against a subtotal and return the discount amount in cents. */
export async function validateDiscount(
  code: string,
  subtotalCents: number,
  now: Date = new Date(),
): Promise<DiscountValidation> {
  const clean = code.trim().toUpperCase();
  if (!clean) return { ok: false, discountCents: 0, error: "No code provided." };

  const { data, error } = await adminDb()
    .from("discounts")
    .select("*")
    .eq("code", clean)
    .maybeSingle();
  if (error) throw new Error(`validateDiscount: ${error.message}`);
  if (!data || !data.active) return { ok: false, discountCents: 0, error: "Invalid code." };

  if (data.starts_at && new Date(data.starts_at) > now)
    return { ok: false, discountCents: 0, error: "This code isn't active yet." };
  if (data.expires_at && new Date(data.expires_at) < now)
    return { ok: false, discountCents: 0, error: "This code has expired." };
  if (data.usage_limit != null && data.used_count >= data.usage_limit)
    return { ok: false, discountCents: 0, error: "This code has reached its usage limit." };
  if (subtotalCents < data.min_spend_cents)
    return { ok: false, discountCents: 0, error: "Order doesn't meet the minimum spend." };

  const discountCents =
    data.kind === "percent"
      ? Math.round((subtotalCents * data.percent) / 100)
      : Math.min(data.value_cents, subtotalCents);

  return { ok: true, discountCents, code: clean };
}

/** Increment usage — called once when an order using the code is paid. */
export async function incrementDiscountUsage(code: string): Promise<void> {
  const clean = code.trim().toUpperCase();
  const db = adminDb();
  const { data } = await db.from("discounts").select("used_count").eq("code", clean).maybeSingle();
  if (!data) return;
  await db
    .from("discounts")
    .update({ used_count: data.used_count + 1 })
    .eq("code", clean);
}
