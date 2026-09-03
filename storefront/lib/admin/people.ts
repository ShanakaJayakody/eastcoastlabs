import "server-only";
import { csvRow } from "@/lib/csv";

/**
 * The People index.
 *
 * "Customer" was always too narrow a word for this screen: the person who
 * abandoned a $260 cart an hour ago is the single most valuable identity in the
 * system, and they have no row in the `customers` view (which is an aggregate
 * over orders). So the index is a union of three identity sources — purchasers,
 * subscribers, and cart sessions — deduped by email.
 */
import { adminDb } from "./db";

export type Segment =
  | "all"
  | "vip"
  | "repeat"
  | "one_time"
  | "in_recovery"
  | "at_risk"
  | "lapsed"
  | "leads"
  | "unsubscribed";

export const SEGMENT_LABELS: Record<Segment, string> = {
  all: "Everyone",
  vip: "VIP",
  repeat: "Repeat",
  one_time: "One-time",
  in_recovery: "In recovery",
  at_risk: "At risk",
  lapsed: "Lapsed",
  leads: "Leads",
  unsubscribed: "Unsubscribed",
};

export interface PersonRow {
  email: string;
  name: string | null;
  ordersCount: number;
  ltvCents: number;
  lastOrderAt: string | null;
  /** Active cart with recovery under way. */
  cartValueCents: number | null;
  cartStage: number | null;
  cartIdleHours: number | null;
  subscribed: boolean;
  unsubscribed: boolean;
  segments: Segment[];
}

const DAY_H = 24;

/** VIP is relative, not a fixed dollar figure — a store's "big spender" changes
 *  as the store grows, and a hardcoded threshold silently stops meaning anything. */
function vipThreshold(ltvs: number[]): number {
  const paying = ltvs.filter((v) => v > 0).sort((a, b) => b - a);
  if (paying.length < 10) return Infinity;
  return paying[Math.max(0, Math.floor(paying.length * 0.1) - 1)];
}

export async function listPeople(): Promise<PersonRow[]> {
  const db = adminDb();
  const [{ data: customers }, { data: carts }, { data: subs }] = await Promise.all([
    db
      .from("customers")
      .select("email, name, orders_count, ltv_cents, last_order_at")
      .order("ltv_cents", { ascending: false })
      .limit(1000),
    db
      .from("cart_sessions")
      .select("email, subtotal_cents, reminder_stage, updated_at, status")
      .eq("status", "active"),
    db.from("subscribers").select("email, unsubscribed_at"),
  ]);

  const rows = new Map<string, PersonRow>();
  const blank = (email: string): PersonRow => ({
    email,
    name: null,
    ordersCount: 0,
    ltvCents: 0,
    lastOrderAt: null,
    cartValueCents: null,
    cartStage: null,
    cartIdleHours: null,
    subscribed: false,
    unsubscribed: false,
    segments: [],
  });

  for (const c of (customers ?? []) as {
    email: string;
    name: string | null;
    orders_count: number;
    ltv_cents: number;
    last_order_at: string | null;
  }[]) {
    rows.set(c.email, {
      ...blank(c.email),
      name: c.name,
      ordersCount: c.orders_count,
      ltvCents: c.ltv_cents,
      lastOrderAt: c.last_order_at,
    });
  }

  for (const cart of (carts ?? []) as {
    email: string;
    subtotal_cents: number;
    reminder_stage: number | null;
    updated_at: string;
  }[]) {
    const row = rows.get(cart.email) ?? blank(cart.email);
    row.cartValueCents = cart.subtotal_cents;
    row.cartStage = cart.reminder_stage ?? 0;
    row.cartIdleHours = (Date.now() - new Date(cart.updated_at).getTime()) / 3_600_000;
    rows.set(cart.email, row);
  }

  for (const s of (subs ?? []) as { email: string; unsubscribed_at: string | null }[]) {
    const row = rows.get(s.email) ?? blank(s.email);
    if (s.unsubscribed_at) row.unsubscribed = true;
    else row.subscribed = true;
    rows.set(s.email, row);
  }

  const all = [...rows.values()];
  const vipAt = vipThreshold(all.map((r) => r.ltvCents));

  for (const row of all) {
    const seg: Segment[] = [];
    const daysSinceOrder = row.lastOrderAt
      ? (Date.now() - new Date(row.lastOrderAt).getTime()) / 86_400_000
      : null;

    if (row.ordersCount === 0) seg.push("leads");
    if (row.ordersCount === 1) seg.push("one_time");
    if (row.ordersCount >= 2) seg.push("repeat");
    if (row.ltvCents > 0 && row.ltvCents >= vipAt) seg.push("vip");
    if (row.cartValueCents !== null && (row.cartIdleHours ?? 0) >= 1) seg.push("in_recovery");
    if (daysSinceOrder !== null && daysSinceOrder >= 45 && daysSinceOrder < 90) seg.push("at_risk");
    if (daysSinceOrder !== null && daysSinceOrder >= 90) seg.push("lapsed");
    if (row.unsubscribed) seg.push("unsubscribed");
    row.segments = seg;
  }

  // Cart value first when there's no purchase history — an active $260 cart
  // deserves attention above a $0 lead.
  return all.sort(
    (a, b) => b.ltvCents - a.ltvCents || (b.cartValueCents ?? 0) - (a.cartValueCents ?? 0),
  );
}

export function filterPeople(rows: PersonRow[], segment: Segment, q?: string): PersonRow[] {
  const needle = q?.trim().toLowerCase();
  return rows.filter((r) => {
    if (segment !== "all" && !r.segments.includes(segment)) return false;
    if (!needle) return true;
    return r.email.includes(needle) || (r.name ?? "").toLowerCase().includes(needle);
  });
}

export function segmentCounts(rows: PersonRow[]): Record<Segment, number> {
  const counts = Object.fromEntries(
    Object.keys(SEGMENT_LABELS).map((k) => [k, 0]),
  ) as Record<Segment, number>;
  counts.all = rows.length;
  for (const row of rows) for (const s of row.segments) counts[s] += 1;
  return counts;
}

export const hoursLabel = (h: number | null): string => {
  if (h == null) return "";
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / DAY_H)}d`;
};

/** CSV of whatever view the operator is looking at. */
export function peopleCsv(rows: PersonRow[]): string {
  const head = [
    "email",
    "name",
    "orders",
    "ltv_aud",
    "last_order_at",
    "subscribed",
    "unsubscribed",
    "segments",
  ];
  const lines = rows.map((r) =>
    csvRow([
      r.email,
      r.name ?? "",
      r.ordersCount,
      (r.ltvCents / 100).toFixed(2),
      r.lastOrderAt ?? "",
      r.subscribed,
      r.unsubscribed,
      r.segments.join(" "),
    ]),
  );
  return [csvRow(head), ...lines].join("\n");
}
