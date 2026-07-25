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

  try {
    await putSetting(SETTING_KEYS.announcementItems, items, session.email);
    await putSetting(SETTING_KEYS.freeShippingThreshold, input.freeShippingThreshold, session.email);
    await putSetting(SETTING_KEYS.giftThreshold, input.giftThreshold, session.email);
    await putSetting(SETTING_KEYS.supportEmail, input.supportEmail.trim(), session.email);

    await logAudit({
      actor: session.email,
      action: "settings.update",
      entityType: "settings",
      diff: { ...input, announcementItems: items },
    });

    // Every storefront surface that renders these values.
    revalidatePath("/", "layout");
    revalidatePath("/admin/settings");
    return { ok: true, message: "Settings saved — storefront updated" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
