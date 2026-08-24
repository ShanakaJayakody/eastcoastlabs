/**
 * Upload the local product photos (storefront/public/images/products/*-v2.png)
 * to Supabase Storage, then repoint both catalog.json (public storefront) and
 * the admin `products` table at the resulting URLs.
 *
 * Path convention: product-images/<slug>/primary.png — a STABLE path per slug,
 * on purpose. Swapping a product photo in future is then just re-running this
 * script (or re-uploading in the admin UI) with upsert; the URL never changes,
 * so no catalog.json edit and no redeploy is needed to pick up the new image.
 *
 * Safe to re-run: uploads use upsert:true, catalog.json write is idempotent.
 * Pass --dry to preview without writing anything.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DRY = process.argv.includes("--dry");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const IMAGES_DIR = path.join(ROOT, "public/images/products");
const CATALOG_PATH = path.join(ROOT, "data/catalog.json");
const BUCKET = "product-images";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function slugFromFilename(name) {
  const m = name.match(/^(.+)-v2\.png$/);
  return m ? m[1] : null;
}

async function uploadOne(slug, filePath) {
  const bytes = readFileSync(filePath);
  const objectPath = `${slug}/primary.png`;
  if (DRY) {
    console.log(`  [dry] ${slug} <- ${filePath} (${(bytes.length / 1024).toFixed(0)}KB) -> ${objectPath}`);
    return sb.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
  }
  const { error } = await sb.storage
    .from(BUCKET)
    .upload(objectPath, bytes, { contentType: "image/png", upsert: true, cacheControl: "3600" });
  if (error) throw new Error(`upload ${slug}: ${error.message}`);
  const publicUrl = sb.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
  console.log(`  ✓ ${slug}  ${(bytes.length / 1024).toFixed(0)}KB -> ${publicUrl}`);
  return publicUrl;
}

async function syncAdminProduct(slug, publicUrl, alt) {
  const { data: existing, error: selErr } = await sb.from("products").select("id, slug").eq("slug", slug).maybeSingle();
  if (selErr) throw new Error(`select ${slug}: ${selErr.message}`);
  if (!existing) {
    console.log(`  (no admin products row for ${slug} — skipping admin sync)`);
    return false;
  }
  if (DRY) return true;
  const { error: updErr } = await sb
    .from("products")
    .update({ images: [{ src: publicUrl, alt }], updated_at: new Date().toISOString() })
    .eq("slug", slug);
  if (updErr) throw new Error(`update admin products ${slug}: ${updErr.message}`);
  return true;
}

async function main() {
  console.log(DRY ? "DRY RUN — nothing will be written\n" : "UPLOADING\n");

  const files = readdirSync(IMAGES_DIR).filter((f) => f.endsWith("-v2.png"));
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));

  const urlBySlug = {};
  for (const file of files) {
    const slug = slugFromFilename(file);
    if (!slug) continue;
    const publicUrl = await uploadOne(slug, path.join(IMAGES_DIR, file));
    urlBySlug[slug] = publicUrl;
  }

  let catalogUpdated = 0;
  let adminSynced = 0;
  for (const p of catalog) {
    const publicUrl = urlBySlug[p.slug];
    if (!publicUrl) continue;
    const alt = p.images?.[0]?.alt || `${p.name} research peptide vial – East Coast Labs Australia`;
    p.images = [{ src: publicUrl, alt }];
    catalogUpdated++;
    if (await syncAdminProduct(p.slug, publicUrl, alt)) adminSynced++;
  }

  if (!DRY) writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n");

  console.log(`\ncatalog.json: ${catalogUpdated} products repointed at Supabase Storage`);
  console.log(`admin products table: ${adminSynced} rows synced`);
}

await main();
