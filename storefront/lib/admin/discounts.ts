/** Discount validation + application. Totals are always computed server-side. */
import { adminDb } from "./db";

export interface DiscountValidation {
  ok: boolean;
  discountCents: number;
  code?: string;
  error?: string;
  allocations?: Array<{ lineIndex: number; discountCents: number }>;
}

export interface DiscountQuoteLine {
  lineIndex: number;
  variantId: string;
  qty: number;
  unitPriceCents: number;
  legacyEligible: boolean;
  hasPriceOverride: boolean;
}

export interface ValidateDiscountInput {
  code: string;
  subtotalCents: number;
  email?: string;
  lines: DiscountQuoteLine[];
  now?: Date;
}

const LEGACY_ERRORS = {
  email_required: 'Enter the email used for your previous East Coast Labs order.',
  email_ineligible: 'Use the email from your previous East Coast Labs order.',
  no_eligible_items: 'ECLLEGACY does not apply to the products in this cart.',
  invalid_code: 'Invalid code.',
} as const;

/** Validate a code against a subtotal and return the discount amount in cents. */
export async function validateDiscount(
  { code, subtotalCents, email, lines, now = new Date() }: ValidateDiscountInput,
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

  if (data.kind === "legacy_price") {
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) return { ok: false, discountCents: 0, error: LEGACY_ERRORS.email_required };
    const { data: quote, error: quoteError } = await adminDb().rpc("commerce_legacy_discount_quote", {
      p_code: clean, p_email: normalizedEmail, p_lines: lines,
    });
    if (quoteError || !quote) throw new Error("Legacy discount validation is temporarily unavailable.");
    if (!quote.ok) return { ok: false, discountCents: 0,
      error: LEGACY_ERRORS[quote.reason as keyof typeof LEGACY_ERRORS] ?? LEGACY_ERRORS.invalid_code };
    return { ok: true, code: clean, discountCents: quote.discountCents, allocations: quote.allocations };
  }

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
