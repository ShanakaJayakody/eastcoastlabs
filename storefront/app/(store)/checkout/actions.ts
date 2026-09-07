"use server";

import { after } from "next/server";
import { createHash } from "node:crypto";
import { resolveCart, type ClientCartLine, type ResolvedCartLine } from "@/lib/checkout";
import { createOrder, findCheckoutReplay, type CreatedOrder } from "@/lib/admin/orders";
import { validateDiscount } from "@/lib/admin/discounts";
import { captureCart, markCartRecovered } from "@/lib/admin/cart-recovery";
import { getSettings } from "@/lib/settings";
import { quoteShipping, shippingCentsFor, isShippingMethod, type ShippingMethod, type ShippingQuote } from "@/lib/shipping";
import { availablePaymentOptions, isPaymentMethod, type PaymentMethod, type PaymentOption } from "@/lib/payments";
import { paymentPath, createOrderAccessToken } from "@/lib/order-access";

export interface CheckoutAddress {
  line1: string; line2?: string; suburb: string; state: string; postcode: string; country?: string; phone?: string;
}
export interface PlaceOrderInput {
  email: string; name: string; address: CheckoutAddress; lines: ClientCartLine[];
  discountCode?: string; paymentMethod?: PaymentMethod; shippingMethod?: ShippingMethod; deliveryInstructions?: string;
  idempotencyKey: string; quoteVersion: string; recoveryEpisodeId?: string;
}
export type PlaceOrderResult =
  | { ok: true; orderNumber: string; orderId: string; totalCents: number; warnings: string[]; paymentUrl: string; replayed: boolean; purchasedLines?: ResolvedCartLine[] }
  | { ok: false; error: string; outOfStockSku?: string; quote?: CartQuote };
