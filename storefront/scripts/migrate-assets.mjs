/**
 * One-off: pull product images + COA PDFs off the old WordPress host and into
 * Supabase Storage, then rewrite the database URLs.
 *
 * Why the --resolve trick: eastcoastlabs.com.au now points at Vercel, so the
 * old /wp-content/ URLs 403. The files still exist on the Hostinger origin, so
 * we fetch them by IP with an explicit Host header while that box is alive.
 *
 * Safe to re-run: uploads use upsert, and rows already pointing at Supabase are
 * skipped. Pass --dry to preview without writing anything.
 */
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry");
const OLD_HOST = "eastcoastlabs.com.au";
const OLD_IP = "46.202.186.244";

const db = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/**
 * Fetch a legacy asset from the origin IP, bypassing DNS.
 *
 * Uses curl --resolve rather than fetch(): Node treats `Host` as a forbidden
 * header and silently drops it, so a fetch to the bare IP never reaches the
 * right vhost (and the cert wouldn't match anyway). curl --resolve pins the
 * hostname to the old IP while keeping SNI and Host correct.
 */
async function fetchLegacy(url) {
  const { execFileSync } = await import("node:child_process");
  const u = new URL(url);

  const meta = execFileSync("curl", [
    "-s", "--resolve", `${OLD_HOST}:443:${OLD_IP}`,
    "-o", "/dev/null", "-w", "%{http_code} %{content_type}",
    `https://${OLD_HOST}${u.pathname}`,
  ], { encoding: "utf8" }).trim();

  const [code, contentType = "application/octet-stream"] = meta.split(" ");
  if (code !== "200") throw new Error(`HTTP ${code}`);

  const bytes = execFileSync("curl", [
    "-s", "--resolve", `${OLD_HOST}:443:${OLD_IP}`,
    `https://${OLD_HOST}${u.pathname}`,
  ], { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });

  if (!bytes?.length) throw new Error("empty body");
  return { bytes, contentType };
}

const cleanName = (pathname) =>
  decodeURIComponent(pathname.split("/").pop() || "file")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(-120);

async function upload(bucket, path, bytes, contentType) {
  const { error } = await sb.storage.from(bucket).upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(error.message);
  return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

const isLegacy = (u) => typeof u === "string" && u.includes(OLD_HOST);

async function migrateProductImages() {
  const { rows } = await db.query("select id, slug, images from products");
  let moved = 0,
    failed = 0;

  for (const p of rows) {
    const images = p.images || [];
    if (!images.some((i) => isLegacy(i?.src))) continue;

    const next = [];
    for (const [i, img] of images.entries()) {
      if (!isLegacy(img?.src)) {
        next.push(img);
        continue;
      }
      const path = `${p.slug}/${i}-${cleanName(new URL(img.src).pathname)}`;
      try {
        if (DRY) {
          console.log(`  [dry] ${p.slug} ← ${img.src.slice(-45)}`);
          next.push(img);
          moved++;
          continue;
        }
        const { bytes, contentType } = await fetchLegacy(img.src);
        const publicUrl = await upload("product-images", path, bytes, contentType);
        next.push({ ...img, src: publicUrl });
        moved++;
        console.log(`  ✓ ${p.slug}  ${(bytes.length / 1024).toFixed(0)}KB`);
      } catch (err) {
        failed++;
        next.push(img); // keep the old URL rather than lose the reference
        console.log(`  ✗ ${p.slug}  ${img.src.slice(-40)} — ${err.message}`);
      }
    }
    if (!DRY) await db.query("update products set images = $1 where id = $2", [JSON.stringify(next), p.id]);
  }
  return { moved, failed };
}

async function migrateCoas() {
  const { rows } = await db.query(
    "select id, batch_id, coa_url from coa_batches where coa_url like $1",
    [`%${OLD_HOST}%`],
  );
  let moved = 0,
    failed = 0;

  for (const r of rows) {
    const path = `${r.batch_id}-${cleanName(new URL(r.coa_url).pathname)}`;
    try {
      if (DRY) {
        console.log(`  [dry] COA ${r.batch_id} ← ${r.coa_url.slice(-40)}`);
        moved++;
        continue;
      }
      const { bytes, contentType } = await fetchLegacy(r.coa_url);
      const publicUrl = await upload("coa", path, bytes, contentType);
      await db.query("update coa_batches set coa_url = $1 where id = $2", [publicUrl, r.id]);
      moved++;
      console.log(`  ✓ COA ${r.batch_id}  ${(bytes.length / 1024).toFixed(0)}KB`);
    } catch (err) {
      failed++;
      console.log(`  ✗ COA ${r.batch_id} — ${err.message}`);
    }
  }
  return { moved, failed };
}

await db.connect();
console.log(DRY ? "DRY RUN — nothing will be written\n" : "MIGRATING\n");
console.log("Product images:");
const imgs = await migrateProductImages();
console.log("\nCOA documents:");
const coas = await migrateCoas();
console.log(
  `\nimages: ${imgs.moved} moved, ${imgs.failed} failed · COAs: ${coas.moved} moved, ${coas.failed} failed`,
);
await db.end();
