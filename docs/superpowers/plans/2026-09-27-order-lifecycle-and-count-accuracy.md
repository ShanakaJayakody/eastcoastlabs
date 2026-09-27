# Order lifecycle and count accuracy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore lifecycle completion and ensure Orders tab counts match their displayed scope.

**Architecture:** Fix the JSONB argument at the lifecycle query boundary. Move status aggregation into one read-only, service-role RPC that applies the same shared scope rules as the Orders list. Release the database function before the app, then use the existing state-machine function for recovery.

**Tech Stack:** Next.js 15, TypeScript, Vitest, PostgreSQL/Supabase migrations, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-27-order-lifecycle-and-count-accuracy-design.md`

## Global Constraints

- Work on `main` because the user explicitly requested it.
- Do not alter unrelated dirty files.
- Use TDD: every production behavior change needs a test observed failing before implementation.
- Do not manually invoke the full lifecycle route or directly update production order statuses.
- Apply the production migration before application deployment, and deploy only verified code.

## Review Focus

- A date, search, and discount filter together must affect every status badge, not just list rows.
- An empty status bucket must return zero and preserve correct `all` and `to_fulfil` rollups.
- Search punctuation normalization must match the existing list query.
- A JSONB category filter must arrive as valid JSON rather than a PostgreSQL array literal.
- Completion recovery must exclude a status changed concurrently after candidate selection.

### Task 1: Repair the lifecycle JSONB category lookup

**Files:**
- Modify: `storefront/lib/admin/lifecycle.ts:89-92`
- Modify: `storefront/tests/admin/lifecycle-failures.test.ts`

**Interfaces:**
- Consumes: Supabase `.contains(column, value)` for `products.categories` JSONB.
- Produces: `accessorySlugs()` sends `JSON.stringify(["accessory"])` as the containment value.

- [ ] **Step 1: Write the failing regression test**

Capture `.contains()` calls in the lifecycle test double. Seed one review-eligible shipped order, invoke `sweepPostPurchase()`, and assert that the category lookup receives `"categories"` and `JSON.stringify(["accessory"])`.

- [ ] **Step 2: Run the regression test**

Run: `zsh -lc 'cd storefront && npm exec vitest run tests/admin/lifecycle-failures.test.ts --reporter=dot'`

Expected: FAIL because the current implementation passes a JavaScript array.

- [ ] **Step 3: Implement the minimal fix**

Change only the `.contains("categories", ...)` argument in `accessorySlugs()` to `JSON.stringify(["accessory"])`.

- [ ] **Step 4: Verify the focused test**

Run: `zsh -lc 'cd storefront && npm exec vitest run tests/admin/lifecycle-failures.test.ts --reporter=dot'`

Expected: PASS.

### Task 2: Add scoped grouped order-count RPC and consume it

**Files:**
- Create: `storefront/supabase/migrations/20260927120000_order_status_counts.sql`
- Modify: `storefront/lib/admin/order-queries.ts:75-141`
- Modify: `storefront/app/admin/(dashboard)/orders/page.tsx:62-65`
- Modify: `storefront/tests/admin/counts.test.ts`

**Interfaces:**
- Produces: `admin_order_status_counts(p_search text, p_from timestamptz, p_to timestamptz, p_discount text) returns table(status text, count bigint)`.
- Consumes: `orderStatusCounts({search, from, to, discount})` returns every known status plus `all` and `to_fulfil`.

- [ ] **Step 1: Write failing count-consumer tests**

Mock `adminDb().rpc`, assert `orderStatusCounts` passes normalized search, Sydney bounds, and normalized discount; assert sparse RPC groups produce zero-value missing statuses plus correct `all` and `to_fulfil` rollups.

- [ ] **Step 2: Run the count tests**

Run: `zsh -lc 'cd storefront && npm exec vitest run tests/admin/counts.test.ts --reporter=dot'`

Expected: FAIL because the existing implementation issues per-status table counts and has no RPC call.

- [ ] **Step 3: Add the read-only migration**

Create `admin_order_status_counts` with status grouping, the list query's current search behavior, half-open date bounds, and case-insensitive literal discount matching. Revoke public execution and grant only `service_role`.

- [ ] **Step 4: Change the query consumer and page call**

Share filter normalization between list and count reads. Use the RPC in `orderStatusCounts`; pass the Orders page's current `search`, `from`, `to`, and `discount` values into it.

- [ ] **Step 5: Verify scoped count tests and migrations**

Run: `zsh -lc 'cd storefront && npm exec vitest run tests/admin/counts.test.ts --reporter=dot && npm run test:postgres'`

Expected: PASS.

### Task 3: Release and reconcile production

**Files:**
- No new product files.

**Interfaces:**
- Consumes: `commerce_order_operation(uuid, text, jsonb)` and the new `admin_order_status_counts` RPC.
- Produces: audited `shipped` to `completed` transitions for all eligible overdue orders.

- [ ] **Step 1: Run release verification**

Run: `zsh -lc 'cd storefront && npm test && npm run typecheck && npm run lint && npm run build'`

Expected: all commands exit zero.

- [ ] **Step 2: Apply and verify the production migration**

Use the Supabase MCP to apply the exact migration before pushing `main`, because the configured Vercel project deploys `main` automatically. Query the function with a read-only aggregate scope and verify expected status groups.

- [ ] **Step 3: Commit only this plan's production files and push `main`**

Stage only the lifecycle source/test, count source/test/page, migration, and process documents. Do not stage unrelated changes. Push `main` to trigger the configured Vercel production deployment.

- [ ] **Step 4: Verify the production deployment**

Wait for Vercel deployment status, confirm the production deployment uses the pushed commit, and check its lifecycle route is configured. Do not call the lifecycle endpoint manually.

- [ ] **Step 5: Run completion-only recovery and verify**

Use Supabase MCP SQL to call `commerce_order_operation` only for `shipped` orders older than ten days. Reconcile current statuses and audit/event counts; verify no lifecycle email-outbox writes were created by the recovery.
