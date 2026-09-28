# Fulfilment Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved admin fulfilment dashboard with complete historical weekly/monthly reporting, order drilldowns, exports, and current queues to production.

**Architecture:** Read-only PostgreSQL functions calculate timestamp-based metrics and paginate order timing records. A server-only TypeScript boundary validates URL inputs, enforces admin access at routes, and serves typed results to focused React views. Existing order operations remain authoritative.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase PostgreSQL, existing Tailwind admin theme, Vitest/PGlite, browser acceptance fixtures.

**Spec:** `docs/superpowers/specs/2026-09-27-fulfilment-experience-design.md`

## Global Constraints

- Elapsed time only: 86,400 seconds per day; no targets or late/on-time classification.
- Australia/Sydney calendar periods, Monday-start weeks, half-open bounds.
- Payment metrics use payment date; shipping metrics use shipping date.
- Median and p90 use `percentile_cont`; monthly figures aggregate orders directly.
- Current queues cover all dates; missing durations remain unknown.
- Admin-only server access; SQL grants only to service_role; analytics never mutates orders or enqueues mail.
- Work in `.worktrees/fulfilment-experience`; preserve unrelated root-checkout edits.
- User explicitly authorized execution and live production deployment. Plan-review and publication handoffs are already authorized; proceed through verification and release.

## Review Focus

- DST/date boundaries: an order close to Sydney midnight must belong to the correct period.
- Partial/empty periods: no false improvement headline or zero-day duration.
- Missing/reversed timestamps: exclusions remain visible and drilldowns reconcile.
- More than 1,000 orders: pagination/export must not truncate or loop indefinitely.
- Admin authorization and SQL grants: unauthenticated callers must never retrieve customer timing records.

### Task 1: Read-only analytics and database verification

**Files:** Create `storefront/supabase/migrations/20260927130000_fulfilment_analytics.sql` and `storefront/tests/admin/fulfilment-analytics-sql.test.ts`.

**Interfaces:** `admin_fulfilment_report(p_grain,p_range,p_from,p_to,p_as_of)` returns report metadata, summary statistics in seconds, periods, coverage, queues and matched comparisons. `admin_fulfilment_orders(p_view,p_from,p_to,p_sort,p_dir,p_offset,p_limit,p_as_of,p_metric)` returns `{rows,total,as_of}`. Shared facts and summary helpers remain service-role-only.

- [ ] Write integration tests against all migrations in PGlite. Hand-derived fixtures assert payment/shipping date membership, median/mean/p90, refunds, invalid/missing timestamps, Sydney DST, empty periods, current queue independence, pagination over 1,000 rows, and role restrictions.
```ts
expect(report.summary.fulfilment.median).toBe(129600); // 1 and 2 elapsed days
expect(report.summary.fulfilment.p90).toBe(164160);
expect(report.queues.paid).toBe(1); // outside the selected historical range
```
- [ ] Run `npm test -- tests/admin/fulfilment-analytics-sql.test.ts`; observe missing-RPC failures.
- [ ] Implement the additive migration. Validate all enums/ranges, reject invalid chronological intervals, generate every period, and calculate matched partial-period comparison bounds in Sydney civil time.
- [ ] Rerun database tests, inspect actual values/privileges, and commit the migration and tests.

### Task 2: Typed queries, comparisons, route and exports

**Files:** Create `storefront/lib/admin/fulfilment-analytics/{types,format,queries,params}.ts`, `storefront/tests/admin/fulfilment-analytics.test.ts`, and `/app/admin/(dashboard)/fulfilment/{page.tsx,loading.tsx,error.tsx,export/route.ts}`.

**Interfaces:** `parseFulfilmentParams(raw)` returns normalized view/grain/range/statistic/sort/pagination/filter parameters. `getFulfilmentReport(params)` and `getFulfilmentOrders(params,asOf)` consume Task 1. `duration(seconds)` formats nonnegative intervals; comparison helpers expose unavailable/zero-baseline/small-sample states. Export batches reuse exactly the order RPC and fixed report time.

- [ ] Write tests for URL normalization, invalid dates, leap days, duration precision, complete-period comparison adjacency, zero baselines, export pagination and formula escaping, RPC failure handling, and route access denial.
```ts
expect(duration(129660)).toBe('1d 12h 1m');
expect(duration(null)).toBe('—');
expect(parseFulfilmentParams({grain:'invalid'}).grain).toBe('week');
```
- [ ] Run the focused tests to observe the missing-module failures, implement the typed boundary/routes, and run to green.
- [ ] Verify exports contain raw timestamps/seconds and filter metadata; reject incomplete exports rather than return truncated success. Commit Task 2.

### Task 3: Admin interface and interaction verification

**Files:** Create `storefront/components/admin/fulfilment/{FulfilmentDashboard,TrendCharts,OrderTimings}.tsx`, fixture HTML/TSX under `storefront/tests/preview`, and UI tests under `storefront/tests/admin`. Modify `storefront/lib/admin/nav.ts`.

**Interfaces:** Dashboard takes Task 2's typed report/params/order page. All navigation preserves applicable filters. Three aligned trend panels use aggregate period data; period links select contributing orders. Details use the paginated order rows; operational actions link to existing order pages.

- [ ] Write component tests for unknown durations, complete-period comparisons, independent current queues, timelines, and period/filter navigation; observe failures before component code.
- [ ] Build the approved admin design: Overview, Trends, Order timings; range/grain/statistic/comparison controls; coverage; period and order exports; refreshed-at label; retry/empty/loading states.
- [ ] Add a synthetic fixture rendering actual components, then verify all controls, touch/keyboard detail access, and mobile/desktop layout in the browser. No production credentials enter test fixtures.
- [ ] Run component tests, typecheck, and lint; commit Task 3.

### Task 4: Review, verification, and production release

**Files:** Update this plan's execution ledger and release evidence in `docs/superpowers/`.

**Interfaces:** Additive database migration must precede the application deployment; production uses the verified Git commit.

- [ ] Run the full unit/integration suite, typecheck, lint, production build, private-header checks and route budgets. Run existing disposable PostgreSQL checks where available. Inspect every result.
- [ ] Obtain the executing-plans skill's required independent whole-branch review while performing useful release preparation; fix actionable findings and rerun affected checks.
- [ ] Apply the exact tested migration through Supabase, then reconcile all-history weekly/monthly counts and timings against independent SQL. Check privileges, current queues, and data integrity with read-only queries.
- [ ] Integrate only this feature's commits into main, preserving unrelated checkout edits, and push to the existing Vercel production pipeline. Wait for the matching deployment to become ready.
- [ ] Verify the live route and export authorization, rendered admin interface if a signed-in session is available, production RPC results, and deployment commit. Record any verification limits honestly and provide the live admin link.
