import "server-only";

/**
 * Store settings. Server-only (service-role read) with hardcoded defaults, so
 * every surface still renders if the table is empty or Supabase is unreachable.
 */
import { cache } from "react";
import { supabaseAdmin } from "./supabase";

export interface StoreSettings {
  /** Optimistic revision from the atomic database snapshot. */
  version?: number;
  announcementItems: string[];
  freeShippingThreshold: number;
  giftThreshold: number;
  supportEmail: string;
  /** Verified public business facts. Blank means not supplied, never invented. */
  legalName?: string;
  abn?: string;
  publicAddress?: string;
  supportHours?: string;
  dispatchNotes?: string;
  returnsNotes?: string;
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
    "Research use only — check available batch documentation",
    "Free standard $100+ · express $150+",
    "Order preparation after payment confirmation",
    "Bank transfer details provided after checkout",
  ],
  freeShippingThreshold: 100,
  giftThreshold: 250,
  supportEmail: "eclpeptides@gmail.com",
  legalName: "",
  abn: "",
  publicAddress: "",
  supportHours: "Mon–Fri, 9am–5pm AEST",
  dispatchNotes: "",
  returnsNotes: "",
  payidEnabled: true,
  payidIdentifier: "",
  payidName: "",
  bankTransferEnabled: true,
  bankBsb: "",
  bankAccountNumber: "",
  bankAccountName: "",
  paymentWindowHours: 24,
  paymentExpiryHours: 48,
  standardShippingCents: 1000,
  expressShippingEnabled: true,
  expressShippingCents: 1500,
  expressFreeThreshold: 150,
};

const KEYS = {
  announcementItems: "announcement_items",
  freeShippingThreshold: "free_shipping_threshold",
  giftThreshold: "gift_threshold",
  supportEmail: "support_email",
  legalName: "legal_name",
  abn: "abn",
  publicAddress: "public_address",
  supportHours: "support_hours",
  dispatchNotes: "dispatch_notes",
  returnsNotes: "returns_notes",
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

export const getSettings = cache(async function getSettings(): Promise<StoreSettings> {
  const db = supabaseAdmin();
  if (!db) return DEFAULT_SETTINGS;

  const { data, error } = await db.rpc("admin_settings_snapshot");
  if (error || !data) return DEFAULT_SETTINGS;

  const snapshot = data as { version: number; values: Record<string, unknown> };
  const map = new Map(Object.entries(snapshot.values));
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
    version: snapshot.version,
    announcementItems: arr(KEYS.announcementItems, DEFAULT_SETTINGS.announcementItems),
    freeShippingThreshold: num(KEYS.freeShippingThreshold, DEFAULT_SETTINGS.freeShippingThreshold),
    giftThreshold: num(KEYS.giftThreshold, DEFAULT_SETTINGS.giftThreshold),
    supportEmail: str(KEYS.supportEmail, DEFAULT_SETTINGS.supportEmail),
    legalName: optStr(KEYS.legalName, ""),
    abn: optStr(KEYS.abn, ""),
    publicAddress: optStr(KEYS.publicAddress, ""),
    supportHours: optStr(KEYS.supportHours, DEFAULT_SETTINGS.supportHours ?? ""),
    dispatchNotes: optStr(KEYS.dispatchNotes, ""),
    returnsNotes: optStr(KEYS.returnsNotes, ""),
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
});

export const SETTING_KEYS = KEYS;

/** Commit all settings and the audit record in one transaction. */
export async function putSettings(values: Record<string, unknown>, version: number | undefined, actor: string): Promise<number> {
 const db = supabaseAdmin();
 if (!db) throw new Error("Supabase not configured.");
 const {data,error} = await db.rpc("admin_save_settings", {p_values:values,p_version:version ?? null,p_actor:actor});
 if (error) throw new Error(error.message);
 return Number(data);
}
