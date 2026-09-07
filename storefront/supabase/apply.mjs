/** Tracked migration CLI. No seed file is ever read or executed. */
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { databaseOptions, parseArguments, readMigrations, runMigrations } from './migration-runner.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
let client;
try {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(`Usage: node supabase/apply.mjs [--dry-run] [--baseline-through EXACT_FILENAME.sql]

Default: validate all recorded hashes, then apply only new migrations.
--dry-run: inspect in a read-only transaction; create/change nothing.
--baseline-through: explicitly record existing schema history through this exact
file, without executing its SQL or applying later files. Review the printed hashes.
No implicit seed. See docs/MIGRATIONS.md before using an existing database.`);
  } else {
    const migrations = await readMigrations(path.join(here, 'migrations'));
    if (options.baselineThrough && !migrations.some((file) => file.filename === options.baselineThrough)) throw new Error('Baseline requires the exact full filename of an existing migration');
    const dbUrl = process.env.SUPABASE_DB_URL;
    if (!dbUrl) throw new Error('SUPABASE_DB_URL is required; credentials must be supplied outside source control');
    const ca = process.env.SUPABASE_DB_CA_FILE ? await readFile(process.env.SUPABASE_DB_CA_FILE, 'utf8') : undefined;
    const config = databaseOptions(dbUrl, { ...process.env, ...(ca ? { SUPABASE_DB_CA_CERT: ca } : {}) });
    if (options.baselineThrough) {
      console.log(`Baseline ${options.dryRun ? 'preview' : 'requested'} through ${options.baselineThrough}:`);
      for (const file of migrations.filter((m) => m.filename <= options.baselineThrough)) console.log(`${file.sha256}  ${file.filename}`);
    }
    client = new pg.Client(config);
    await client.connect();
    const result = await runMigrations({ query: (sql, params) => client.query(sql, params), exec: (sql) => client.query(sql) }, migrations, options);
    for (const name of result.applied) console.log(`Applied ${name}`);
    for (const name of result.baselined) console.log(`Baselined ${name}`);
    for (const name of result.pending) console.log(`Pending ${name}`);
    console.log(options.dryRun ? 'Read-only inspection complete.' : options.baselineThrough ? 'Baseline recorded. Run --dry-run to review the remaining migrations.' : `${result.applied.length} migration(s) applied; recorded checksums verified.`);
  }
} catch (error) {
  console.error(`Migration runner failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exitCode = 1;
} finally {
  if (client) await client.end();
}
