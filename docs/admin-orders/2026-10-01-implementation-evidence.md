# Admin orders workspace — implementation and release evidence

Implemented locally on `codex/admin-orders-workspace`. The orders page now provides task views, server-backed search/filter/sort, configurable table columns, responsive cards, an order preview drawer, reviewed payment actions, page-scoped bulk actions, and selected-batch packing. Existing payment, inventory, refunds, lot allocation, shipping, audit and email mutations remain authoritative.

Nothing was merged, pushed, deployed, or migrated to a remote database. Three minor UI deviations and two outstanding acceptance gates are listed below.

## Exact revision and location

- Tested application/test commit: **`1f706bffc2f0f4e26e7ed5f7a2ea15eb3bfb13d3`**.
- Starting commit: `255d4e988e3c7006ea6e6dbd7c72084b6482df91` on `codex/shipping-method-clarity`.
- Worktree: `/Users/shanakajayakody/eastcoastlabs/.worktrees/admin-orders-workspace`.
- [Implementation plan and execution ledger](../superpowers/plans/2026-10-01-admin-orders-ux-ui-sol-handoff.md).
- Additive migration: [20261001100000_admin_order_workspace.sql](../../storefront/supabase/migrations/20261001100000_admin_order_workspace.sql).
- Review the implementation with `git diff 255d4e988e3c7006ea6e6dbd7c72084b6482df91..1f706bffc2f0f4e26e7ed5f7a2ea15eb3bfb13d3` from this worktree. Subsequent handoff commits contain documentation and refreshed synthetic screenshots only.

The original checkout and its unrelated untracked design studies remain available. The new implementation is in the isolated worktree above.

## Behavior delivered

| Area | Result |
| --- | --- |
| Work views | To fulfil, Awaiting payment, Needs attention, Shipped and All orders, with the remaining statuses in More views. Counts use the current filter population. |
| Search and filtering | Literal order/customer/item/reference search across historical items; Sydney placement dates, discount and shipping filters; stable sorting, 25-order pages, URL state and consistent export scope. |
| Scannable facts | Shipping service, historical product/size identity, separate payment and fulfilment labels, honest elapsed time, objective issues, purchased lines and frozen physical-unit totals. Missing physical claims stay unavailable. |
| Personal layout | Reorder/hide optional columns, density, and up to ten named personal views. Stored preferences are per admin and structural; search text, order data and selection are excluded. |
| Preview | Native dialog with full address, item details, Sydney milestone timestamps, internal notes/activity, page neighbors, safe return links, retry/discard/pending states and focus restoration. Non-finite dates display unavailable. |
| Payment and bulk | Existing actions with review steps and duplicate-submit protection. Only current-page eligible orders participate. Successes leave selection; failures remain actionable across refresh. Old session-stored failure data is removed when accessible. |
| Packing | At most 25 explicitly selected IDs, preserved order, changed/missing entries skipped explicitly, and a final return to the supplied orders context. Existing global packing links remain supported. |
| Security and reads | Admin authorization before route reads; private/no-store JSON and CSV; fixed-path service-only SQL functions; validated RPC payloads; shared SQL scope for rows/counts/export; more than 20,000 export matches produces a useful error. |

Main implementation paths are `storefront/components/admin/OrdersWorkspace.tsx`, the adjacent workspace components, `storefront/lib/admin/order-workspace/`, and `storefront/app/admin/(dashboard)/orders/`. The previous unused table/filter components were removed after their tests were migrated.

## Verification

Run commands from `storefront/` in the implementation worktree. The final checks below cover the code in `1f706bf`; the browser/typecheck runs immediately before that commit used the identical source tree.

