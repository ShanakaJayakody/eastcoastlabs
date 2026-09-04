/**
 * One-off: reprice 3/6-pack tiers to the new 10% / 20% pack discounts.
 *
 * Two sources of truth have to move together — data/price-table.json (what the
 * PDP DISPLAYS) and product_variants.price_cents (what checkout CHARGES). If
 * only one moves, customers see one price and get billed another.
 *
 * House rounding rule, preserved from the existing catalogue:
 *   pack price = floor(single x packs x (1 - discount))  -> whole dollars
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const env = Object.fromEntries(
  fs.readFileSync(path.join(root, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const D3 = 0.10, D6 = 0.20;
const APPLY = process.argv.includes("--apply");
const packPrice = (singleMajor, packs, off) => Math.floor(singleMajor * packs * (1 - off));

// ---- 1. price-table.json -----------------------------------------------
const tablePath = path.join(root, "data/price-table.json");
const table = JSON.parse(fs.readFileSync(tablePath, "utf8"));
table.description = `ECL Tier Pricing Table — 1/3/6 vial packs. 3-pack = ${D3 * 100}% off 3x single. 6-pack = ${D6 * 100}% off 6x single. All prices in AUD. Rounded down to whole dollars.`;
table.discount_3pk_pct = D3 * 100;
table.discount_6pk_pct = D6 * 100;

console.log("── price-table.json ──");
for (const p of table.products) {
  const s = p.prices["1_vial"];
  const was3 = p.prices["3_pack"], was6 = p.prices["6_pack"];
  const p3 = packPrice(s, 3, D3), p6 = packPrice(s, 6, D6);
  p.prices["3_pack"] = p3;
  p.prices["3_pack_per_vial"] = Math.round((p3 / 3) * 100) / 100;
  p.prices["6_pack"] = p6;
  p.prices["6_pack_per_vial"] = Math.round((p6 / 6) * 100) / 100;
  p.prices["6_pack_saving_shown"] = `Save $${Math.floor(s * 6 - p6)}`;
  console.log(`${p.slug.padEnd(22)} 3pk $${was3} -> $${p3}   6pk $${was6} -> $${p6}`);
}
if (APPLY) fs.writeFileSync(tablePath, JSON.stringify(table, null, 2) + "\n");

// ---- 2. product_variants.price_cents ------------------------------------
const { data: products, error } = await db
  .from("products")
  .select("slug, product_variants(id, pack_size, price_cents)")
  .neq("status", "archived");
if (error) throw error;

const rollback = [];
const updates = [];
console.log("\n── product_variants (DB) ──");
for (const p of products.sort((a, b) => a.slug.localeCompare(b.slug))) {
  const v = p.product_variants ?? [];
  const single = v.find((x) => x.pack_size === 1);
  if (!single) continue;
  const singleMajor = single.price_cents / 100;
  for (const packSize of [3, 6]) {
    const variant = v.find((x) => x.pack_size === packSize);
    if (!variant) continue;
    const next = packPrice(singleMajor, packSize, packSize === 3 ? D3 : D6) * 100;
    if (next === variant.price_cents) continue;
    rollback.push({ id: variant.id, slug: p.slug, pack_size: packSize, price_cents: variant.price_cents });
    updates.push({ id: variant.id, next });
    console.log(`${p.slug.padEnd(22)} ${packSize}pk $${(variant.price_cents / 100).toFixed(2)} -> $${(next / 100).toFixed(2)}`);
  }
}

if (!APPLY) {
  console.log(`\nDRY RUN — ${updates.length} variant prices would change. Re-run with --apply.`);
  process.exit(0);
}

fs.writeFileSync(
  path.join(root, `scripts/reprice-rollback-${Date.now()}.json`),
  JSON.stringify(rollback, null, 2) + "\n",
);
for (const u of updates) {
  const { error: e } = await db
    .from("product_variants")
    .update({ price_cents: u.next })
    .eq("id", u.id);
  if (e) throw new Error(`${u.id}: ${e.message}`);
}
await db.from("admin_audit_log").insert({
  actor_email: "script:reprice-tiers",
  action: "product.tiers.reprice",
  entity_type: "product_variant",
  entity_id: null,
  diff: { discount_3pk: D3, discount_6pk: D6, changed: rollback.length },
});
console.log(`\nApplied ${updates.length} price changes. Rollback snapshot written to scripts/.`);
