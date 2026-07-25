/**
 * Seed products + variants (1·3·6 vial tiers) + inventory rows from the storefront
 * catalog. Idempotent: products/variants upsert on their natural keys; inventory
 * rows are created only if absent (never resets on_hand). Run:
 *
 *   node --env-file=.env.local supabase/seed-catalog.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SR) {
  console.error("Missing Supabase env. Run with: node --env-file=.env.local supabase/seed-catalog.mjs");
  process.exit(1);
}
const db = createClient(URL, SR, { auth: { persistSession: false } });

const catalog = JSON.parse(await readFile(path.join(root, "data/catalog.json"), "utf8"));
const priceTable = JSON.parse(await readFile(path.join(root, "data/price-table.json"), "utf8"));

const PCT3 = (100 - (priceTable.discount_3pk_pct ?? 15)) / 100;
const PCT6 = (100 - (priceTable.discount_6pk_pct ?? 25)) / 100;
const SLUG_ALIASES = { igf: "igf-1-lr3" };
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");

function findRawPrices(slug, name) {
  const target = SLUG_ALIASES[slug] ?? slug;
  const bySlug = priceTable.products.find((p) => p.slug === target || p.slug === slug);
  if (bySlug) return bySlug.prices;
  if (name) {
    const n = norm(name);
    const byName = priceTable.products.find(
      (p) => norm(p.name) === n || norm(p.name).includes(n) || n.includes(norm(p.name)),
    );
    if (byName) return byName.prices;
  }
  return null;
}

const toCents = (dollars) => Math.round(Number(dollars) * 100);

let products = 0,
  variants = 0,
  inventory = 0,
  matched = 0,
  derived = 0;

for (const c of catalog) {
  const singleCents = parseInt(c.price, 10) || 0;
  const regularCents = parseInt(c.regular_price, 10) || 0;

  const { data: prod, error: pErr } = await db
    .from("products")
    .upsert(
      {
        slug: c.slug,
        name: c.name,
        sku: c.sku,
        compound: c.name,
        short_description: c.short_description ?? null,
        description: c.description ?? null,
        images: c.images ?? [],
        categories: c.categories ?? [],
        status: "active",
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();
  if (pErr) {
    console.error(`product ${c.slug}:`, pErr.message);
    continue;
  }
  products++;

  const raw = findRawPrices(c.slug, c.name);
  if (raw) matched++;
  else derived++;

  const pack3Cents = raw?.["3_pack"] != null ? toCents(raw["3_pack"]) : Math.round(singleCents * 3 * PCT3);
  const pack6Cents = raw?.["6_pack"] != null ? toCents(raw["6_pack"]) : Math.round(singleCents * 6 * PCT6);

  const rows = [
    {
      product_id: prod.id,
      sku: `${c.sku}-1`,
      pack_size: 1,
      label: "1 vial",
      price_cents: singleCents,
      compare_at_cents: regularCents > singleCents ? regularCents : null,
      position: 0,
    },
    {
      product_id: prod.id,
      sku: `${c.sku}-3`,
      pack_size: 3,
      label: "3-pack",
      price_cents: pack3Cents,
      compare_at_cents: singleCents * 3,
      position: 1,
    },
    {
      product_id: prod.id,
      sku: `${c.sku}-6`,
      pack_size: 6,
      label: "6-pack",
      price_cents: pack6Cents,
      compare_at_cents: singleCents * 6,
      position: 2,
    },
  ];

  const { data: vs, error: vErr } = await db
    .from("product_variants")
    .upsert(rows, { onConflict: "sku" })
    .select("id");
  if (vErr) {
    console.error(`variants ${c.slug}:`, vErr.message);
    continue;
  }
  variants += vs.length;

  const invRows = vs.map((v) => ({ variant_id: v.id, low_stock_threshold: 5 }));
  const { error: iErr } = await db
    .from("inventory")
    .upsert(invRows, { onConflict: "variant_id", ignoreDuplicates: true });
  if (iErr) console.error(`inventory ${c.slug}:`, iErr.message);
  else inventory += invRows.length;
}

console.log(
  `seeded: ${products} products, ${variants} variants, ${inventory} inventory rows ` +
    `(price-table matched ${matched}, derived ${derived})`,
);