export interface CartQuote {
  lines: ResolvedCartLine[]; version: string;
  subtotalCents: number; discountCents: number; shippingCents: number; shippingMethod: ShippingMethod;
  shippingOptions: ShippingQuote[]; totalCents: number; giftApplied: boolean; discountError?: string;
  warnings: string[]; paymentOptions: PaymentOption[];
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const bounded = (v: unknown, max: number, required = true): v is string =>
  typeof v === "string" && v.length <= max && (!required || v.trim().length > 0);
function validateLines(lines: ClientCartLine[]): boolean {
  return Array.isArray(lines) && lines.length > 0 && lines.length <= 50 && lines.every((l) =>
    l && bounded(l.key, 160) && bounded(l.slug, 120) && bounded(l.variantLabel, 160)
    && Number.isInteger(l.quantity) && l.quantity >= 1 && l.quantity <= 99)
    && new Set(lines.map((l) => l.key)).size === lines.length;
}
function validate(input: PlaceOrderInput): string | null {
  if (!input || !bounded(input.email, 254) || !EMAIL_RE.test(input.email.trim())) return "Enter a valid email address.";
  if (!bounded(input.name, 150)) return "Enter your full name (up to 150 characters).";
  const a = input.address;
  if (!a || !bounded(a.line1, 200)) return "Enter your street address.";
  if (!bounded(a.suburb, 100)) return "Enter your suburb.";
  if (!bounded(a.state, 3) || !["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"].includes(a.state.trim().toUpperCase())) return "Select an Australian state or territory.";
  if (!bounded(a.postcode, 4) || !/^\d{4}$/.test(a.postcode)) return "Enter a valid 4-digit postcode.";
  if (a.country !== undefined && (!bounded(a.country, 2) || a.country.toUpperCase() !== "AU")) return "We currently ship within Australia.";
  if ((a.line2 !== undefined && !bounded(a.line2, 200, false)) || (a.phone !== undefined && !bounded(a.phone, 30, false)) || (input.deliveryInstructions !== undefined && !bounded(input.deliveryInstructions, 500, false))) return "Please shorten your address, phone or delivery instructions.";
  if (!validateLines(input.lines)) return "Your cart contains invalid items or quantities. Please review it.";
  if (!bounded(input.idempotencyKey, 36) || !UUID.test(input.idempotencyKey)) return "Please refresh checkout before placing your order.";
  if (!bounded(input.quoteVersion, 80)) return "Wait for your order total to load.";
  if (input.recoveryEpisodeId !== undefined && (!bounded(input.recoveryEpisodeId, 36) || !UUID.test(input.recoveryEpisodeId))) return "Please refresh checkout.";
  if (input.discountCode !== undefined && !bounded(input.discountCode, 50, false)) return "Enter a valid discount code.";
  return null;
}

async function resolveQuote(lines: ClientCartLine[], discountCode?: string, shippingMethod?: ShippingMethod) {
  if (!validateLines(lines)) throw new Error("Your cart contains invalid items or quantities.");
  if (discountCode !== undefined && !bounded(discountCode, 50, false)) throw new Error("Invalid discount code.");
  const [resolved, settings] = await Promise.all([resolveCart(lines), getSettings()]);
  const discount = discountCode?.trim() ? await validateDiscount(discountCode, resolved.subtotalCents) : null;
  const discountCents = discount?.ok ? discount.discountCents : 0;
  const afterDiscount = resolved.subtotalCents - discountCents;
  const shipping = shippingCentsFor(afterDiscount, isShippingMethod(shippingMethod) ? shippingMethod : "standard", settings);
  const value = {
    lines: resolved.lines, subtotalCents: resolved.subtotalCents, discountCents, shippingCents: shipping.cents,
    shippingMethod: shipping.method, shippingOptions: quoteShipping(afterDiscount, settings),
    totalCents: afterDiscount + shipping.cents, giftApplied: resolved.giftApplied,
    discountError: discount && !discount.ok ? discount.error : undefined,
    warnings: resolved.warnings, paymentOptions: availablePaymentOptions(settings),
  };
  // Includes resolved stock identities and allocations, so a replaced variant,
  // missing gift or changed bundle cannot silently reuse an old confirmation.
  const quote: CartQuote = { ...value, version: hash({ ...value, items: resolved.items, discountCode: discountCode?.trim().toUpperCase() ?? "" }) };
  return { quote, resolved, settings };
}
export async function quoteCart(lines: ClientCartLine[], discountCode?: string, shippingMethod?: ShippingMethod): Promise<CartQuote> {
  return (await resolveQuote(lines, discountCode, shippingMethod)).quote;
}

/** Recovery is only queued after an explicit capture; delivery rechecks current consent and cart state. */
export async function captureCartEmail(email: string, lines: ClientCartLine[]): Promise<string | null> {
  if (!bounded(email, 254) || !EMAIL_RE.test(email.trim()) || !validateLines(lines)) return null;
  try {
    const resolved = await resolveCart(lines);
    return await captureCart(email, resolved.lines.filter((l) => !l.isGift).map((l) => ({ name: l.name, variantLabel: l.variantLabel, quantity: l.quantity })), resolved.subtotalCents);
  } catch { return null; }
}

function success(order: CreatedOrder, warnings: string[] = []): PlaceOrderResult {
  return { ok: true, orderNumber: order.orderNumber, orderId: order.orderId, totalCents: order.totalCents,
    paymentUrl: paymentPath(order.orderId), replayed: order.replayed, warnings, purchasedLines: order.purchasedLines };
}
/** Read-only recovery works even when the committed reservation exhausted stock.
 * The random attempt key and exact original request hash form a private pair. */
export async function recoverCheckoutAttempt(idempotencyKey: string, requestFingerprint: string): Promise<PlaceOrderResult | { ok: false; notFound: true; error: string }> {
  if (!bounded(idempotencyKey, 36) || !UUID.test(idempotencyKey)
    || !bounded(requestFingerprint, 64) || !/^[a-f0-9]{64}$/.test(requestFingerprint)) {
    return { ok: false, error: "The saved order attempt is invalid. Please contact support if you already submitted an order." };
  }
  try {
    const order = await findCheckoutReplay(idempotencyKey, requestFingerprint);
    return order ? success(order) : { ok: false, notFound: true, error: "No completed order was found yet. You can retry with the same details; please keep this checkout session open." };
  } catch {
    return { ok: false, error: "We couldn't check your earlier order yet. Please try checking again before placing another order." };
  }
}

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };
  try {
    const shippingAddress = {
      line1: input.address.line1.trim(), line2: input.address.line2?.trim() || null,
      suburb: input.address.suburb.trim(), state: input.address.state.trim().toUpperCase(), postcode: input.address.postcode.trim(),
      country: "AU", phone: input.address.phone?.trim() || null,
      shipping_method: input.shippingMethod ?? "standard", delivery_instructions: input.deliveryInstructions?.trim() || null,
    };
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    const discountCode = input.discountCode?.trim().toUpperCase() || undefined;
    const requestFingerprint = hash({ email, name, shippingAddress, lines: input.lines.map(({ key, slug, variantLabel, quantity }) => ({ key, slug, variantLabel, quantity })), paymentMethod: input.paymentMethod, discountCode });
    // Test key availability before a transaction can commit without a usable receipt.
    createOrderAccessToken(input.idempotencyKey, "payment");
    const existing = await findCheckoutReplay(input.idempotencyKey, requestFingerprint);
    if (existing) return success(existing);
    const { quote, resolved, settings } = await resolveQuote(input.lines, discountCode, input.shippingMethod);
    if (input.quoteVersion !== quote.version) return { ok: false, error: "Your order details have changed. Review the updated summary and place your order again.", quote };
    if (!resolved.items.length) return { ok: false, error: "None of the items in your cart are available.", quote };
    if (quote.discountError) return { ok: false, error: quote.discountError, quote };
    if (!isPaymentMethod(input.paymentMethod) || !quote.paymentOptions.some((o) => o.method === input.paymentMethod)) {
      return { ok: false, error: "Select an available payment method.", quote };
    }
    if (input.shippingMethod && input.shippingMethod !== quote.shippingMethod) return { ok: false, error: "Select an available shipping method.", quote };
    let analyticsClientId: string | undefined;
    if (process.env.GA4_API_SECRET && /^G-[A-Z0-9]+$/.test(process.env.NEXT_PUBLIC_GA4_ID ?? "")) {
      const { cookies } = await import("next/headers");
      const cookie = (await cookies()).get("_ga")?.value;
      const match = cookie?.match(/^GA\d+\.\d+\.(\d{1,20}\.\d{1,20})$/);
      analyticsClientId = match?.[1];
    }
    const order = await createOrder({ email, name, shippingAddress, items: resolved.items, extraItems: resolved.extraItems,
      discountCode, shippingCents: quote.shippingCents, paymentMethod: input.paymentMethod, actor: email,
      idempotencyKey: input.idempotencyKey, requestFingerprint, analyticsClientId, purchasedLines: resolved.lines, paymentExpiryHours: settings.paymentExpiryHours, expectedTotalCents: quote.totalCents });
    // Email intent is inserted by the commerce transaction. Provider delivery
    // belongs to the outbox worker and cannot turn a committed order into a failure.
    await markCartRecovered(email, order.orderId, input.recoveryEpisodeId).catch(() => console.error("Checkout recovery attribution awaits investigation"));
    try { after(async () => {
      const { dispatchOrderEmails } = await import("@/lib/email/sender");
      await dispatchOrderEmails(order.orderId).catch(() => console.error("Order email awaits outbox retry"));
    }); } catch { /* Durable intent remains available to the cron worker. */ }
    return success(order, resolved.warnings);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("CHECKOUT_RATE_LIMIT")) return { ok: false, error: "You have several recent payment requests. Please use your existing payment email or contact support before placing another order." };
    if (msg.includes("OUT_OF_STOCK:")) return { ok: false, error: "One of your items just sold out. Please adjust your cart and try again.", outOfStockSku: msg.split("OUT_OF_STOCK:")[1]?.split(/\s/)[0] };
    if (msg.includes("QUOTE_CHANGED")) {
      const updated = await resolveQuote(input.lines, input.discountCode, input.shippingMethod).catch(() => null);
      return { ok: false, error: "A price changed while you were checking out. Review the updated order summary and try again.", quote: updated?.quote };
    }
    console.error("Checkout transaction could not be confirmed; inspect the private operation log");
    return { ok: false, error: "We couldn't confirm your order. Please retry with the same details; a completed attempt will be recovered safely." };
  }
}
