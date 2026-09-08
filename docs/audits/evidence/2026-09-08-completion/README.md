# Completion verification evidence

The controller ran these commands in the isolated audit-implementation worktree using Node 22.23.1 / npm 10.9.8 and the locked dependencies. `commands.ndjson` records each command, start/end time and exit code. Application and provider credentials were explicitly empty; no local application env files were present. These logs do not represent production writes, a real customer-data backup, live provider sends or signed-in staging acceptance.

- `install.txt`, `npm-audit.json`: locked install and all dependency severities reported by npm.
- `tests.txt`, `typecheck.txt`, `lint.txt`: complete regression suite and static checks.
- `build.txt`: Next 15.5.25 production build, using `.next-verify`.
- `postgres.txt`: disposable PostgreSQL 17, independent sessions and custom-format restore of every fixture public/storage table.
- `schema.txt`: reuse of the earlier read-only production public schema/grants dump, restored locally without records. The verification run did not reconnect to production or read credential files. Only its digest/results are retained here; the raw schema copy is excluded.
- `browser.txt`: actual checkout/cart components with fake server actions at 320, 390 and 1280 pixels; external hosts blocked. No signed-in admin or live-provider session.
- `headers.txt`: actual production server on an owned loopback port; nine private route status/header checks, then server shutdown.
- `budgets.txt`: sum of compressed unique route and ancestor-layout JavaScript. This differs from Next's printed first-load estimate.

Install completed with an ESLint 9.39.5 unsupported-version deprecation warning. Build completed with two webpack cache serialization advisories for 108/259 KiB strings. Neither is a failed check or a measured production performance regression. Vitest's worker-reuse suggestion is informational; isolation was retained for database/provider tests. No dependency vulnerabilities were reported at this run.

The completion report records the final review gate and any scoped fixes after the integrated run. Existing initial-audit logs in the sibling 2026-09-08-verification directory are historical evidence, not replaced by this run.

Integrated application checks ran at `f3c1e70`. After the SQL-only public certificate URL fix at `12091e3`, the controller reran all 380 tests, native database/restore verification and actual-schema replay; all passed. Build, browser, header and budget inputs were unchanged by that two-file migration/test fix. Root-owned CI/header/native modules present in these runs are included in the following integration commit.
