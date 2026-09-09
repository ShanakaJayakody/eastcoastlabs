import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/** @typedef {{filename:string, sql:string, sha256:string}} Migration */
/** @typedef {{query:(sql:string, params?:unknown[])=>Promise<{rows:Record<string,unknown>[]}>, exec:(sql:string)=>Promise<unknown>}} Database */
/** @typedef {{dryRun?:boolean, baselineThrough?:string}} RunOptions */
const NAME = /^\d{14}_[a-z0-9_]+\.sql$/;
const HISTORICAL_DUPLICATE = new Set([
  '20260805100000_coming_soon.sql',
  '20260805100000_lifecycle_marketing.sql',
]);
const LOCK = "hashtextextended('eastcoastlabs:migrations:v1',0)";
const LEDGER = 'ecl_migrations.schema_migrations';
const checksum = (sql) => createHash('sha256').update(sql).digest('hex');

/** Mask comments and quoted bodies before inspecting top-level commands. This
 * lets PL/pgSQL BEGIN/END remain inside their dollar-quoted function bodies. */
function commands(sql) {
  let out = '', i = 0;
  while (i < sql.length) {
    if (sql.startsWith('--', i)) {
      const end = sql.indexOf('\n', i + 2); i = end < 0 ? sql.length : end; out += ' '; continue;
    }
    if (sql.startsWith('/*', i)) {
      let depth = 1; i += 2;
      while (i < sql.length && depth) {
        if (sql.startsWith('/*', i)) { depth++; i += 2; }
        else if (sql.startsWith('*/', i)) { depth--; i += 2; }
        else i++;
      }
      if (depth) throw new Error('Unterminated SQL comment');
      out += ' '; continue;
    }
    const dollar = sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/)?.[0];
    if (dollar) {
      const end = sql.indexOf(dollar, i + dollar.length);
      if (end < 0) throw new Error('Unterminated SQL dollar quote');
      i = end + dollar.length; out += ' '; continue;
    }
    if (sql[i] === "'" || sql[i] === '"') {
      const quote = sql[i++]; let closed = false;
      while (i < sql.length) {
        if (sql[i] === quote && sql[i + 1] === quote) i += 2;
        else if (sql[i] === quote) { i++; closed = true; break; }
        else if (sql[i] === '\\' && quote === "'") i += 2;
        else i++;
      }
      if (!closed) throw new Error('Unterminated SQL quote');
      out += ' '; continue;
    }
    out += sql[i++];
  }
  return out.split(';').map((statement) => statement.trim()).filter(Boolean);
}

/** @param {Migration[]} migrations */
export function validateMigrations(migrations) {
  const names = new Set(), timestamps = new Map();
  for (const migration of migrations) {
    const { filename, sql, sha256 } = migration;
    if (!NAME.test(filename)) throw new Error(`Invalid migration filename: ${filename}`);
    if (names.has(filename)) throw new Error(`Duplicate migration filename: ${filename}`);
    names.add(filename);
    if (checksum(sql) !== sha256) throw new Error(`Source checksum does not match SQL: ${filename}`);
    const timestamp = filename.slice(0, 14);
    const same = timestamps.get(timestamp) ?? [];
    same.push(filename); timestamps.set(timestamp, same);
    for (const command of commands(sql)) {
      if (/^(begin\b|start\s+transaction\b|commit\b|end\b|rollback\b|abort\b|savepoint\b|release\b|prepare\s+transaction\b)/i.test(command)) {
        throw new Error(`Migration ${filename} contains transaction control; the runner owns each transaction`);
      }
    }
  }
  for (const [timestamp, filenames] of timestamps) {
    if (filenames.length > 1 && !(filenames.length === 2 && filenames.every((name) => HISTORICAL_DUPLICATE.has(name)))) {
      throw new Error(`Duplicate migration timestamp ${timestamp}: ${filenames.join(', ')}`);
    }
  }
  return [...migrations].sort((a, b) => a.filename.localeCompare(b.filename));
}

/** @param {string} directory @returns {Promise<Migration[]>} */
export async function readMigrations(directory) {
  const names = (await readdir(directory)).filter((name) => name.endsWith('.sql'));
  const migrations = await Promise.all(names.map(async (filename) => {
    const raw = await readFile(path.join(directory, filename));
    const sql = raw.toString('utf8');
    if (!Buffer.from(sql, 'utf8').equals(raw)) throw new Error(`Migration is not valid UTF-8: ${filename}`);
    return { filename, sql, sha256: checksum(raw) };
  }));
  return validateMigrations(migrations);
}

/** Inspect application-owned public objects, excluding extension members.
 * Supabase's built-in auth/storage schemas are not application migration state. */
async function hasApplicationObjects(db) {
  const { rows } = await db.query(`select exists(
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('r','p','v','m','S','f')
      and not exists(select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e')
    union all
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public'
      and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')
    union all
    select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
      where n.nspname='public' and (t.typtype='e' or t.typtype='d')
      and not exists(select 1 from pg_depend d where d.classid='pg_type'::regclass and d.objid=t.oid and d.deptype='e')
  ) as present`);
  return rows[0].present === true;
}

async function ledgerRows(db) {
  const { rows } = await db.query(`select to_regclass('${LEDGER}') as ledger`);
  if (!rows[0].ledger) return [];
  return (await db.query(`select filename,sha256,baselined from ${LEDGER} order by filename`)).rows;
}