| Command | Observed result | Scope |
| --- | --- | --- |
| `npm test` | **195 files, 1,202 tests passed**, exit 0 | Unit, component, route-boundary and PGlite suites, including existing commerce regressions. |
| `npm run typecheck` | Passed, exit 0 | Final nullable timestamp and component interfaces. |
| `npm run lint` | Passed with no warnings, exit 0 | Repository ESLint configuration. |
| `npm run build` | Passed, exit 0 | Next production build. |
| `PREVIEW_PORT=4197 npm run test:browser -- tests/browser/orders-workspace.spec.ts --workers=3` | **29 passed, 4 skipped**, exit 0 | Actual production components in synthetic Vite fixture. The four skips avoid duplicating two desktop-only checks in the two mobile projects. |
| `npm run check:budgets` | **6/6 passed**, exit 0 | Existing route budgets; no new orders-index budget is claimed. |
| `npm run test:headers` | **9/9 passed**, exit 0 | Existing private-response checks on an owned loopback production server with app credentials cleared. Admin preview/export no-store behavior also has route unit tests. |
| `env -u ECL_TEST_PG_URL -u ECL_TEST_PG_CONTAINER npm run test:postgres` | **30/30 passed**, exit 0 | Disposable local Docker PostgreSQL, all migrations, concurrency regressions and 50-table backup/restore. |
| `git diff --check` | Passed, exit 0 | Whitespace and patch integrity. |

The pre-implementation baseline was 175 files / 1,091 passing tests. No baseline failing tests were accepted. The final unit run printed JSDOM notices for unimplemented document navigation and `scrollTo`; these were not test failures. Browser coverage exercises the real focus/history behavior available in the fixture.

[Captured verification summary](evidence/verification-results.txt) retains inspected output after temporary execution logs are removed. Individual task counts and commit boundaries are preserved in the plan ledger and [execution record](evidence/execution-ledger.md).

### Browser and visual scope

The fixture mounts the real AdminShell, workspace, table/cards, drawer, payment component and bulk bar. Its 40 synthetic orders and action/preview adapters cannot call Supabase, email or carrier services. Navigation updates the fixture URL and rerenders the actual components. The ordinary Vite config excludes the opt-in Next suite.

Verified widths: **320, 390, 768, 1280 and 1440px**. Checks cover scoped Axe WCAG A/AA rules, no horizontal document overflow, one H1, first desktop row within 360px and six ordinary rows within 900px, reduced motion, focus restoration, search continuation after debounce, sticky bulk/header separation, draft protection, request races, partial-failure retry, saved views and denied storage. A clean scoped Axe run is not a complete accessibility certification.

- [Desktop screenshot](evidence/orders-desktop.png)
- [390px mobile screenshot](evidence/orders-mobile-390.png)
- [320px drawer screenshot](evidence/orders-drawer-320.png)

All screenshots use synthetic records. Desktop/mobile layout and the narrow drawer were visually inspected. The preview can be reproduced with `PREVIEW_PORT=4197 npm run preview:audit`, then opening `http://127.0.0.1:4197/orders-workspace.html`.

### Database scope and performance limits

PGlite tests execute every migration, actual role-denied calls, frozen multi-pool quantity arithmetic, independent refund settlement totals, a fourth-item search, combined scope/count/export assertions, over-1,000-order pagination, oversized export rejection, DST elapsed time and deterministic UUID ties. Non-finite placement/payment/shipment values are tested from SQL output through the runtime decoder, with unknown-last sorting and unavailable values in the drawer.

The final 10,000-order synthetic PGlite sample took approximately **635ms**, with temporary-buffer use. This sample has no item-heavy workload and is not a production latency estimate. [Query plan](evidence/workspace-query-plan.json) and [item lookup plan](evidence/workspace-item-plan.json) are preserved. The child lookup uses the existing `order_items_order_idx`; no speculative new index was added. Representative staging data, item density and production-scale timing remain release checks.

## Independent review and fixes

A fresh reviewer examined the whole branch from `255d4e9` through `2abe28c`, including the plan's Review Focus and recorded ruling. The reviewer made independent browser/database probes, found no critical issues, and reported five Important and three Minor findings. No items were declined for judgment. The five Important findings were fixed in one pass in `1f706bf`; the full suite then passed 1,202/1,202.

| Important finding | Regression evidence and correction |
| --- | --- |
| Search remount lost focus after the 300ms debounce | Component and browser continued-typing tests failed first. Toolbar identity is stable; applied URL state is synchronized without erasing a newer draft. |
| Payment success appeared on the next unpaid order | Component and browser Next-after-payment tests failed first. Mutation feedback now carries the affected order ID, and the drawer emits one success notice. |
| PostgreSQL infinity broke the result page/export | Actual SQL-to-decoder test failed first. Non-finite values normalize to null, invalid timing stays flagged, unknowns sort last, and date-filtered searches exclude unavailable placement dates. |
| Legacy customer-bearing failure storage survived | Session-storage cleanup tests failed first, including unavailable local preference storage. Cleanup targets the original session key independently. |
| Preview omitted payment/shipment milestones | Missing-milestone render test failed first. The drawer now shows placement, payment and shipment records in Sydney time, including explicit unavailable values. |

