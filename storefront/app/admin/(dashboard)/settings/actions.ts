"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { putSetting, SETTING_KEYS } from "@/lib/settings";
import { logAudit } from "@/lib/admin/audit";

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

export interface SettingsInput {
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

  const items = input.announcementItems.map((s) => s.trim()).filter(Boolean);
  if (!items.length) return { ok: false, error: "Add at least one announcement item." };
  if (!Number.isFinite(input.freeShippingThreshold) || input.freeShippingThreshold < 0)
    return { ok: false, error: "Free-shipping threshold must be a positive number." };
  if (!Number.isFinite(input.giftThreshold) || input.giftThreshold < 0)
    return { ok: false, error: "Gift threshold must be a positive number." };
  if (!input.supportEmail.includes("@")) return { ok: false, error: "Enter a valid support email." };

  // A method can only be switched on if it has the details a customer needs to
  // actually pay — enabling PayID with a blank identifier would render an empty
  // field on the confirmation page.
  const payid = input.payidIdentifier.trim();
  const bsb = input.bankBsb.trim();
  const acct = input.bankAccountNumber.trim();
  if (input.payidEnabled && !payid)
    return { ok: false, error: "Add a PayID (email, phone, or ABN) before enabling PayID." };
  if (input.bankTransferEnabled && (!bsb || !acct))
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
    await putSetting(SETTING_KEYS.announcementItems, items, session.email);
    await putSetting(SETTING_KEYS.freeShippingThreshold, input.freeShippingThreshold, session.email);
    await putSetting(SETTING_KEYS.giftThreshold, input.giftThreshold, session.email);
    await putSetting(SETTING_KEYS.supportEmail, input.supportEmail.trim(), session.email);

    await putSetting(SETTING_KEYS.payidEnabled, input.payidEnabled, session.email);
    await putSetting(SETTING_KEYS.payidIdentifier, payid, session.email);
    await putSetting(SETTING_KEYS.payidName, input.payidName.trim(), session.email);
    await putSetting(SETTING_KEYS.bankTransferEnabled, input.bankTransferEnabled, session.email);
    await putSetting(SETTING_KEYS.bankBsb, bsb, session.email);
    await putSetting(SETTING_KEYS.bankAccountNumber, acct, session.email);
    await putSetting(SETTING_KEYS.bankAccountName, input.bankAccountName.trim(), session.email);
    await putSetting(SETTING_KEYS.paymentWindowHours, input.paymentWindowHours, session.email);
    await putSetting(SETTING_KEYS.paymentExpiryHours, input.paymentExpiryHours, session.email);

    await putSetting(SETTING_KEYS.standardShippingCents, input.standardShippingCents, session.email);
    await putSetting(SETTING_KEYS.expressShippingEnabled, input.expressShippingEnabled, session.email);
    await putSetting(SETTING_KEYS.expressShippingCents, input.expressShippingCents, session.email);
    await putSetting(SETTING_KEYS.expressFreeThreshold, input.expressFreeThreshold, session.email);

    await logAudit({
      actor: session.email,
      action: "settings.update",
      entityType: "settings",
      // Account details are credentials-adjacent: log that they changed, not
      // what they changed to.
      diff: {
        ...input,
        announcementItems: items,
        payidIdentifier: payid ? "[set]" : "[cleared]",
        bankBsb: bsb ? "[set]" : "[cleared]",
        bankAccountNumber: acct ? "[set]" : "[cleared]",
      },
    });

    // Every storefront surface that renders these values.
    revalidatePath("/", "layout");
    revalidatePath("/admin/settings");
    return { ok: true, message: "Settings saved — storefront updated" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
