# Audit Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Use one implementation worker at a time; the controller may independently own release verification.

**Goal:** Complete the remaining repository-owned storefront/admin improvements and produce verified release readiness.
**Architecture:** Privileged transactions own money, stock and delivery decisions. Small server-action adapters and accessible UI expose explicit operator/customer intent. Isolated fixtures verify the complete migration chain and observable behaviour.
**Tech Stack:** Next 15, React 19, TypeScript, Supabase PostgreSQL, Vitest, npm/Node 22.
**Spec:** `docs/superpowers/specs/2026-09-08-audit-completion.md`

## Global Constraints
- Work only in the audit-implementation worktree; do not mutate production data, send customer messages, or publish without a concrete reviewed release.
- Preserve existing checkout idempotency, price/stock authority, narrow access tokens, consent, delivery identity, and refund invariants.
- Database changes are new forward migrations; privileged functions deny anon/authenticated execution unless explicitly public-safe.
- Refunds are accounting records; settlement records describe a transfer an operator has already made and never initiate payment.
- Lot allocation requires operator evidence. Never infer an order's batch from a product's newest certificate or invent certificates, legal identity, or policies.
- Existing fake-provider/PGlite tests remain isolated. Native PostgreSQL verification uses disposable synthetic databases only.
- Never persist checkout contact/address fields in browser storage or automatically enrol a customer into recovery or marketing.

### Task 1: Refund preview and settlement
**Files:** new `storefront/supabase/migrations/20260908180000_refund_workflow.sql`, `lib/admin/refunds.ts`, order `refund-actions.ts`, `components/admin/RefundSettlements.tsx`; modify OrderItemsPanel, OrderActions, order detail page; test `tests/admin/refund-workflow.test.ts` and UI tests.
**Interfaces:** quote accepts order ID, selected item quantities or full remainder and restock flag; returns opaque state token and exact item/discount/shipping/total cents. Commit takes identical selection/token/idempotency key and rejects stale state atomically. Existing commerce operation remains canonical. Settlement takes order, cents, reference, transfer date, idempotency key, actor and cannot exceed cumulative refunds.
- [ ] Write failing SQL tests: `expect(commit(staleQuote)).rejects.toThrow(); expect(await totalSettled()).toBe(refundedCents)` after concurrent/replayed requests; include discounted partial/final refunds, shipping once, restock false, grants.
- [ ] Add SQL quote/commit/ledger with order locks and immutable audit evidence, server wrappers and UI previews/errors. Both full and partial refunds must use previews.
- [ ] Run targeted SQL/UI tests and typecheck, inspect diff, record evidence and commit only owned files. Review before next worker task.

### Task 2: Lot packing and carrier reconciliation
**Files:** new migration `20260908190000_fulfilment_workflows.sql`, `lib/admin/fulfilment.ts`, `lib/admin/carrier-csv.ts`, new fulfilment actions/components; order/slip integration and focused tests.
**Interfaces:** lot register/allocate under deterministic locks; quantities limited by lot receipts and remaining packable order quantity, variants mapped explicitly to physical pool. Print actual assigned lot/verified certificate, retain honest unallocated quantities. CSV columns `order_number,tracking_number`; preview requires current shippable status and records state token; commit rechecks row state and returns per-row outcome.
- [ ] Write failing tests for concurrent lot exhaustion, refunded packing quantity, lot/product mismatch, quoted CSV/BOM/newlines/duplicate conflicts and stale tracking preview.
- [ ] Implement atomic allocation plus guarded release/reallocation, printable assignments and CSV upload/preview/commit UI using existing status/tracking operations and optional notification intent.
- [ ] Run focused tests/typecheck, report and commit owned files. Review before next task.

### Task 3: Checkout identity, field errors and explicit recovery
**Files:** structured cart types/provider/resolver/add-to-cart callsites; checkout actions/form; new recovery consent migration `20260908200000_cart_recovery_consent.sql`, recovery module/actions/confirmation restore routes, tests.
**Interfaces:** optional variantId on legacy cart, preferred exact variant lookup with compatibility fallback only for absent ID. Field errors keyed to named checkout controls; aggregate errors remain. Recovery request purpose separate from marketing, mailbox proof, short-lived opaque hash-stored tokens, no raw browser contact storage; immutable episodes only after explicit intent and no resubscribe from old links.
- [ ] Write failing tests for legacy/new carts, inactive/mismatched IDs, invalid-field focus, explicit request/confirm/expiry/replay, suppression and restore token privacy.
- [ ] Implement consent UI and token lifecycle integrated with existing outbox/episodes; account for private page exclusion and make repeat confirmation harmless.
- [ ] Run focused tests/typecheck, report and commit owned files. Review before next task.

### Task 4: Admin automation, financial telemetry and atomic utilities
**Files:** new migration `20260908210000_operations_completion.sql`, automation actions/panel, analytics modules/tests, legacy product create/launch adapters/tests.
**Interfaces:** cancellation cannot override provider in-flight state; retry preserves frozen body/provider identity, allowed only within known safe provider dedupe window or never attempted; ambiguous delivery exposes reconciliation instead. Immutable refund analytics events use actual incremental refund cents and original client/transaction identity; no customer PII. Product create/launch bundle changes transactional.
- [ ] Write failing tests for dead/retry timing, active leases, duplicate provider delivery, refund delta replay and transactional product failure.
- [ ] Implement narrow guarded controls and atomic utilities using existing outbox/commerce helpers; update operational documentation.
- [ ] Run focused tests/typecheck, report and commit owned files. Review before integration.

### Task 5: Independent release verification (controller-owned)
**Files:** native PG and browser fixture verification scripts/tests, `.github/workflows/ci.yml`, package scripts/dependencies, budget/monitoring configuration, `storefront/docs/AUDIT-RELEASE.md`, final completion report.
**Interfaces:** PG tests use an explicit disposable loopback URL and synthetic fixtures; CI supplies PostgreSQL service. Browser tests use existing component fixture harness/fake actions. Route budgets parse actual Next build artifacts and fail on configured growth; health probes never send email/orders.
- [ ] Establish local disposable PG, migrate complete history, race checkout/refund/outbox with separate sessions and restore a backup to a second disposable database.
- [ ] Add reusable CI browser/a11y acceptance, route budgets and checkable monitoring/release commands. Read available deployment/account metadata without printing secrets or modifying production.
- [ ] Run locked install, all tests, typecheck, lint, audit, build, native PG, budgets and browser verification. Independently review the entire branch and address material findings.
- [ ] Update reports with actual evidence, commit reviewed work, and identify only true external blockers and the exact release action pending.
