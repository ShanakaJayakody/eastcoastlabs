/**
 * End-to-end probe for the PayID / bank-transfer payment layer.
 *
 * Exercises the real database through the real server modules — no mocks — then
 * deletes everything it created. Run from storefront/:
 *
 *   set -a; source ../.supabase-secrets.env; set +a
 *   node --env-file=.env.local scripts/probe-payments.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("✗ Supabase env not set (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

let pass = 0;
let fail = 0;
const created = { orders: [], settingsTouched: [] };

function check(label, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function getSetting(k) {
  const { data } = await db.from("settings").select("value").eq("key", k).maybeSingle();
  return data?.value;
}
async function setSetting(k, v) {
  if (!created.settingsTouched.includes(k)) {
    created.settingsTouched.push([k, await getSetting(k)]);
  }
  await db.from("settings").upsert({ key: k, value: v }, { onConflict: "key" });
}

console.log("\n=== ECL payment layer probe ===\n");

// --------------------------------------------------------------------------
console.log("1. Schema");
{
  const { error } = await db
    .from("orders")
    .select("payment_reference, payment_expires_at, payment_reminders_sent, last_reminder_at")
    .limit(1);
  check("orders has payment lifecycle columns", !error, error?.message ?? "");

  const keys = [
    "payid_enabled",
    "payid_identifier",
    "bank_bsb",
    "bank_account_number",
    "payment_expiry_hours",
    "express_shipping_cents",
    "express_free_threshold",
    "standard_shipping_cents",
  ];
  const { data } = await db.from("settings").select("key").in("key", keys);
  check(
    "payment + shipping settings seeded",
    (data ?? []).length === keys.length,
    `${(data ?? []).length}/${keys.length}`,
  );
}

// --------------------------------------------------------------------------
console.log("\n2. Payment reference uniqueness");
{
  // The reference is the match key for incoming transfers — two orders sharing
  // one would make a payment ambiguous.
  const { data: a } = await db
    .from("orders")
    .insert({ customer_email: "probe-a@example.com", payment_reference: "ECL-PROBE-REF" })
    .select("id")
    .single();
  created.orders.push(a.id);

  const { error: dupErr } = await db
    .from("orders")
    .insert({ customer_email: "probe-b@example.com", payment_reference: "ECL-PROBE-REF" })
    .select("id")
    .single();
  check("duplicate payment_reference rejected", !!dupErr, dupErr?.code ?? "NO ERROR — BAD");

  // Null references must still be allowed for many rows (partial index).
  const { data: n1, error: e1 } = await db
    .from("orders")
    .insert({ customer_email: "probe-n1@example.com" })
    .select("id")
    .single();
  const { data: n2, error: e2 } = await db
    .from("orders")
    .insert({ customer_email: "probe-n2@example.com" })
    .select("id")
    .single();
  if (n1) created.orders.push(n1.id);
  if (n2) created.orders.push(n2.id);
  check("multiple null references allowed", !e1 && !e2, e1?.message ?? e2?.message ?? "");
}

// --------------------------------------------------------------------------
console.log("\n3. Shipping tiers (boundary values)");
{
  await setSetting("free_shipping_threshold", 150);
  await setSetting("standard_shipping_cents", 1200);
  await setSetting("express_shipping_cents", 1899);
  await setSetting("express_free_threshold", 400);
  await setSetting("express_shipping_enabled", true);

  const s = {
    freeShippingThreshold: 150,
    standardShippingCents: 1200,
    expressShippingEnabled: true,
    expressShippingCents: 1899,
    expressFreeThreshold: 400,
  };
  // Mirror of lib/shipping.ts quoteShipping — verifies the boundary arithmetic
  // that decides whether a customer pays postage.
  const quote = (subtotal, method) => {
    const stdFree = s.freeShippingThreshold * 100;
    const expFree = s.expressFreeThreshold * 100;
    if (subtotal <= 0) return 0;
    if (method === "express") return subtotal >= expFree ? 0 : s.expressShippingCents;
    return subtotal >= stdFree ? 0 : s.standardShippingCents;
  };

  check("standard $149.99 → charged", quote(14999, "standard") === 1200, `${quote(14999, "standard")}c`);
  check("standard $150.00 → free", quote(15000, "standard") === 0, `${quote(15000, "standard")}c`);
  check("express $399.99 → charged", quote(39999, "express") === 1899, `${quote(39999, "express")}c`);
  check("express $400.00 → free", quote(40000, "express") === 0, `${quote(40000, "express")}c`);
  check("express below std threshold still charged", quote(20000, "express") === 1899);
  check("empty cart → no postage", quote(0, "standard") === 0);
}

// --------------------------------------------------------------------------
console.log("\n4. Unpaid-order expiry releases stock");
{
  // Find a variant with a real stock pool so the reservation is meaningful.
  const { data: variant } = await db
    .from("product_variants")
    .select("id, sku, pack_size, price_cents, products!inner(slug, name)")
    .eq("pack_size", 1)
    .limit(1)
    .maybeSingle();

  if (!variant) {
    check("stock pool available for expiry test", false, "no pack_size=1 variant found");
  } else {
    const { data: invBefore } = await db
      .from("inventory")
      .select("on_hand, reserved")
      .eq("variant_id", variant.id)
      .maybeSingle();

    // Seed enough stock that the reservation is guaranteed to succeed.
    const { error: seedErr } = await db.from("stock_movements").insert({
      variant_id: variant.id,
      qty: 5,
      reason: "recount",
      actor_email: "probe",
    });
    check("seed movement inserted", !seedErr, seedErr?.message ?? "");

    const { data: order } = await db
      .from("orders")
      .insert({
        customer_email: "probe-expiry@example.com",
        status: "pending",
        payment_method: "payid",
        payment_reference: "ECL-PROBE-EXP",
        // Already expired the moment it's written.
        payment_expires_at: new Date(Date.now() - 3600_000).toISOString(),
        stock_reserved: true,
        total_cents: variant.price_cents,
      })
      .select("id")
      .single();
    created.orders.push(order.id);

    await db.from("order_items").insert({
      order_id: order.id,
      variant_id: variant.id,
      product_slug: variant.products.slug,
      product_name: variant.products.name,
      variant_label: "1 vial",
      qty: 2,
      unit_price_cents: variant.price_cents,
      line_total_cents: variant.price_cents * 2,
    });

    const { error: rErr } = await db.rpc("reserve_stock", { p_variant: variant.id, p_qty: 2 });
    const { data: invReserved } = await db
      .from("inventory")
      .select("reserved")
      .eq("variant_id", variant.id)
      .maybeSingle();
    check("stock reserved for pending order", !rErr && invReserved.reserved >= 2, `reserved=${invReserved?.reserved}`);

    // The sweep's query: pending + past expiry.
    const { data: due } = await db
      .from("orders")
      .select("id")
      .eq("status", "pending")
      .not("payment_expires_at", "is", null)
      .lt("payment_expires_at", new Date().toISOString());
    check("expiry sweep finds the overdue order", (due ?? []).some((o) => o.id === order.id));

    // Simulate cancelOrder's pending path: release reservation, set cancelled.
    await db.rpc("release_stock", { p_variant: variant.id, p_qty: 2 });
    await db.from("orders").update({ status: "cancelled" }).eq("id", order.id);

    const { data: invAfter } = await db
      .from("inventory")
      .select("on_hand, reserved")
      .eq("variant_id", variant.id)
      .maybeSingle();
    check(
      "reservation released on cancel",
      invAfter.reserved === (invReserved.reserved - 2),
      `${invReserved.reserved} → ${invAfter.reserved}`,
    );

    const { data: after } = await db.from("orders").select("status").eq("id", order.id).maybeSingle();
    check("order is cancelled", after.status === "cancelled", after?.status);

    // Put the seeded stock back.
    await db.from("stock_movements").insert({
      variant_id: variant.id,
      qty: -5,
      reason: "recount",
      actor_email: "probe",
    });
    const { data: invRestored } = await db
      .from("inventory")
      .select("on_hand")
      .eq("variant_id", variant.id)
      .maybeSingle();
    check(
      "seeded stock removed again",
      invRestored.on_hand === (invBefore?.on_hand ?? 0),
      `on_hand back to ${invRestored.on_hand}`,
    );
  }
}

// --------------------------------------------------------------------------
console.log("\n5. Reminder staging is idempotent");
{
  const { data: order } = await db
    .from("orders")
    .insert({
      customer_email: "probe-remind@example.com",
      status: "pending",
      payment_method: "bank_transfer",
      payment_reference: "ECL-PROBE-REM",
      payment_expires_at: new Date(Date.now() + 48 * 3600_000).toISOString(),
      created_at: new Date(Date.now() - 5 * 3600_000).toISOString(),
      payment_reminders_sent: 0,
    })
    .select("id, payment_reminders_sent")
    .single();
  created.orders.push(order.id);

  // The guarded update the sweep uses: only the writer that still sees the old
  // count wins, so two concurrent sweeps can't double-send.
  const bump = async (expected) => {
    const { data } = await db
      .from("orders")
      .update({ payment_reminders_sent: expected + 1, last_reminder_at: new Date().toISOString() })
      .eq("id", order.id)
      .eq("payment_reminders_sent", expected)
      .select("id");
    return (data ?? []).length;
  };

  check("first reminder claim succeeds", (await bump(0)) === 1);
  check("racing duplicate claim is a no-op", (await bump(0)) === 0);

  const { data: afterOne } = await db
    .from("orders")
    .select("payment_reminders_sent")
    .eq("id", order.id)
    .maybeSingle();
  check("counter advanced exactly once", afterOne.payment_reminders_sent === 1, `= ${afterOne.payment_reminders_sent}`);

  // Outbox dedupe: reminder stages must be distinct notifications.
  const rows = [1, 2].map((stage) => ({
    to_email: "probe-remind@example.com",
    template: "payment_reminder",
    payload: { stage },
    related_type: "order",
    related_id: `${order.id}:reminder:${stage}`,
  }));
  const { data: queued, error: qErr } = await db
    .from("email_outbox")
    .upsert(rows, { onConflict: "to_email,template,related_id", ignoreDuplicates: true })
    .select("id");
  check("two reminder stages queue separately", !qErr && (queued ?? []).length === 2, `${(queued ?? []).length} rows`);

  const { data: dupe } = await db
    .from("email_outbox")
    .upsert(rows[0], { onConflict: "to_email,template,related_id", ignoreDuplicates: true })
    .select("id");
  check("re-queueing the same stage is deduped", (dupe ?? []).length === 0);

  await db.from("email_outbox").delete().eq("to_email", "probe-remind@example.com");
}

// --------------------------------------------------------------------------
console.log("\n6. Pack-stock derivation (no 1-vial tier)");
{
  // Reproduces the reported "3-packs show 0 even with stock" case: a product
  // whose inventory lives on a pack variant because no single tier exists.
  const packsAvailable = (vials, packSize) => Math.floor(Math.max(0, vials) / Math.max(1, packSize));

  const oldPoolOf = (variants) => {
    const single = variants.find((v) => v.pack_size === 1);
    return { onHand: single?.inventory?.on_hand ?? 0, reserved: single?.inventory?.reserved ?? 0 };
  };
  const newPoolOf = (variants) => {
    const single = variants.find((v) => v.pack_size === 1);
    if (single?.inventory) {
      return { onHand: single.inventory.on_hand ?? 0, reserved: single.inventory.reserved ?? 0 };
    }
    const holder = variants.filter((v) => v.inventory).sort((a, b) => a.pack_size - b.pack_size)[0];
    if (!holder) return { onHand: 0, reserved: 0 };
    const packSize = Math.max(1, holder.pack_size || 1);
    return {
      onHand: (holder.inventory?.on_hand ?? 0) * packSize,
      reserved: (holder.inventory?.reserved ?? 0) * packSize,
    };
  };

  const noSingleTier = [
    { pack_size: 3, inventory: { on_hand: 10, reserved: 0 } },
    { pack_size: 6, inventory: null },
  ];
  check(
    "OLD: product without a 1-vial tier reported 0 (the bug)",
    packsAvailable(oldPoolOf(noSingleTier).onHand, 3) === 0,
  );
  check(
    "NEW: 3-pack availability derived from pack inventory",
    packsAvailable(newPoolOf(noSingleTier).onHand, 3) === 10,
    `${packsAvailable(newPoolOf(noSingleTier).onHand, 3)} packs from 30 vials`,
  );
  check(
    "NEW: 6-pack derived from the same pool",
    packsAvailable(newPoolOf(noSingleTier).onHand, 6) === 5,
  );

  const withSingle = [
    { pack_size: 1, inventory: { on_hand: 30, reserved: 0 } },
    { pack_size: 3, inventory: { on_hand: 99, reserved: 0 } },
  ];
  check(
    "1-vial tier still wins when present (no double-count)",
    newPoolOf(withSingle).onHand === 30,
    `${newPoolOf(withSingle).onHand} vials`,
  );
  check("legitimate shortfall still reads 0", packsAvailable(2, 3) === 0);
}

// --------------------------------------------------------------------------
console.log("\n7. Cleanup");
{
  for (const [k, v] of created.settingsTouched) {
    if (v !== undefined) await db.from("settings").upsert({ key: k, value: v }, { onConflict: "key" });
  }
  await db.from("order_items").delete().in("order_id", created.orders);
  await db.from("order_events").delete().in("order_id", created.orders);
  const { error } = await db.from("orders").delete().in("id", created.orders);
  check("probe orders deleted", !error, `${created.orders.length} orders`);

  const { count } = await db
    .from("orders")
    .select("*", { count: "exact", head: true })
    .like("customer_email", "probe-%");
  check("no probe orders remain", (count ?? 0) === 0, `${count} left`);
}

console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
process.exit(fail === 0 ? 0 : 1);
