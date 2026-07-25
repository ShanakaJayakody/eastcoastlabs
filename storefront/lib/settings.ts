import "server-only";

/**
 * Store settings. Server-only (service-role read) with hardcoded defaults, so
 * every surface still renders if the table is empty or Supabase is unreachable.
 */
import { supabaseAdmin } from "./supabase";

export interface StoreSettings {
  announcementItems: string[];
  freeShippingThreshold: number;
  giftThreshold: number;
  supportEmail: string;
}

export const DEFAULT_SETTINGS: StoreSettings = {
  announcementItems: [
    "🛡️ 98%+ purity guaranteed — or refund/replace",
    "🚚 Free shipping over $150",
    "⚡ 1-business-day dispatch from AU",
    "🤐 Discreet packaging & billing",
  ],
  freeShippingThreshold: 150,
  giftThreshold: 250,
  supportEmail: "support@eastcoastlabs.com.au",
};

const KEYS = {
  announcementItems: "announcement_items",
  freeShippingThreshold: "free_shipping_threshold",
  giftThreshold: "gift_threshold",
  supportEmail: "support_email",
} as const;

export async function getSettings(): Promise<StoreSettings> {
  const db = supabaseAdmin();
  if (!db) return DEFAULT_SETTINGS;

  const { data, error } = await db.from("settings").select("key, value");
  if (error || !data) return DEFAULT_SETTINGS;

  const map = new Map(data.map((r) => [r.key as string, r.value]));
  const num = (k: string, fallback: number) => {
    const v = map.get(k);
    return typeof v === "number" && Number.isFinite(v) ? v : fallback;
  };
  const str = (k: string, fallback: string) => {
    const v = map.get(k);
    return typeof v === "string" && v.trim() ? v : fallback;
  };
  const arr = (k: string, fallback: string[]) => {
    const v = map.get(k);
    return Array.isArray(v) && v.every((x) => typeof x === "string") && v.length ? (v as string[]) : fallback;
  };

  return {
    announcementItems: arr(KEYS.announcementItems, DEFAULT_SETTINGS.announcementItems),
    freeShippingThreshold: num(KEYS.freeShippingThreshold, DEFAULT_SETTINGS.freeShippingThreshold),
    giftThreshold: num(KEYS.giftThreshold, DEFAULT_SETTINGS.giftThreshold),
    supportEmail: str(KEYS.supportEmail, DEFAULT_SETTINGS.supportEmail),
  };
}

/** Write one setting. Callers must already have passed requireAdmin(). */
export async function putSetting(key: string, value: unknown, actor: string): Promise<void> {
  const db = supabaseAdmin();
  if (!db) throw new Error("Supabase not configured.");
  const { error } = await db
    .from("settings")
    .upsert({ key, value, updated_at: new Date().toISOString(), updated_by: actor }, { onConflict: "key" });
  if (error) throw new Error(`putSetting(${key}): ${error.message}`);
}

export const SETTING_KEYS = KEYS;
