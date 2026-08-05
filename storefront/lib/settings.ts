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
  /** Payment — PayID. Blank identifier means "not configured": the method is
   *  hidden at checkout rather than shown with empty details. */
  payidEnabled: boolean;
  payidIdentifier: string;
  payidName: string;
  /** Payment — direct bank transfer. Same blank-means-hidden rule. */
  bankTransferEnabled: boolean;
  bankBsb: string;
  bankAccountNumber: string;
  bankAccountName: string;
  /** Hours we promise to hold the order (messaging + reminder cadence). */
  paymentWindowHours: number;
  /** Hours after which an unpaid order auto-cancels and releases its stock. */
  paymentExpiryHours: number;
  /** Shipping. Standard is the default method; express is opt-in at checkout. */
  standardShippingCents: number;
  expressShippingEnabled: boolean;
  expressShippingCents: number;
  expressFreeThreshold: number;
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
  payidEnabled: true,
  payidIdentifier: "",
  payidName: "",
  bankTransferEnabled: true,
  bankBsb: "",
  bankAccountNumber: "",
  bankAccountName: "",
  paymentWindowHours: 24,
  paymentExpiryHours: 48,
  standardShippingCents: 1200,
  expressShippingEnabled: true,
  expressShippingCents: 1899,
  expressFreeThreshold: 400,
};

const KEYS = {
  announcementItems: "announcement_items",
  freeShippingThreshold: "free_shipping_threshold",
  giftThreshold: "gift_threshold",
  supportEmail: "support_email",
  payidEnabled: "payid_enabled",
  payidIdentifier: "payid_identifier",
  payidName: "payid_name",
  bankTransferEnabled: "bank_transfer_enabled",
  bankBsb: "bank_bsb",
  bankAccountNumber: "bank_account_number",
  bankAccountName: "bank_account_name",
  paymentWindowHours: "payment_window_hours",
  paymentExpiryHours: "payment_expiry_hours",
  standardShippingCents: "standard_shipping_cents",
  expressShippingEnabled: "express_shipping_enabled",
  expressShippingCents: "express_shipping_cents",
  expressFreeThreshold: "express_free_threshold",
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
  // Blank strings are meaningful for payment details ("not configured yet"), so
  // unlike `str` this accessor preserves "" instead of falling back.
  const optStr = (k: string, fallback: string) => {
    const v = map.get(k);
    return typeof v === "string" ? v.trim() : fallback;
  };
  const bool = (k: string, fallback: boolean) => {
    const v = map.get(k);
    return typeof v === "boolean" ? v : fallback;
  };

  return {
    announcementItems: arr(KEYS.announcementItems, DEFAULT_SETTINGS.announcementItems),
    freeShippingThreshold: num(KEYS.freeShippingThreshold, DEFAULT_SETTINGS.freeShippingThreshold),
    giftThreshold: num(KEYS.giftThreshold, DEFAULT_SETTINGS.giftThreshold),
    supportEmail: str(KEYS.supportEmail, DEFAULT_SETTINGS.supportEmail),
    payidEnabled: bool(KEYS.payidEnabled, DEFAULT_SETTINGS.payidEnabled),
    payidIdentifier: optStr(KEYS.payidIdentifier, DEFAULT_SETTINGS.payidIdentifier),
    payidName: optStr(KEYS.payidName, DEFAULT_SETTINGS.payidName),
    bankTransferEnabled: bool(KEYS.bankTransferEnabled, DEFAULT_SETTINGS.bankTransferEnabled),
    bankBsb: optStr(KEYS.bankBsb, DEFAULT_SETTINGS.bankBsb),
    bankAccountNumber: optStr(KEYS.bankAccountNumber, DEFAULT_SETTINGS.bankAccountNumber),
    bankAccountName: optStr(KEYS.bankAccountName, DEFAULT_SETTINGS.bankAccountName),
    paymentWindowHours: num(KEYS.paymentWindowHours, DEFAULT_SETTINGS.paymentWindowHours),
    paymentExpiryHours: num(KEYS.paymentExpiryHours, DEFAULT_SETTINGS.paymentExpiryHours),
    standardShippingCents: num(KEYS.standardShippingCents, DEFAULT_SETTINGS.standardShippingCents),
    expressShippingEnabled: bool(KEYS.expressShippingEnabled, DEFAULT_SETTINGS.expressShippingEnabled),
    expressShippingCents: num(KEYS.expressShippingCents, DEFAULT_SETTINGS.expressShippingCents),
    expressFreeThreshold: num(KEYS.expressFreeThreshold, DEFAULT_SETTINGS.expressFreeThreshold),
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
