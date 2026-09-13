"use server";

import { checkoutFieldErrors, type CheckoutFieldErrors } from "@/lib/checkout-fields";
import { verifiedRecoveryEpisode } from "@/lib/recovery-consent";
import { validCheckoutLines as validateLines, normalizeCheckoutLines } from "@/lib/checkout-lines";
import { after } from "next/server";
import { createHash } from "node:crypto";
import { applyGiftThreshold, resolveCart, type ClientCartLine, type ResolvedCartLine } from "@/lib/checkout";
import { createOrder, findCheckoutReplay, type CreatedOrder } from "@/lib/admin/orders";
import { validateDiscount } from "@/lib/admin/discounts";
import { markCartRecovered } from "@/lib/admin/cart-recovery";
import { getSettings } from "@/lib/settings";
import { quoteShipping, shippingCentsFor, isShippingMethod, type ShippingMethod, type ShippingQuote } from "@/lib/shipping";
import { availablePaymentOptions, isPaymentMethod, type PaymentMethod, type PaymentOption } from "@/lib/payments";
import { paymentPath, createOrderAccessToken } from "@/lib/order-access";
import { ANALYTICS_CONSENT_COOKIE, MEASUREMENT_COOKIE, parseOrderAttribution, type OrderAttribution } from "@/lib/attribution";

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
  | { ok: false; error: string; outOfStockSku?: string; quote?: CartQuote; fieldErrors?: CheckoutFieldErrors };
export interface CartQuote {
  lines: ResolvedCartLine[]; version: string;
  subtotalCents: number; discountCents: number; shippingCents: number; shippingMethod: ShippingMethod;
  shippingOptions: ShippingQuote[]; totalCents: number; giftApplied: boolean; discountError?: string;
  warnings: string[]; paymentOptions: PaymentOption[];
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const bounded = (v: unknown, max: number, required = true): v is string =>
  typeof v === "string" && v.length <= max && (!required || v.trim().length > 0);
function validate(input: PlaceOrderInput): string | null {
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
  const [resolvedCart, settings] = await Promise.all([resolveCart(lines), getSettings()]);
  const discount = discountCode?.trim() ? await validateDiscount(discountCode, resolvedCart.subtotalCents) : null;
  const discountCents = discount?.ok ? discount.discountCents : 0;
  const afterDiscount = resolvedCart.subtotalCents - discountCents;
  const resolved = applyGiftThreshold(resolvedCart, afterDiscount, Math.round(settings.giftThreshold * 100));
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
  const fieldErrors = checkoutFieldErrors(input);
  if (Object.keys(fieldErrors).length) return {ok:false,error:"Check the highlighted details.",fieldErrors};
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
    const requestFingerprint = hash({ email, name, shippingAddress, lines: normalizeCheckoutLines(input.lines), paymentMethod: input.paymentMethod, discountCode });
    // Test key availability before a transaction can commit without a usable receipt.
    createOrderAccessToken(input.idempotencyKey, "payment");
    const existing = await findCheckoutReplay(input.idempotencyKey, requestFingerprint);
    if (existing) return success(existing);
    const { quote, resolved, settings } = await resolveQuote(input.lines, discountCode, input.shippingMethod);
    if (input.quoteVersion !== quote.version) return { ok: false, error: "Your order details have changed. Review the updated summary and place your order again.", quote };
    if (!resolved.items.length) return { ok: false, error: "None of the items in your cart are available.", quote };
    if (quote.discountError) return { ok: false, error: quote.discountError, fieldErrors:{discount:quote.discountError}, quote };
    if (!isPaymentMethod(input.paymentMethod) || !quote.paymentOptions.some((o) => o.method === input.paymentMethod)) {
      return { ok: false, error: "Select an available payment method.", fieldErrors:{payment:"Select an available payment method."}, quote };
    }
    if (input.shippingMethod && input.shippingMethod !== quote.shippingMethod) return { ok: false, error: "Select an available shipping method.", fieldErrors:{shipping:"Select an available shipping method."}, quote };
    let analyticsClientId: string | undefined, orderAttribution: OrderAttribution | undefined;
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const analyticsConsent = cookieStore.get(ANALYTICS_CONSENT_COOKIE)?.value;
    if (analyticsConsent === "granted") {
      orderAttribution = parseOrderAttribution(cookieStore.get(MEASUREMENT_COOKIE)?.value, analyticsConsent) ?? undefined;
    }
    if (analyticsConsent === "granted" && process.env.GA4_API_SECRET && /^G-[A-Z0-9]+$/.test(process.env.NEXT_PUBLIC_GA4_ID ?? "")) {
      const cookie = cookieStore.get("_ga")?.value;
      const match = cookie?.match(/^GA\d+\.\d+\.(\d{1,20}\.\d{1,20})$/);
      analyticsClientId = match?.[1];
    }
    const recoveryEpisodeId = await verifiedRecoveryEpisode(email,input.lines).catch(()=>undefined);
    const order = await createOrder({ email, name, shippingAddress, items: resolved.items, extraItems: resolved.extraItems,
      discountCode, shippingCents: quote.shippingCents, paymentMethod: input.paymentMethod, actor: email,
      idempotencyKey: input.idempotencyKey, requestFingerprint, analyticsClientId, orderAttribution, purchasedLines: resolved.lines, paymentExpiryHours: settings.paymentExpiryHours, expectedTotalCents: quote.totalCents });
    // Email intent is inserted by the commerce transaction. Provider delivery
    // belongs to the outbox worker and cannot turn a committed order into a failure.
    await markCartRecovered(email, order.orderId, recoveryEpisodeId).catch(() => console.error("Checkout recovery attribution awaits investigation"));
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
