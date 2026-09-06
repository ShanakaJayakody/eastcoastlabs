/**
 * Read-only checks for the pre-expiry warning, pool-aware reinstatability, and
 * the 10-day auto-complete. Queries only — nothing here sends mail or moves an
 * order; the write paths are exercised by their own probes.
 *
 * Usage (from storefront/):
 *   bun --preload ./scripts/_stub-server-only.js scripts/verify-order-sweeps.ts
 */
import { adminDb } from "@/lib/admin/db";
import { reinstatabilityFor, AUTO_COMPLETE_DAYS } from "@/lib/admin/orders";
import { EXPIRY_WARNING_HOURS } from "@/lib/admin/payment-ops";

const db = adminDb();

/* ---- 1. pool-aware reinstatability -------------------------------------- */
console.log("1. Reinstatability across all cancelled orders");
const { data: cancelled } = await db
  .from("orders")
  .select("id, order_number")
  .eq("status", "cancelled");
const ids = ((cancelled ?? []) as { id: string; order_number: string }[]).map((o) => o.id);
const numbers = new Map(
  ((cancelled ?? []) as { id: string; order_number: string }[]).map((o) => [o.id, o.order_number]),
);

const map = await reinstatabilityFor(ids);
const recoverable = [...map.values()].filter((v) => v.recoverable).length;
console.log(`   ${map.size} cancelled · ${recoverable} recoverable · ${map.size - recoverable} stock gone`);

// The case the per-line version got wrong: several lines drawing on one pool.
console.log("\n2. Orders whose lines share a vial pool (the multi-line trap)");
const { data: shared } = await db
  .from("order_items")
  .select("order_id, variant_id, qty, product_name, variant_label")
  .in("order_id", ids);
const byOrder = new Map<string, number>();
for (const i of (shared ?? []) as { order_id: string }[]) {
  byOrder.set(i.order_id, (byOrder.get(i.order_id) ?? 0) + 1);
}
const multi = [...byOrder.entries()].filter(([, n]) => n > 1).map(([id]) => id);
for (const id of multi.slice(0, 4)) {
  const r = map.get(id);
  if (!r) continue;
  const detail = r.lines
    .map((l) => `${l.variantLabel ?? "?"} needs ${l.qty} (${l.available} free ${l.sufficient ? "OK" : "SHORT"})`)
    .join(" | ");
  console.log(`   ${numbers.get(id)}: ${r.recoverable ? "recoverable" : "stock gone"} — ${detail}`);
}
console.log(
  "   note: 'free' counts down across lines of the same pool, so the second line sees what the first left.",
);

/* ---- 2. who the expiry warning would reach ------------------------------ */
console.log(`\n3. Pre-expiry warning window (${EXPIRY_WARNING_HOURS}h before expiry)`);
const now = Date.now();
const horizon = new Date(now + EXPIRY_WARNING_HOURS * 3600_000).toISOString();
const { data: expiring } = await db
  .from("orders")
  .select("order_number, payment_expires_at")
  .eq("status", "pending")
  .not("payment_expires_at", "is", null)
  .gt("payment_expires_at", new Date(now).toISOString())
  .lte("payment_expires_at", horizon);
console.log(`   would warn right now: ${(expiring ?? []).length}`);
for (const o of (expiring ?? []) as { order_number: string; payment_expires_at: string }[]) {
  const h = ((new Date(o.payment_expires_at).getTime() - now) / 3600_000).toFixed(1);
  console.log(`     ${o.order_number} — expires in ${h}h`);
}

const { data: allPending } = await db
  .from("orders")
  .select("order_number, payment_expires_at")
  .eq("status", "pending")
  .not("payment_expires_at", "is", null);
const future = ((allPending ?? []) as { payment_expires_at: string }[]).filter(
  (o) => new Date(o.payment_expires_at).getTime() > now,
);
console.log(`   pending orders with a live deadline: ${future.length} (each will be warned once)`);

// Nothing should ever get two warnings for the same deadline.
const { data: sentWarnings } = await db
  .from("email_outbox")
  .select("related_id")
  .eq("template", "payment_expiring");
const relIds = ((sentWarnings ?? []) as { related_id: string }[]).map((r) => r.related_id);
console.log(
  `   warnings already queued: ${relIds.length} · distinct keys: ${new Set(relIds).size} (equal = no duplicates)`,
);

/* ---- 3. auto-complete ---------------------------------------------------- */
console.log(`\n4. Auto-complete (shipped older than ${AUTO_COMPLETE_DAYS} days)`);
const cutoff = new Date(now - AUTO_COMPLETE_DAYS * 86_400_000).toISOString();
const { data: due } = await db
  .from("orders")
  .select("order_number, shipped_at")
  .eq("status", "shipped")
  .not("shipped_at", "is", null)
  .lt("shipped_at", cutoff);
const { data: stillShipped } = await db
  .from("orders")
  .select("order_number")
  .eq("status", "shipped");
console.log(
  `   shipped orders: ${(stillShipped ?? []).length} · would auto-complete on the next daily run: ${(due ?? []).length}`,
);
for (const o of ((due ?? []) as { order_number: string; shipped_at: string }[]).slice(0, 5)) {
  const days = ((now - new Date(o.shipped_at).getTime()) / 86_400_000).toFixed(1);
  console.log(`     ${o.order_number} — shipped ${days} days ago`);
}

// Refunded and cancelled orders must never be swept up by this.
const { data: notShipped } = await db
  .from("orders")
  .select("status")
  .in("status", ["refunded", "cancelled"])
  .not("shipped_at", "is", null)
  .lt("shipped_at", cutoff);
console.log(
  `   old refunded/cancelled orders that also shipped: ${(notShipped ?? []).length} — excluded, since the sweep only matches status='shipped'`,
);

console.log("\n✓ checks complete");
