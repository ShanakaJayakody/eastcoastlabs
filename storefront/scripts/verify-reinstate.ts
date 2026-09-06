/**
 * Proves order reinstatement moves stock correctly, on a throwaway order.
 *
 * Deliberately calls the library functions rather than the server actions: the
 * question here is whether the stock ledger stays honest, and going through the
 * action would also email a receipt to the test address for no added coverage.
 *
 * Usage (from storefront/):
 *   bun --preload ./scripts/_stub-server-only.js scripts/verify-reinstate.ts
 */
import { createOrder, cancelOrder, reinstateOrder, reinstateStockCheck } from "@/lib/admin/orders";
import { adminDb } from "@/lib/admin/db";

const db = adminDb();
const TEST_EMAIL = "reinstate-probe@example.invalid";

const inv = async (variantId: string) => {
  const { data } = await db
    .from("inventory")
    .select("on_hand, reserved")
    .eq("variant_id", variantId)
    .maybeSingle();
  const r = data as { on_hand: number; reserved: number } | null;
  return { on_hand: r?.on_hand ?? 0, reserved: r?.reserved ?? 0 };
};

const show = (label: string, s: { on_hand: number; reserved: number }) =>
  console.log(`   ${label.padEnd(28)} on_hand=${s.on_hand} reserved=${s.reserved} available=${s.on_hand - s.reserved}`);

// A single-vial variant with stock to spare, so the probe never competes with real demand.
const { data: candidates } = await db
  .from("inventory")
  .select("variant_id, on_hand, reserved, product_variants(pack_size, label, product_id)")
  .gt("on_hand", 5)
  .limit(20);

const pick = ((candidates ?? []) as unknown as {
  variant_id: string;
  on_hand: number;
  reserved: number;
  product_variants: { pack_size: number; label: string } | null;
}[]).find((c) => c.product_variants?.pack_size === 1 && c.on_hand - c.reserved >= 2);

if (!pick) {
  console.error("✗ no single-vial variant with >=2 free — cannot run the probe safely");
  process.exit(1);
}
console.log(`Using variant ${pick.variant_id} (${pick.product_variants?.label})`);

const baseline = await inv(pick.variant_id);
show("baseline", baseline);

/* ---- 1. happy path: create -> cancel -> reinstate to paid ---------------- */
console.log("\n1. create order (reserves stock)");
const order = await createOrder({
  email: TEST_EMAIL,
  name: "Reinstate Probe",
  items: [{ variantId: pick.variant_id, qty: 1 }],
  shippingAddress: { line1: "1 Test St", city: "Sydney", state: "NSW", postcode: "2000" },
});
const afterCreate = await inv(pick.variant_id);
show("after create", afterCreate);
if (afterCreate.reserved !== baseline.reserved + 1) throw new Error("FAIL: create did not reserve");

console.log("\n2. cancel (releases the reservation)");
await cancelOrder(order.orderId, { actor: "probe" });
const afterCancel = await inv(pick.variant_id);
show("after cancel", afterCancel);
if (afterCancel.reserved !== baseline.reserved) throw new Error("FAIL: cancel did not release");
if (afterCancel.on_hand !== baseline.on_hand) throw new Error("FAIL: cancel changed on_hand");

console.log("\n3. stock check reports it is reinstatable");
const check = await reinstateStockCheck(order.orderId);
console.log("   ", JSON.stringify(check.map((c) => ({ qty: c.qty, available: c.available, ok: c.sufficient }))));
if (!check.every((c) => c.sufficient)) throw new Error("FAIL: check says insufficient but stock is free");

console.log("\n4. reinstate straight to paid");
const res = await reinstateOrder(order.orderId, { actor: "probe", toPaid: true, paymentRef: "PROBE-REF" });
const afterReinstate = await inv(pick.variant_id);
show("after reinstate+paid", afterReinstate);
console.log(`    reinstatedTo=${res.reinstatedTo}`);

// A completed sale: one vial off the shelf, nothing left reserved.
if (afterReinstate.on_hand !== baseline.on_hand - 1) throw new Error("FAIL: on_hand did not drop by 1");
if (afterReinstate.reserved !== baseline.reserved) throw new Error("FAIL: reservation left dangling");

const { data: paidRow } = await db
  .from("orders")
  .select("status, stock_settled, stock_restored, paid_at, payment_ref")
  .eq("id", order.orderId)
  .maybeSingle();
console.log("   order row:", JSON.stringify(paidRow));
const pr = paidRow as { status: string; stock_settled: boolean; paid_at: string | null } | null;
if (pr?.status !== "paid" || !pr.stock_settled || !pr.paid_at)
  throw new Error("FAIL: order not properly marked paid");

/* ---- 2. refusal path: reinstate with stock gone -------------------------- */
console.log("\n5. refusal path — cancel a second order, then starve the stock");
const order2 = await createOrder({
  email: TEST_EMAIL,
  name: "Reinstate Probe 2",
  items: [{ variantId: pick.variant_id, qty: 1 }],
  shippingAddress: { line1: "1 Test St", city: "Sydney", state: "NSW", postcode: "2000" },
});
await cancelOrder(order2.orderId, { actor: "probe" });

const starved = await inv(pick.variant_id);
// Reserve everything free, so the reinstate has nothing to take.
await db
  .from("inventory")
  .update({ reserved: starved.on_hand })
  .eq("variant_id", pick.variant_id);
show("starved", await inv(pick.variant_id));

const check2 = await reinstateStockCheck(order2.orderId);
console.log("   check reports sufficient?", check2.map((c) => c.sufficient).join(","));

let refused = false;
try {
  await reinstateOrder(order2.orderId, { actor: "probe", toPaid: true });
} catch (err) {
  refused = true;
  console.log("   refused with:", err instanceof Error ? err.message : String(err));
}
const afterRefusal = await inv(pick.variant_id);
show("after refused reinstate", afterRefusal);
if (!refused) throw new Error("FAIL: reinstate succeeded despite no stock");
if (afterRefusal.reserved !== starved.on_hand)
  throw new Error("FAIL: refused reinstate left a dangling reservation");

const { data: stillCancelled } = await db
  .from("orders")
  .select("status")
  .eq("id", order2.orderId)
  .maybeSingle();
if ((stillCancelled as { status: string }).status !== "cancelled")
  throw new Error("FAIL: refused reinstate still changed the order status");
console.log("   order stayed cancelled ✓");

/* ---- cleanup ------------------------------------------------------------- */
console.log("\n6. cleanup");
await db.from("inventory").update({ reserved: baseline.reserved }).eq("variant_id", pick.variant_id);
await db.from("stock_movements").delete().in("order_id", [order.orderId, order2.orderId]);
await db.from("order_events").delete().in("order_id", [order.orderId, order2.orderId]);
await db.from("order_items").delete().in("order_id", [order.orderId, order2.orderId]);
await db.from("orders").delete().in("id", [order.orderId, order2.orderId]);
await db.from("email_outbox").delete().eq("to_email", TEST_EMAIL);
await db.from("admin_audit_log").delete().in("entity_id", [order.orderId, order2.orderId]);
await db.from("inventory").update({ on_hand: baseline.on_hand, reserved: baseline.reserved }).eq("variant_id", pick.variant_id);
show("restored", await inv(pick.variant_id));

console.log("\n✓ ALL CHECKS PASSED");
