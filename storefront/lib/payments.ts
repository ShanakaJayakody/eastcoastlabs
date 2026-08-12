import "server-only";

/**
 * Payment methods, references, and instructions.
 *
 * ECL cannot use mainstream card processors (research-peptide category), so
 * payment is customer-initiated: PayID or direct bank transfer. The order is
 * created first — you need a reference and an exact amount to exist before you
 * can ask someone to transfer — then the details are shown on the confirmation
 * page and repeated in an email.
 *
 * Two ideas carry the whole design:
 *
 *   1. A method whose details are blank is NOT offered. Better to show one
 *      working method than two, one of which has an empty BSB.
 *   2. The reference is the match key. An incoming transfer is matched on the
 *      reference plus the exact cent amount, so the reference must be unique,
 *      short enough to retype without error, and unambiguous in a bank
 *      statement's narrow description field.
 *
 * SERVER ONLY — reads settings via the service-role client.
 */

import { getSettings, type StoreSettings } from "./settings";

export type PaymentMethod = "payid" | "bank_transfer";

export const PAYMENT_METHODS: PaymentMethod[] = ["payid", "bank_transfer"];

export function isPaymentMethod(v: unknown): v is PaymentMethod {
  return v === "payid" || v === "bank_transfer";
}

/** One payment option as the checkout renders it. */
export interface PaymentOption {
  method: PaymentMethod;
  label: string;
  /** Short line under the label — what the customer is agreeing to. */
  blurb: string;
  badges: string[];
}

/** The details a customer needs in order to actually pay. */
export interface PaymentInstructions {
  method: PaymentMethod;
  /** Ordered, copy-button-per-row fields. Azupay gates merchant production
   *  access on payment fields being copyable, and it removes the single
   *  biggest source of failed matches: mistyped digits. */
  fields: { label: string; value: string; mono?: boolean; copyable?: boolean }[];
  reference: string;
  amountCents: number;
  /** Hours we hold the order before it auto-cancels. */
  expiryHours: number;
  windowHours: number;
  notes: string[];
}

/** Methods that are switched on AND fully configured. */
export function availablePaymentOptions(s: StoreSettings): PaymentOption[] {
  const out: PaymentOption[] = [];
  if (s.payidEnabled && s.payidIdentifier) {
    out.push({
      method: "payid",
      label: "PayID",
      blurb: `Send your PayID payment to ${s.payidName ? `${s.payidName} — ` : ""}no BSB or account number needed.`,
      badges: ["Instant", "Fee free"],
    });
  }
  if (s.bankTransferEnabled && s.bankBsb && s.bankAccountNumber) {
    out.push({
      method: "bank_transfer",
      label: "Bank Transfer",
      blurb:
        "Transfer the exact amount to our BSB and account number using your order reference as the payment description.",
      badges: ["Fee free"],
    });
  }
  return out;
}

export async function getPaymentOptions(): Promise<PaymentOption[]> {
  return availablePaymentOptions(await getSettings());
}

/**
 * Build the payment reference for an order.
 *
 * The order number (ECL-1042) already has every property a reference needs:
 * unique, short, and recognisable to both the customer and whoever reconciles
 * the bank feed. Using it directly means one identifier travels through the
 * whole flow instead of two that can disagree.
 */
export function referenceForOrderNumber(orderNumber: string): string {
  return orderNumber.toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-AU", { style: "currency", currency: "AUD" });

/**
 * Render the instructions for one order. Returns null when the method is no
 * longer configured (e.g. details were cleared after the order was placed) —
 * callers fall back to "contact support" rather than printing empty fields.
 */
export function buildInstructions(
  method: PaymentMethod,
  opts: { reference: string; amountCents: number; settings: StoreSettings },
): PaymentInstructions | null {
  const { reference, amountCents, settings: s } = opts;

  const shared = {
    reference,
    amountCents,
    expiryHours: s.paymentExpiryHours,
    windowHours: s.paymentWindowHours,
  };

  // Both methods share the same two failure modes, so both get the same
  // warnings: a wrong amount or a missing reference means a human has to
  // reconcile it by hand.
  const notes = [
    `Send the exact amount — ${money(amountCents)}, including cents. The amount is part of how we match your payment.`,
    `Put ${reference} in the payment description or reference field. Some banks label this "Description" and others "Reference" — if you see both, use both.`,
    `We hold your order for ${s.paymentWindowHours} hours. If we haven't received payment after ${s.paymentExpiryHours} hours it's released automatically so the stock goes back on sale.`,
  ];

  if (method === "payid") {
    if (!s.payidIdentifier) return null;
    return {
      ...shared,
      method,
      fields: [
        { label: "PayID", value: s.payidIdentifier, mono: true, copyable: true },
        ...(s.payidName ? [{ label: "Name shown in your bank", value: s.payidName }] : []),
        { label: "Amount", value: money(amountCents), mono: true, copyable: true },
        { label: "Reference", value: reference, mono: true, copyable: true },
      ],
      notes: [
        ...notes,
        "Your banking app will show our registered business name before you confirm — that's your check that the PayID is right.",
        "First time paying anyone by PayID? Some banks hold a first transfer to a new payee for up to 24 hours. That's your bank, not us — the order stays reserved.",
      ],
    };
  }

  if (!s.bankBsb || !s.bankAccountNumber) return null;
  return {
    ...shared,
    method,
    fields: [
      ...(s.bankAccountName ? [{ label: "Account name", value: s.bankAccountName }] : []),
      { label: "BSB", value: s.bankBsb, mono: true, copyable: true },
      { label: "Account number", value: s.bankAccountNumber, mono: true, copyable: true },
      { label: "Amount", value: money(amountCents), mono: true, copyable: true },
      { label: "Reference", value: reference, mono: true, copyable: true },
    ],
    notes: [
      ...notes,
      "Standard bank transfers between Australian banks usually clear the same business day, and often within minutes on Osko.",
      "If your bank's name-check says the account name doesn't match, don't worry — just make sure the BSB and account number are entered correctly and the transfer will still go through the same.",
    ],
  };
}

/** Convenience: load settings and build instructions in one call. */
export async function instructionsForOrder(opts: {
  method: PaymentMethod;
  reference: string;
  amountCents: number;
}): Promise<PaymentInstructions | null> {
  const settings = await getSettings();
  return buildInstructions(opts.method, { ...opts, settings });
}

export const paymentMethodLabel = (m: string): string =>
  m === "payid" ? "PayID" : m === "bank_transfer" ? "Bank transfer" : m;
