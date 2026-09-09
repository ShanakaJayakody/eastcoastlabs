"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { putSettings, SETTING_KEYS } from "@/lib/settings";

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
  version?: number;
}

export interface SettingsInput {
  version?: number;
  announcementItems: string[];
  freeShippingThreshold: number;
  giftThreshold: number;
  supportEmail: string;
  // Payment
  payidEnabled: boolean;
  payidIdentifier: string;
  payidName: string;
  bankTransferEnabled: boolean;
  bankBsb: string;
  bankAccountNumber: string;
  bankAccountName: string;
  paymentWindowHours: number;
  paymentExpiryHours: number;
  // Shipping
  standardShippingCents: number;
  expressShippingEnabled: boolean;
  expressShippingCents: number;
  expressFreeThreshold: number;
}

export async function saveSettings(input: SettingsInput): Promise<ActionResult> {
  const session = await requireAdmin();

  const bounded = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1_000_000;
  if (![input.standardShippingCents, input.expressShippingCents].every(n => bounded(n) && Number.isInteger(n)))
    return {ok:false,error:"Shipping prices must be whole cents between 0 and 1,000,000."};
  if (!bounded(input.expressFreeThreshold)) return {ok:false,error:"Express free-shipping threshold is invalid."};
  if (!Number.isInteger(input.paymentWindowHours) || input.paymentWindowHours < 1 || input.paymentWindowHours > 720)
    return {ok:false,error:"Payment hold window must be 1–720 whole hours."};
  if (!Number.isInteger(input.paymentExpiryHours) || input.paymentExpiryHours < 1 || input.paymentExpiryHours > 720)
    return {ok:false,error:"Payment expiry must be 1–720 whole hours."};
  if (!Array.isArray(input.announcementItems) || input.announcementItems.some(s => typeof s !== "string" || s.length > 500) || input.announcementItems.length > 20)
    return {ok:false,error:"Add up to 20 announcement items of 500 characters each."};
  const items = input.announcementItems.map((s) => s.trim()).filter(Boolean);
  if (!items.length) return { ok: false, error: "Add at least one announcement item." };
  if (!bounded(input.freeShippingThreshold))
    return { ok: false, error: "Free-shipping threshold must be a positive number." };
  if (!bounded(input.giftThreshold))
    return { ok: false, error: "Gift threshold must be a positive number." };
  if (!/^\S+@\S+\.\S+$/.test(input.supportEmail.trim())) return { ok: false, error: "Enter a valid support email." };

  // A method can only be switched on if it has the details a customer needs to
  // actually pay — enabling PayID with a blank identifier would render an empty
  // field on the confirmation page.
  const payid = input.payidIdentifier.trim();
  const bsb = input.bankBsb.trim();
  const acct = input.bankAccountNumber.trim();
  if (input.payidEnabled && (!payid || !input.payidName.trim()))
    return { ok: false, error: "Add a PayID (email, phone, or ABN) before enabling PayID." };
  if (input.bankTransferEnabled && (!bsb || !acct || !input.bankAccountName.trim()))
    return { ok: false, error: "Add both a BSB and an account number before enabling bank transfer." };
  if (!input.payidEnabled && !input.bankTransferEnabled)
    return { ok: false, error: "At least one payment method must stay enabled." };
  if (bsb && !/^\d{3}-?\d{3}$/.test(bsb))
    return { ok: false, error: "BSB must be 6 digits (e.g. 063-000)." };
  if (acct && !/^\d{5,10}$/.test(acct.replace(/\s/g, "")))
    return { ok: false, error: "Account number must be 5–10 digits." };

  if (!Number.isFinite(input.paymentExpiryHours) || input.paymentExpiryHours < 1)
    return { ok: false, error: "Payment expiry must be at least 1 hour." };
  if (input.paymentWindowHours > input.paymentExpiryHours)
    return {
      ok: false,
      error: "The hold window can't be longer than the expiry — customers would be told they have more time than they do.",
    };

  try {
    const normalised = {...input, announcementItems:items,supportEmail:input.supportEmail.trim(),payidIdentifier:payid,payidName:input.payidName.trim(),bankBsb:bsb,bankAccountNumber:acct.replace(/\s/g,""),bankAccountName:input.bankAccountName.trim()};
    const values = Object.fromEntries(Object.entries(SETTING_KEYS).map(([field,key]) => [key,normalised[field as keyof typeof SETTING_KEYS]]));
    const version = await putSettings(values,input.version,session.email);

    // Every storefront surface that renders these values.
    revalidatePath("/", "layout");
    revalidatePath("/admin/settings");
    return { ok: true, version, message: "Settings saved — storefront updated" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
