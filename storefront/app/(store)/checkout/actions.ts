"use server";

/**
 * Native checkout. Replaces the old WooCommerce /checkout hand-off.
 *
 * The client posts contact + shipping details and its cart lines WITHOUT prices;
 * lib/checkout.ts re-derives every amount server-side, then createOrder() writes
 * a `pending` order and atomically reserves stock. Payment comes after: Bankful
 * when credentials land (Phase F), bank transfer in the meantime — either way the
 * order exists in the admin the moment the shopper submits.
 */

import { resolveCart, type ClientCartLine } from "@/lib/checkout";
import { createOrder } from "@/lib/admin/orders";
import { validateDiscount } from "@/lib/admin/discounts";
import { captureCart, markCartRecovered } from "@/lib/admin/cart-recovery";

export interface CheckoutAddress {
  line1: string;
  line2?: string;
  suburb: string;
  state: string;
  postcode: string;
  country?: string;
  phone?: string;
}

export interface PlaceOrderInput {
  email: string;
  name: string;
  address: CheckoutAddress;
  lines: ClientCartLine[];
  discountCode?: string;
}

export type PlaceOrderResult =
  | { ok: true; orderNumber: string; totalCents: number; warnings: string[] }
  | { ok: false; error: string; outOfStockSku?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(input: PlaceOrderInput): string | null {
  if (!input.email || !EMAIL_RE.test(input.email.trim())) return "Enter a valid email address.";
  if (!input.name?.trim()) return "Enter your full name.";
  const a = input.address;
  if (!a?.line1?.trim()) return "Enter your street address.";
  if (!a.suburb?.trim()) return "Enter your suburb.";
  if (!a.state?.trim()) return "Select your state.";
  if (!/^\d{4}$/.test((a.postcode ?? "").trim())) return "Enter a valid 4-digit postcode.";
  if (!input.lines?.length) return "Your cart is empty.";
  return null;
}

/** Quote the cart server-side (used by the checkout summary so displayed totals
 *  are the same numbers the order will be written with). */
export async function quoteCart(
  lines: ClientCartLine[],
  discountCode?: string,
): Promise<{
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  giftApplied: boolean;
  discountError?: string;
  warnings: string[];
}> {
  const resolved = await resolveCart(lines);
  let discountCents = 0;
  let discountError: string | undefined;
  if (discountCode?.trim()) {
    const d = await validateDiscount(discountCode, resolved.subtotalCents);
    if (d.ok) discountCents = d.discountCents;
    else discountError = d.error;
  }
  const afterDiscount = resolved.subtotalCents - discountCents;
  const shippingCents = afterDiscount >= 15000 ? 0 : afterDiscount > 0 ? 1200 : 0;
  return {
    subtotalCents: resolved.subtotalCents,
    discountCents,
    shippingCents,
    totalCents: afterDiscount + shippingCents,
    giftApplied: resolved.giftApplied,
    discountError,
    warnings: resolved.warnings,
  };
}

/** Capture email + cart for abandoned-cart recovery. Fire-and-forget from the
 *  client (email blur); never blocks or errors the checkout flow. */
export async function captureCartEmail(email: string, lines: ClientCartLine[]): Promise<void> {
  if (!email?.includes("@") || !lines?.length) return;
  try {
    const resolved = await resolveCart(lines);
    const named = lines.map((l) => ({
      name: l.slug,
      variantLabel: l.variantLabel,
      quantity: l.quantity,
    }));
    await captureCart(email, named, resolved.subtotalCents);
  } catch {
    /* best-effort — never surfaces to the shopper */
  }
}

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };

  try {
    const resolved = await resolveCart(input.lines);
    if (!resolved.items.length && !resolved.extraItems.length) {
      return { ok: false, error: "None of the items in your cart are available." };
    }

    const order = await createOrder({
      email: input.email,
      name: input.name.trim(),
      shippingAddress: {
        line1: input.address.line1.trim(),
        line2: input.address.line2?.trim() || null,
        suburb: input.address.suburb.trim(),
        state: input.address.state.trim(),
        postcode: input.address.postcode.trim(),
        country: input.address.country?.trim() || "AU",
        phone: input.address.phone?.trim() || null,
      },
      items: resolved.items,
      extraItems: resolved.extraItems,
      discountCode: input.discountCode?.trim() || undefined,
      paymentMethod: "bank_transfer",
      actor: input.email.trim().toLowerCase(),
    });

    // Best-effort: suppression failing must never break checkout, but it should
    // be visible server-side rather than silently swallowed (a failure here means
    // a real customer could get a stale "you left this in your cart" email).
    await markCartRecovered(input.email, order.orderId).catch((err) =>
      console.error("markCartRecovered failed:", err),
    );

    return {
      ok: true,
      orderNumber: order.orderNumber,
      totalCents: order.totalCents,
      warnings: resolved.warnings,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("OUT_OF_STOCK:")) {
      const sku = msg.split(":")[1];
      return {
        ok: false,
        error: "One of your items just sold out. Please adjust your cart and try again.",
        outOfStockSku: sku,
      };
    }
    console.error("placeOrder failed:", msg);
    return { ok: false, error: "We couldn't place your order. Please try again." };
  }
}
