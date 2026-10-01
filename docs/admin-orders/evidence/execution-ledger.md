# SDD ledger — plan: docs/superpowers/plans/2026-10-01-admin-orders-ux-ui-sol-handoff.md

Workspace: .worktrees/admin-orders-workspace; branch codex/admin-orders-workspace; base 255d4e988e3c7006ea6e6dbd7c72084b6482df91.
Scope: execute locally, preserve commerce mutations, no production migrations or deployment.

Pre-flight shared interfaces:
- Tasks 1→2→3: normalized URL values, SQL facts and validated TypeScript DTOs; keep literal search and one scoped population.
- Tasks 1/3→4/5/6: browser-safe contracts and server-only query boundaries; do not import server query helpers into client modules.
- Tasks 3/5/6→7: drawer facts must agree with detail records; identity races handled explicitly.
- Tasks 5/6→8: page selection must be owned by workspace, not duplicated in table/cards.
- Tasks 1/8→9: batch UUIDs/return URL validated at both navigation and server route.
- Tasks 3–9→10: live list and export switch together; keep legacy tests until integration.
- Tasks 5–10→11: Vite mocks cannot prove real Next history/auth; test scopes remain separate.
- Task 12: whole-branch review and current evidence required.

Ruling: client-safe date validation will be implemented in params without importing order-queries — that module imports server database code — cost if wrong: date boundary drift, covered by DST/filter tests using the existing server boundary helper.
Task 1: in progress.
Task 1: complete (commits b8ddeda..a6193ed, tests: npm --prefix storefront test -- tests/admin/order-workspace-params.test.ts tests/admin/order-workspace-presentation.test.ts →    Duration  136ms (transform 60%, tests 18%, setup 10%, import 7%, worker 5%))
Task 2 performance: 10,000 synthetic orders completed in 605ms in PGlite; child lookup uses existing order_items_order_idx. No new index justified. Local query-plan artifact at /tmp/ecl-workspace-query-plan.json; production timings remain a release check.
Task 2: complete (commits a6193ed..6004fd6, tests: npm --prefix storefront test -- tests/admin/order-workspace-sql.test.ts tests/admin/counts.test.ts tests/admin/fulfilment-analytics-sql.test.ts tests/admin/fulfilment-workflow.test.ts →    Duration  5.50s (tests 98%, transform 2%))
Task 3: complete (commits 6004fd6..5c42b1c, tests: npm --prefix storefront test -- tests/admin/order-workspace-queries.test.ts tests/admin/order-workspace-export.test.ts tests/admin/counts.test.ts →    Duration  201ms (transform 67%, tests 14%, import 11%, setup 6%, worker 3%))
Task 4: complete (commits 5c42b1c..72903cd, tests: npm --prefix storefront test -- tests/admin/order-workspace-preferences.test.ts tests/admin/order-workspace-preferences-ui.test.tsx →    Duration  751ms (environment 54%, tests 17%, import 16%, transform 11%, setup 1%, worker 1%))
Task 5: complete (commits 72903cd..28c98e0, tests: npm --prefix storefront test -- tests/admin/order-workspace-navigation.test.tsx tests/admin/order-workspace-preferences.test.ts tests/admin/order-workspace-preferences-ui.test.tsx →    Duration  975ms (environment 57%, tests 24%, import 9%, transform 8%, setup 1%))
Task 6: complete (commits 28c98e0..5031238, tests: npm --prefix storefront test -- tests/admin/order-workspace-table.test.tsx tests/admin/order-workspace-navigation.test.tsx tests/admin/order-actions.test.tsx tests/order-email-ui.test.tsx tests/admin/order-size-visibility.test.tsx tests/admin/shipping-method-visibility.test.tsx →              at least ~393ms faster with isolate: false — reuses workers across files instead of one per file)
Task 7: complete (commits 5031238..492d525, tests: npm --prefix storefront test -- tests/admin/order-workspace-preview-route.test.ts tests/admin/order-workspace-drawer.test.tsx tests/admin/order-workspace-quick-payment.test.tsx tests/admin/operations.test.tsx tests/admin/order-actions.test.tsx tests/order-email-ui.test.tsx →              at least ~416ms faster with isolate: false — reuses workers across files instead of one per file)
Task 8: complete (commits 492d525..48462ed, tests: npm --prefix storefront test -- tests/admin/order-workspace-selection.test.tsx tests/admin/order-workspace-bulk-actions.test.tsx tests/admin/order-reinstatement.test.ts tests/admin/order-workspace-navigation.test.tsx →    Duration  1.01s (environment 46%, tests 24%, import 17%, transform 11%, setup 1%))
Task 9: complete (commits 48462ed..9b57510, tests: npm --prefix storefront test -- tests/admin/order-workspace-packing.test.ts tests/admin/order-workspace-packing-ui.test.tsx tests/admin/fulfilment-ui.test.tsx tests/admin/shipping-method-visibility.test.tsx tests/admin/packing-address.test.tsx tests/admin/order-size-visibility.test.tsx →              at least ~338ms faster with isolate: false — reuses workers across files instead of one per file)
Task 10: complete (commits 9b57510..8821301, tests: npm --prefix storefront test -- tests/admin/order-workspace-page.test.tsx tests/admin/order-workspace-export-route.test.ts tests/admin/order-workspace-route-states.test.tsx tests/admin/order-actions.test.tsx tests/order-email-ui.test.tsx tests/admin/order-workspace-navigation.test.tsx tests/admin/order-workspace-packing-route.test.tsx →              at least ~580ms faster with isolate: false — reuses workers across files instead of one per file)
Task 11: browser findings fixed RED→GREEN: mobile saved-view panel overflow; sticky selection bar covering table sort headers. Final fixture run 26 passed / 4 intentionally skipped duplicated desktop-only tests. 320,390,768,1280,1440 widths; 200% CSS zoom reflow (not native browser zoom); scoped Axe checks clean. Authenticated real Next gate not run: ECL_ADMIN_ORDERS_BASE_URL and ECL_ADMIN_ORDERS_STORAGE_STATE not supplied. Native browser zoom remains an explicit manual release check.
Task 11: complete (commits 8821301..2abe28c, tests: env PREVIEW_PORT=4197 npm --prefix storefront run test:browser -- tests/browser/orders-workspace.spec.ts --workers=3 →   26 passed (14.0s))

