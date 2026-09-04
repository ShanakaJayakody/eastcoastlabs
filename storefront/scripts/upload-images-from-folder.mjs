/**
 * Upload product photos from the repo-root "product images" folder to Supabase
 * Storage and attach them to the matching `products` row.
 *
 * Companion to upload-product-images.mjs, which reads the older
 * public/images/products/<slug>-v2.png convention. This one takes the folder
 * the photos actually arrive in, with human filenames ("NAD+ 500mg ECL.png"),
 * and resolves each to a product by matching against DB slugs and names.
 *
 * Path convention is unchanged and deliberate: product-images/<slug>/primary.png
 * is STABLE per slug, uploaded with upsert. Swapping a photo later re-runs this
 * script and the URL never changes — no redeploy needed to pick up a new image.
 *
 * Since the storefront reads its catalog from the DB (lib/catalog.ts), setting
 * products.images is all that's required; catalog.json is fallback only and is
 * deliberately left alone.
 *
 * Dry run by default — prints the filename -> slug mapping so it can be checked
 * before anything is written. Pass --apply to upload.
 *
 * Products that ALREADY have an image are skipped unless --replace is passed:
 * the folder holds every photo ever shot, so a plain run would otherwise
 * re-push a dozen images that are already live and correct.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const REPLACE = process.argv.includes("--replace");
const ROOT = path.resolve(import.meta.dirname, "..");
const IMAGES_DIR = path.join(ROOT, "..", "product images");
const BUCKET = "product-images";

/**
 * Filenames whose fuzzy match would be wrong or ambiguous.
 * "CJC IPA no dac 10mg" contains both "cjc ipa" and "no dac" — it's the
 * combination product, where the CJC-1295 component is the no-DAC form.
 */
const OVERRIDES = {
  "CJC IPA no dac 10mg.png": "cjc-1295-ipamorelin",
};

const env = Object.fromEntries(
  readFileSync(path.join(ROOT, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** Letters and digits only — strips dosages, spaces, punctuation, "ECL". */
const normalize = (s) => s.toLowerCase().replace(/\becl\b/g, "").replace(/[^a-z0-9]/g, "");

/** Score how well a filename identifies a product. Higher is better, 0 = no match. */
function score(fileKey, product) {
  const slugKey = normalize(product.slug);
  const nameKey = normalize(product.name);
  for (const key of [slugKey, nameKey]) {
    if (!key) continue;
    if (fileKey === key) return 100;
    if (fileKey.startsWith(key)) return 50 + key.length;
    if (fileKey.includes(key)) return 20 + key.length;
  }
  return 0;
}

const { data: products, error } = await sb.from("products").select("slug, name, images");
if (error) throw new Error(`load products: ${error.message}`);

const files = readdirSync(IMAGES_DIR).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
const plan = [];

for (const file of files) {
  const forced = OVERRIDES[file];
  let product = null;
  let why = "";

  if (forced) {
    product = products.find((p) => p.slug === forced) ?? null;
    why = "override";
  } else {
    const fileKey = normalize(path.parse(file).name);
    const ranked = products
      .map((p) => ({ p, s: score(fileKey, p) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s);
    // A tie between two products is not a match — better to skip and be told.
    if (ranked.length && (ranked.length === 1 || ranked[0].s > ranked[1].s)) {
      product = ranked[0].p;
      why = `matched (score ${ranked[0].s})`;
    } else if (ranked.length) {
      why = `AMBIGUOUS: ${ranked.slice(0, 3).map((r) => r.p.slug).join(", ")} — add an OVERRIDES entry`;
    } else {
      why = "no matching product";
    }
  }

  plan.push({ file, product, why, hasImage: Boolean(product?.images?.length) });
}

console.log(APPLY ? "UPLOADING\n" : "DRY RUN — nothing will be written\n");
for (const row of plan) {
  const target = row.product ? row.product.slug : "—";
  const state = row.product ? (row.hasImage ? "replaces existing" : "first image") : "";
  console.log(`${row.file.padEnd(30)} -> ${target.padEnd(24)} ${row.why} ${state}`);
}

const actionable = plan.filter((r) => r.product && (REPLACE || !r.hasImage));
const skipped = plan.filter((r) => r.product && r.hasImage && !REPLACE).length;
if (skipped) console.log(`\n${skipped} product(s) already have an image — skipped. Pass --replace to overwrite.`);
if (!APPLY) {
  console.log(`\n${actionable.length} file(s) would be uploaded. Re-run with --apply.`);
  process.exit(0);
}

for (const { file, product } of actionable) {
  const bytes = readFileSync(path.join(IMAGES_DIR, file));
  const ext = path.extname(file).toLowerCase() === ".png" ? "png" : "jpg";
  const objectPath = `${product.slug}/primary.${ext}`;
  const { error: upErr } = await sb.storage.from(BUCKET).upload(objectPath, bytes, {
    contentType: ext === "png" ? "image/png" : "image/jpeg",
    upsert: true,
    cacheControl: "3600",
  });
  if (upErr) throw new Error(`upload ${product.slug}: ${upErr.message}`);

  const publicUrl = sb.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
  const alt =
    product.images?.[0]?.alt ||
    `${product.name} research peptide vial – East Coast Labs Australia`;
  const { error: updErr } = await sb
    .from("products")
    .update({ images: [{ src: publicUrl, alt }], updated_at: new Date().toISOString() })
    .eq("slug", product.slug);
  if (updErr) throw new Error(`update ${product.slug}: ${updErr.message}`);

  console.log(`  ✓ ${product.slug.padEnd(24)} ${(bytes.length / 1024).toFixed(0)}KB -> ${publicUrl}`);
}

console.log(`\n${actionable.length} products updated.`);
