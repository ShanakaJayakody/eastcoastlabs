/**
 * Apply Supabase migrations + seed over the direct Postgres connection.
 *
 * Usage (from storefront/):
 *   set -a; source ../.supabase-secrets.env; set +a
 *   node supabase/apply.mjs            # migrations then seed
 *   node supabase/apply.mjs --no-seed  # migrations only
 *
 * Reads SUPABASE_DB_URL from the environment. Migrations use IF NOT EXISTS /
 * ON CONFLICT, so re-running is safe. No Supabase CLI required.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const dbUrl = process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  console.error("✗ SUPABASE_DB_URL is not set. Source ../.supabase-secrets.env first.");
  process.exit(1);
}

const runSeed = !process.argv.includes("--no-seed");

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function run(label, sql) {
  process.stdout.write(`→ ${label} … `);
  await client.query(sql);
  console.log("ok");
}

try {
  await client.connect();
  console.log("Connected to Postgres.\n");

  const migDir = path.join(here, "migrations");
  const files = (await readdir(migDir)).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    await run(`migration ${f}`, await readFile(path.join(migDir, f), "utf8"));
  }

  if (runSeed) {
    const seedPath = path.join(here, "seed.sql");
    await run("seed.sql", await readFile(seedPath, "utf8"));
  }

  // Quick sanity check
  const { rows } = await client.query(
    "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
  );
  console.log("\nPublic tables:", rows.map((r) => r.table_name).join(", "));
  const coa = await client.query("select count(*)::int as n from public.coa_batches");
  console.log("coa_batches rows:", coa.rows[0].n);

  console.log("\n✓ Done.");
} catch (err) {
  console.error("\n✗ Failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