Final review: independent reviewer /root/final_review completed whole branch at 2abe28c. No critical findings. Five Important findings accepted for one RED→GREEN fix pass: debounced search focus, mutation notice scoped to order, non-finite dates, legacy session storage cleanup, visible milestone dates. No declined-to-judge items.
Final: minor (deferred): Payment cells omit payment method; reference and truthful payment/refund state remain visible.
Final: minor (deferred): Explicit “Search all orders” control is absent; All orders tab preserves the current query.
Final: minor (deferred): Paid/Processing views default to waiting time; design specifies newest placement. Manual sorting remains available.
Final: fixed debounced search loses focus — keeps focus and continued typing after the debounced query is applied; browser continued typing after debounce RED→GREEN, suite 1202/1202; fix commit 1f706bf.
Final: fixed unscoped payment feedback — scopes successful payment feedback to the order that was changed; browser Next after success RED→GREEN, suite 1202/1202; fix commit 1f706bf.
Final: fixed non-finite timestamps fail page/export — normalizes non-finite timestamps through SQL and the decoder, sorting unknowns last RED→GREEN, suite 1202/1202; fix commit 1f706bf.
Final: fixed legacy session failure storage persists — removes obsolete session failure persistence; denied local preference storage RED→GREEN, suite 1202/1202; fix commit 1f706bf.
Final: fixed preview omits milestone timestamps — shows absolute payment and shipping timestamps alongside placement; unavailable milestones RED→GREEN, suite 1202/1202; fix commit 1f706bf.
Final verification at 1f706bf: 195 test files/1202 tests, typecheck, lint, build, 29 browser passes/4 intentional skips, 6 budgets, 9 header checks, 30 native PostgreSQL checks all passed. Real Next and native zoom remain unverified as documented.
Task 12: complete (commits 2abe28c..f970f95, tests: python3 -c 'import subprocess; subprocess.run(["git", "diff", "--check", "255d4e988e3c7006ea6e6dbd7c72084b6482df91..HEAD"],check=True); print("Final diff check passed; full application verification at 1f706bf is preserved in the evidence document.")' → Final diff check passed; full application verification at 1f706bf is preserved in the evidence document.)

This is the preserved execution record. Original scratch logs have been summarized in verification-results.txt and the implementation evidence document. The implementation worktree is retained; only this plan's temporary execution directory is removed after commit.