/** @param {Database} db @param {()=>Promise<void>} work */
async function transaction(db, work) {
  await db.exec('begin');
  try { await work(); await db.exec('commit'); }
  catch (error) {
    try { await db.exec('rollback'); } catch { /* Preserve the original failure. The dedicated connection is closed by the CLI. */ }
    throw error;
  }
}
async function createLedger(db) {
  await db.exec(`create schema if not exists ecl_migrations;
    create table if not exists ${LEDGER}(
      filename text primary key,
      sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
      applied_at timestamptz not null default now(),
      baselined boolean not null default false
    );`);
}

/** @param {Database} db @param {Migration[]} source @param {RunOptions} options */
export async function runMigrations(db, source, options = {}) {
  const migrations = validateMigrations(source);
  if (!migrations.length) throw new Error('No migration files found');
  if (options.baselineThrough && !migrations.some((m) => m.filename === options.baselineThrough)) {
    throw new Error('Baseline requires the exact full filename of an existing migration');
  }
  let locked = false, readOnly = false;
  try {
    if (options.dryRun) {
      await db.exec('begin isolation level repeatable read read only'); readOnly = true;
    } else {
      const { rows } = await db.query(`select pg_try_advisory_lock(${LOCK}) as acquired`);
      if (!rows[0].acquired) throw new Error('Another migration runner holds the database advisory lock');
      locked = true;
    }
    const applied = await ledgerRows(db);
    const byName = new Map(migrations.map((m) => [m.filename, m]));
    for (const row of applied) {
      const file = byName.get(String(row.filename));
      if (!file) throw new Error(`Applied migration file is missing: ${row.filename}`);
      if (file.sha256 !== row.sha256) throw new Error(`Applied migration checksum mismatch: ${row.filename}`);
    }
    const known = new Set(applied.map((row) => String(row.filename)));
    const pending = migrations.filter((m) => !known.has(m.filename));
    const latest = applied.length ? String(applied[applied.length - 1].filename) : null;
    if (latest && pending.some((m) => m.filename < latest)) throw new Error('Out-of-order migration: new files must be later than all applied filenames');
    const populated = await hasApplicationObjects(db);
    if (!applied.length && populated && !options.baselineThrough) {
      throw new Error('Untracked nonempty application database: verify its history and use --baseline-through with an exact filename');
    }
    if (options.baselineThrough && !populated && !applied.length) throw new Error('Cannot baseline an empty application database; apply its migrations instead');
    const baseline = options.baselineThrough ? pending.filter((m) => m.filename <= options.baselineThrough) : [];
    const result = { applied: [], baselined: [], pending: pending.filter((m) => !options.baselineThrough || m.filename > options.baselineThrough).map((m) => m.filename), dryRun: Boolean(options.dryRun) };
    if (options.dryRun) return result;
    if (options.baselineThrough) {
      await transaction(db, async () => {
        await createLedger(db);
        for (const file of baseline) {
          await db.query(`insert into ${LEDGER}(filename,sha256,baselined) values($1,$2,true)`, [file.filename, file.sha256]);
        }
      });
      result.baselined = baseline.map((m) => m.filename);
      result.pending = pending.filter((m) => m.filename > options.baselineThrough).map((m) => m.filename);
      return result;
    }
    // The ledger bootstrap is transactional too. Each migration commits its
    // schema/data changes and checksum row together, with the session lock held.
    if (!applied.length) await transaction(db, () => createLedger(db));
    for (const file of pending) {
      await transaction(db, async () => {
        await db.exec(file.sql);
        await db.query(`insert into ${LEDGER}(filename,sha256) values($1,$2)`, [file.filename, file.sha256]);
      });
      result.applied.push(file.filename);
    }
    result.pending = [];
    return result;
  } finally {
    if (readOnly) await db.exec('rollback');
    if (locked) await db.query(`select pg_advisory_unlock(${LOCK})`);
  }
}

/** @param {string[]} args @returns {RunOptions & {help?:boolean}} */
export function parseArguments(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run' && !options.dryRun) options.dryRun = true;
    else if (args[i] === '--baseline-through' && !options.baselineThrough) {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error('--baseline-through requires an exact full filename');
      options.baselineThrough = args[++i];
    } else if (args[i] === '--help' && !options.help) options.help = true;
    else throw new Error(`Unknown or repeated argument: ${args[i]}. Seeding is never part of this runner.`);
  }
  return options;
}

/** @param {string} connectionString @param {Record<string,string|undefined>} env */
export function databaseOptions(connectionString, env = {}) {
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('SUPABASE_DB_URL must use postgres:// or postgresql://');
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new Error('Global TLS verification bypass is not allowed');
  const mode = env.SUPABASE_DB_SSL ?? 'verify';
  if (!['verify','disable'].includes(mode)) throw new Error('SUPABASE_DB_SSL must be verify or disable');
  if (['host','hostaddr','port'].some((name) => url.searchParams.has(name))) throw new Error('Connection host/port query overrides are not allowed');
  const local = ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if (mode === 'disable' && !local) throw new Error('Disabling TLS is permitted only for an explicit loopback database URL');
  // node-postgres connection-string SSL parameters override the supplied ssl
  // object. Remove verified modes and reject bypasses before building its config.
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith('ssl')) {
      const value = url.searchParams.get(key);
      if (key !== 'sslmode' || !['require','verify-ca','verify-full'].includes(value ?? '')) {
        throw new Error('Use verified TLS defaults and SUPABASE_DB_CA_FILE; URL SSL overrides are not allowed');
      }
      url.searchParams.delete(key);
    }
  }
  return {
    connectionString: url.toString(),
    ssl: mode === 'disable' ? false : { rejectUnauthorized: true, ...(env.SUPABASE_DB_CA_CERT ? { ca: env.SUPABASE_DB_CA_CERT } : {}) },
    connectionTimeoutMillis: 15000,
    application_name: 'eastcoastlabs-migration-runner',
  };
}