Browser acceptance earlier also found and fixed a mobile saved-view popover extending beyond the viewport and a sticky bulk bar covering sort headers. Those scenarios remain covered.

### Deferred minors

1. Payment cells show the payment/refund state and reference but omit the available payment method.
2. A separately labelled **Search all orders** control is absent. Choosing **All orders** already preserves the current query.
3. The Paid and Processing views default to waiting time; the design specifies newest placement. Operators can select Date placed explicitly.

These are recorded deviations, not claims of full design parity. They were retained as Minor findings under the execution workflow's review policy.

### Ruling made during execution

Client-safe date validation was kept in the parameter layer without importing `order-queries`, which imports server database code. The server continues using the established Sydney day-boundary helper. **Cost if wrong:** client/server date-boundary drift; DST and exact filter-argument tests cover that risk.

## Outstanding acceptance gates

1. **Authenticated real Next suite: NOT RUN.** The config refused to start because `ECL_ADMIN_ORDERS_BASE_URL` and `ECL_ADMIN_ORDERS_STORAGE_STATE` were not supplied. The Vite fixture and mocked route tests do not prove real App Router history, server refresh retention, deployed authentication or full-order/batch navigation. The opt-in spec exists for those checks.
2. **Native browser zoom at 200%: NOT RUN.** Automated CSS zoom reflow passed; it is not equivalent to a native browser zoom check. Complete native zoom and a manual keyboard pass before release.

For the real Next gate, supply a disposable local or dedicated `ecl-admin-orders-test*.vercel.app` target with the migration applied, a test-admin storage-state file, and `ECL_ADMIN_ORDERS_TEST_ORDER_ID` for a synthetic pending order. Supply two paid synthetic IDs in `ECL_ADMIN_ORDERS_TEST_BATCH_IDS` for packing navigation. The config rejects production/unrecognized hosts and URL credentials. Run:

```sh
npx playwright test --config playwright.admin-orders.config.ts
```

The mutation case additionally requires `ECL_ADMIN_ORDERS_ALLOW_MUTATIONS=disposable` and authorization for that environment. Keep test identity/provider/email data synthetic and configure outbound integrations accordingly. No authentication bypass was added. Missing IDs otherwise skip cases; inspect the final count before calling this gate passed.

## Release checklist — prepared, not executed

1. Identify the deployment revision containing `1f706bf` and review the recorded minor deviations. Verify the database's existing migration history before applying anything.
2. In the safe test environment, apply `20261001100000_admin_order_workspace.sql` through the existing migration workflow **before** running the matching application revision. The page depends on the new RPCs.
3. Confirm all five `admin_order_workspace*` functions have fixed search paths; PUBLIC, anon and authenticated cannot execute them; service_role can. Exercise list, single-order facts and export shapes with the service-role test harness. Do not expose that key in a browser.
4. Run the real Next gate above and native zoom/manual keyboard checks. On representative staging data, measure combined filters, counts and exports with realistic line-item/claim density. Check deployment response limits and latency for a large allowed export; 20,000 is a row cap, not a proven hosting payload allowance.
5. Obtain user authorization for the concrete production migration/deployment. Then apply the tested additive migration first and deploy the approved application revision. This handoff does not authorize those external actions.
6. Smoke-test read-only default/legacy views, literal search, Sydney date filters, counts, sorting/pagination, matching CSV, preview, direct order link, full-order return link and selected-batch navigation. Confirm non-admin reads are denied and private responses are not cached.
7. Any production payment, refund, stock, packing, dispatch or email mutation tests require separately authorized disposable orders. Existing automated checks do not justify mutating real customer orders as a smoke test.

## Rollback

Redeploy the prior application revision first if the new workspace needs rollback. Leave the additive read-only functions in place initially: they neither mutate commerce records nor change existing mutation signatures. Do not drop them while any application revision still references them. No commerce-data rollback is introduced by this feature; any separately performed operational mutation remains an ordinary audited commerce action.

The branch and worktree are preserved for review. Temporary plan-execution scratch data can be removed after this evidence, final task ledger and fixes are committed.
