# Tracked database migrations

> Production was baselined through `20260904100000_cron_runs.sql` and upgraded through `20260908220000_application_privileges.sql` on 9 September 2026: 19 baseline entries, 14 newly applied files, zero pending at release. Do not baseline that installation again. Future runs verify recorded hashes and apply only later files.

Run migration commands from `storefront/`. The runner reads only `supabase/migrations/*.sql`; it never opens or executes `supabase/seed.sql`. Application code and pending migration SQL must be reviewed together before a release. CI runs against isolated fixtures and never applies SQL to a hosted database.

## Safety model

`ecl_migrations.schema_migrations` records the **full filename**, SHA-256 of the file's exact UTF-8 bytes, application time and whether the row was explicitly baselined. Applied files must remain present and byte-for-byte unchanged. A changed checksum, removed applied file, duplicate new timestamp, backdated insertion or top-level transaction-control command stops the run before pending SQL executes. Keep LF line endings in migration files across machines.

A dedicated direct PostgreSQL connection holds a session advisory lock for the entire write run. A competing runner fails immediately. Every migration's SQL and ledger row commit in one transaction. If a file fails, that file rolls back; earlier successfully committed migrations stay applied and are skipped on retry. Do not put `BEGIN`, `COMMIT`, `ROLLBACK`, or other top-level transaction control in migration files. Function bodies may contain normal PL/pgSQL `BEGIN`/`END`. Operations PostgreSQL forbids inside transactions, such as concurrent index creation, need a separately reviewed operational procedure.

The runner refuses an untracked database containing application-owned tables, views, sequences, functions or enums/domains in `public`. Supabase's built-in `auth`/`storage` schemas and extension-owned objects are not application migration history. This application currently owns `public`; add an explicit namespace inspection rule before introducing another application schema.

## Connection and TLS

Supply `SUPABASE_DB_URL` securely outside source control. Use the **direct connection** or a session pooler that preserves one PostgreSQL session for the run. Do not use transaction pooling: the migration lock is session-scoped and must remain on the same backend across commits.

TLS verifies the server certificate and hostname by default. If your trusted database uses a private CA, set `SUPABASE_DB_CA_FILE` to the CA PEM file. Do not disable verification or set `NODE_TLS_REJECT_UNAUTHORIZED=0`. URL TLS and host/port query overrides are rejected so they cannot silently replace the verified connection configuration. URL `sslmode=require`, `verify-ca` or `verify-full` are normalized to certificate verification.

For the hosted production project, [the published Supabase CA](../supabase/certs/README.md) is included at `supabase/certs/supabase-prod-ca-2021.crt`. Set `SUPABASE_DB_CA_FILE` to its absolute path after verifying that the connection is the intended Supabase environment. A read-only dry run succeeded with that CA and hostname verification on 8 September 2026; the certificate is public trust material, not a credential.

For a disposable database bound to loopback only, explicitly set `SUPABASE_DB_SSL=disable`; this is accepted only for `localhost`, `127.0.0.1` or `::1`. Remote hosts always require verified TLS. Never paste a credential-bearing URL into a report or commit it.

## Existing installation: establish history once

Do **not** run old migrations merely because they use `IF NOT EXISTS`: several historical files intentionally contain product or settings updates that would overwrite later admin edits. A baseline records verified history without running that SQL.

1. Take a restorable backup and inspect a disposable restored database first. Confirm which full migration files actually correspond to the existing schema and data. A baseline is an operator assertion, not automatic schema equivalence proof.
2. Choose the exact last historical filename. For the audit rollout, `20260904100000_cron_runs.sql` is the expected pre-audit boundary **only if your database has been verified through that file**; do not assume every installation matches it.
3. Preview the baseline. This lists the source hashes and uses a read-only transaction; it creates no schema or ledger:

   ```sh
   node supabase/apply.mjs --dry-run --baseline-through 20260904100000_cron_runs.sql
   ```

4. After checking those filenames/hashes against the verified installation, record the baseline:

   ```sh
   node supabase/apply.mjs --baseline-through 20260904100000_cron_runs.sql
   ```

   Baseline entries are inserted together or not at all. This command **exits without applying newer files**. Already recorded checksums are validated and are never rewritten. Baselining an empty application database is refused.
5. Inspect the pending list with `node supabase/apply.mjs --dry-run`, then apply reviewed new files with `node supabase/apply.mjs`. Match the application release and migration dependency order. The commerce migration precedes the outbox bridge.

The two immutable historical files `20260805100000_coming_soon.sql` and `20260805100000_lifecycle_marketing.sql` intentionally share a timestamp. The runner recognizes only this exact pair and records each full filename independently. Do not rename either applied file. Every new migration timestamp must be unique. Future migrations must sort after all applied filenames.

## Fresh disposable database

```sh
node supabase/apply.mjs --dry-run
node supabase/apply.mjs
```

A fresh database must provide the Supabase-owned prerequisites used by historical schema migrations (roles, auth/storage APIs, extensions). Use a local Supabase stack or a disposable restored staging database for full-schema bootstrap verification; PGlite unit fixtures deliberately supply only their bounded prerequisites.

Historical migration files include embedded initial data and data transformations; those statements execute once when their migration is first applied to a fresh database. No additional `seed.sql` is executed. Treat any separate seeding/backfill script as its own explicit reviewed operation; the runner has no `--seed` mode. The old `--no-seed` flag is obsolete and rejected to avoid ambiguous commands.

## Failure and recovery

- A checksum mismatch or missing file requires recovering the exact originally applied file from version control. Do not edit the ledger to disguise a changed migration. Write a new forward migration for a repair.
- A failing new migration is rolled back with its ledger insert. Inspect the failure on a disposable restore. Files that never committed can be corrected; already applied files stay immutable. Rerun dry-run and apply once reviewed.
- Unknown existing schema history requires investigation and an explicit baseline. Do not delete tables, erase the ledger or rerun historical seeds to bypass the guard.
- The runner's session lock is released when the connection closes. A crashed connection releases it at PostgreSQL; investigate an active competing session instead of bypassing the lock.
- Local tests prove rollback and checksum/history behavior. `npm run test:postgres` exercises the full migration chain, privileges, independent-session contention and backup restoration with synthetic data. A read-only production dry run and schema-only local replay have also been performed. Before release, verify a real production backup restore and the operator-approved baseline; neither synthetic fixtures nor a schema-only copy proves historical data equivalence.

## CI

`.github/workflows/ci.yml` runs `npm ci`, isolated unit tests and migration validation, separate-session PostgreSQL 17 checks and restore verification, browser/accessibility acceptance, dependency audit, typecheck, lint, production build and route JavaScript budgets on Node.js 22. It references the committed `storefront/package-lock.json`, has a read-only checkout token, and supplies only disposable database credentials. It does not deploy or run migrations against a hosted database. GitHub Actions execution and branch protection must be confirmed after the workflow is merged.

Run `npm run test:postgres` locally with Docker available. It creates labelled disposable PostgreSQL, migrates synthetic fixtures, tests contention, restores a backup into a second disposable database, and removes the databases and owned container on exit. It does not read project env files. CI supplies its loopback PostgreSQL service explicitly; do not point this test at an operational database.

The action pins were resolved from the documented v7 tags of [actions/checkout](https://github.com/actions/checkout) and [actions/setup-node](https://github.com/actions/setup-node). Update them through a reviewed dependency change.
