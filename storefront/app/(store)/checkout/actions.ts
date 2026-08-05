"use server";

/**
 * Native checkout.
 *
 * The client posts contact + shipping details and its cart lines WITHOUT prices;
 * lib/checkout.ts re-derives every amount server-side, then createOrder() writes
 * a `pending` order and atomically reserves stock.
 *
 * Payment is customer-initiated (PayID or bank transfer), so "place order" and
 * "pay" are two separate events. The order exists the moment the shopper
 * submits; the payment details, reference, and hold window are shown next.
 */

import { resolveCart, type ClientCartLine } from "@/lib/checkout";
import { createOrder, setOrderPaymentPlan } from "@/lib/admin/orders";
import { validateDiscount } from "@/lib/admin/discounts";
import { captureCart, markCartRecovered } from "@/lib/admin/cart-recovery";
import { getSettings } from "@/lib/settings";
import { quoteShipping, shippingCentsFor, isShippingMethod, type ShippingMethod, type ShippingQuote } from "@/lib/shipping";
import {
  availablePaymentOptions,
  isPaymentMethod,
  referenceForOrderNumber,
  type PaymentMethod,
  type PaymentOption,
} from "@/lib/payments";
import { queueEmail } from "@/lib/admin/email";

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
  paymentMethod?: PaymentMethod;
  shippingMethod?: ShippingMethod;
  deliveryInstructions?: string;
}

export type PlaceOrderResult =
  | { ok: true; orderNumber: string; orderId: string; totalCents: number; warnings: string[] }
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

export interface CartQuote {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  shippingMethod: ShippingMethod;
  shippingOptions: ShippingQuote[];
  totalCents: number;
  giftApplied: boolean;
  discountError?: string;
  warnings: string[];
  paymentOptions: PaymentOption[];
}

/** Quote the cart server-side (used by the checkout summary so displayed totals
 *  are the same numbers the order will be written with). */
export async function quoteCart(
  lines: ClientCartLine[],
  discountCode?: string,
  shippingMethod?: ShippingMethod,
): Promise<CartQuote> {
  const [resolved, settings] = await Promise.all([resolveCart(lines), getSettings()]);
  let discountCents = 0;
  let discountError: string | undefined;
  if (discountCode?.trim()) {
    const d = await validateDiscount(discountCode, resolved.subtotalCents);
    if (d.ok) discountCents = d.discountCents;
    else discountError = d.error;
  }
  const afterDiscount = resolved.subtotalCents - discountCents;
  const requested = isShippingMethod(shippingMethod) ? shippingMethod : "standard";
  const shipping = shippingCentsFor(afterDiscount, requested, settings);

  return {
    subtotalCents: resolved.subtotalCents,
    discountCents,
    shippingCents: shipping.cents,
    shippingMethod: shipping.method,
    shippingOptions: quoteShipping(afterDiscount, settings),
    totalCents: afterDiscount + shipping.cents,
    giftApplied: resolved.giftApplied,
    discountError,
    warnings: resolved.warnings,
    paymentOptions: availablePaymentOptions(settings),
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
    const [resolved, settings] = await Promise.all([resolveCart(input.lines), getSettings()]);
    if (!resolved.items.length && !resolved.extraItems.length) {
      return { ok: false, error: "None of the items in your cart are available." };
    }

    // The payment method must be one we currently offer — a stale or tampered
    // value falls back to the first configured method rather than writing an
    // order nobody can pay for.
    const offered = availablePaymentOptions(settings);
    if (!offered.length) {
      return {
        ok: false,
        error: "Payments are temporarily unavailable. Please contact support before ordering.",
      };
    }
    const paymentMethod: PaymentMethod =
      isPaymentMethod(input.paymentMethod) && offered.some((o) => o.method === input.paymentMethod)
        ? input.paymentMethod
        : offered[0].method;

    // Shipping is priced server-side from the discounted subtotal for the same
    // reason prices are: the client may ask for express, it may not decide what
    // express costs.
    const discount = input.discountCode?.trim()
      ? await validateDiscount(input.discountCode, resolved.subtotalCents)
      : null;
    const discountCents = discount?.ok ? discount.discountCents : 0;
    const requested = isShippingMethod(input.shippingMethod) ? input.shippingMethod : "standard";
    const shipping = shippingCentsFor(resolved.subtotalCents - discountCents, requested, settings);

    const instructions = input.deliveryInstructions?.trim().slice(0, 500);

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
        shipping_method: shipping.method,
        delivery_instructions: instructions || null,
      },
      items: resolved.items,
      extraItems: resolved.extraItems,
      discountCode: input.discountCode?.trim() || undefined,
      shippingCents: shipping.cents,
      paymentMethod,
      actor: input.email.trim().toLowerCase(),
    });

    // The reference and the hold window are what make a customer-initiated
    // payment matchable and time-bounded. Written immediately after create so an
    // order can never exist in `pending` without them.
    const reference = referenceForOrderNumber(order.orderNumber);
    await setOrderPaymentPlan(order.orderId, {
      reference,
      expiryHours: settings.paymentExpiryHours,
    });

    // Payment instructions email. Best-effort: a mail failure must not lose the
    // order — the details are also on the confirmation page the shopper is about
    // to land on, and the reminder sweep will try again.
    await queueEmail({
      to: input.email,
      template: "payment_instructions",
      payload: {
        order_number: order.orderNumber,
        order_id: order.orderId,
        payment_method: paymentMethod,
        reference,
        amount_cents: order.totalCents,
      },
      relatedType: "order",
      relatedId: order.orderId,
    }).catch((err) => console.error("payment_instructions email failed:", err));

    // Best-effort: suppression failing must never break checkout, but it should
    // be visible server-side rather than silently swallowed (a failure here means
    // a real customer could get a stale "you left this in your cart" email).
    await markCartRecovered(input.email, order.orderId).catch((err) =>
      console.error("markCartRecovered failed:", err),
    );

    return {
      ok: true,
      orderNumber: order.orderNumber,
      orderId: order.orderId,
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
