/**
 * Exercises the two new write paths on throwaway orders:
 *   warnExpiringOrders    — queues exactly one final warning per deadline
 *   completeDeliveredOrders — closes shipped orders past the age cutoff
 *
 * RESEND_API_KEY is cleared before the sweep runs, so the outbox row is created
 * and the dedupe key is exercised while no mail actually leaves. That is the
 * part worth testing; Resend's own delivery is proven elsewhere.
 *
 * WARNING: completeDeliveredOrders() is NOT scoped to the probe's own orders —
 * it sweeps the whole table, so running this closes every real shipped order
 * past the cutoff. That is the sweep's job and it is what the nightly cron does
 * anyway, but run this knowingly rather than as a dry run.
 *
 * Usage (from storefront/):
 *   bun --preload ./scripts/_stub-server-only.js scripts/verify-expiry-and-complete.ts
 */
delete process.env.RESEND_API_KEY;

import { adminDb } from "@/lib/admin/db";
import { createOrder, completeDeliveredOrders, AUTO_COMPLETE_DAYS } from "@/lib/admin/orders";
import { warnExpiringOrders } from "@/lib/admin/payment-ops";

const db = adminDb();
const TEST_EMAIL = "sweep-probe@example.invalid";
const cleanupIds: string[] = [];

const { data: cand } = await db
  .from("inventory")
  .select("variant_id, on_hand, reserved, product_variants(pack_size)")
  .gt("on_hand", 3)
  .limit(20);
const pick = ((cand ?? []) as unknown as {
  variant_id: string;
  on_hand: number;
  reserved: number;
  product_variants: { pack_size: number } | null;
}[]).find((c) => c.product_variants?.pack_size === 1 && c.on_hand - c.reserved >= 2);
if (!pick) throw new Error("no spare single-vial stock to probe with");

const makeOrder = async (name: string) => {
  const o = await createOrder({
    email: TEST_EMAIL,
    name,
    items: [{ variantId: pick.variant_id, qty: 1 }],
    shippingAddress: { line1: "1 Test St", city: "Sydney", state: "NSW", postcode: "2000" },
  });
  cleanupIds.push(o.orderId);
  return o;
};

/* ---- 1. pre-expiry warning ---------------------------------------------- */
console.log("1. Pre-expiry warning");

const soon = await makeOrder("Expiring Soon");
const far = await makeOrder("Expiring Later");

// One deadline inside the 4h warning window, one well outside it.
const soonExpiry = new Date(Date.now() + 2 * 3600_000).toISOString();
await db.from("orders").update({ payment_expires_at: soonExpiry }).eq("id", soon.orderId);
await db
  .from("orders")
  .update({ payment_expires_at: new Date(Date.now() + 30 * 3600_000).toISOString() })
  .eq("id", far.orderId);

const first = await warnExpiringOrders();
console.log(`   sweep warned: ${first.warned}`);

const warnedFor = async (orderId: string) => {
  const { data } = await db
    .from("email_outbox")
    .select("id, related_id, status")
    .eq("template", "payment_expiring")
    .like("related_id", `${orderId}%`);
  return (data ?? []) as { id: string; related_id: string; status: string }[];
};

const soonRows = await warnedFor(soon.orderId);
const farRows = await warnedFor(far.orderId);
console.log(`   order expiring in 2h  -> ${soonRows.length} warning(s)  ${soonRows[0]?.related_id ?? ""}`);
console.log(`   order expiring in 30h -> ${farRows.length} warning(s)  (should be 0)`);
if (soonRows.length !== 1) throw new Error("FAIL: order inside the window was not warned exactly once");
if (farRows.length !== 0) throw new Error("FAIL: order outside the window was warned");

console.log("   re-running the sweep (cron overlap)…");
await warnExpiringOrders();
if ((await warnedFor(soon.orderId)).length !== 1)
  throw new Error("FAIL: second sweep duplicated the warning");
console.log("   still 1 warning ✓ (dedupe key held)");

// An operator extending the hold is a NEW deadline and earns a fresh warning.
await db
  .from("orders")
  .update({ payment_expires_at: new Date(Date.now() + 3 * 3600_000).toISOString() })
  .eq("id", soon.orderId);
await warnExpiringOrders();
const afterExtend = await warnedFor(soon.orderId);
console.log(`   after extending the hold -> ${afterExtend.length} warning(s) (a new deadline earns a new warning)`);
if (afterExtend.length !== 2) throw new Error("FAIL: extended deadline did not earn a fresh warning");

// Nothing was actually sent, because the API key was cleared.
// Sending is disabled above, so these land as `failed` with "RESEND_API_KEY not
// configured" — the row exists, the dedupe key was exercised, no mail left.
console.log(`   outbox status: ${afterExtend.map((r) => r.status).join(", ")} (not sent — key cleared)`);

/* ---- 2. auto-complete ---------------------------------------------------- */
console.log(`\n2. Auto-complete after ${AUTO_COMPLETE_DAYS} days`);

const old = await makeOrder("Shipped Long Ago");
const recent = await makeOrder("Shipped Yesterday");

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
await db
  .from("orders")
  .update({ status: "shipped", shipped_at: daysAgo(AUTO_COMPLETE_DAYS + 2) })
  .eq("id", old.orderId);
await db.from("orders").update({ status: "shipped", shipped_at: daysAgo(1) }).eq("id", recent.orderId);

const res = await completeDeliveredOrders();
console.log(`   sweep completed ${res.completed} order(s), ${res.failed} failed`);

const statusOf = async (id: string) => {
  const { data } = await db.from("orders").select("status").eq("id", id).maybeSingle();
  return (data as { status: string }).status;
};
const oldStatus = await statusOf(old.orderId);
const recentStatus = await statusOf(recent.orderId);
console.log(`   shipped ${AUTO_COMPLETE_DAYS + 2}d ago -> ${oldStatus} (want completed)`);
console.log(`   shipped 1d ago          -> ${recentStatus} (want shipped)`);
if (oldStatus !== "completed") throw new Error("FAIL: old shipped order was not completed");
if (recentStatus !== "shipped") throw new Error("FAIL: recent order was completed too early");

// The transition must leave a trail, not happen invisibly.
const { data: ev } = await db
  .from("order_events")
  .select("type, from_status, to_status, actor_email")
  .eq("order_id", old.orderId)
  .eq("to_status", "completed");
console.log(`   audit event: ${JSON.stringify(ev?.[0] ?? null)}`);
if (!ev?.length) throw new Error("FAIL: auto-complete left no order event");

console.log("   re-running the sweep…");
const again = await completeDeliveredOrders();
console.log(`   second run completed ${again.completed} (0 = already closed, nothing to redo)`);

/* ---- cleanup ------------------------------------------------------------- */
console.log("\n3. cleanup");
await db.from("stock_movements").delete().in("order_id", cleanupIds);
await db.from("order_events").delete().in("order_id", cleanupIds);
await db.from("order_items").delete().in("order_id", cleanupIds);
await db.from("orders").delete().in("id", cleanupIds);
await db.from("email_outbox").delete().eq("to_email", TEST_EMAIL);
await db.from("admin_audit_log").delete().in("entity_id", cleanupIds);
const { data: leftovers } = await db.from("orders").select("id").eq("customer_email", TEST_EMAIL);
console.log(`   probe orders remaining: ${(leftovers ?? []).length}`);

console.log("\n✓ ALL CHECKS PASSED");
