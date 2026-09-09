# East Coast Labs audit implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement and review bounded tasks. The user approved the audit design and phased implementation on 8 September; continue without repeating approval requests for authorised, reversible implementation.

**Goal:** Implement the actionable frontend/admin audit repairs with isolated regression coverage and a reviewable migration/deployment path.

**Architecture:** Keep Next.js/Supabase and existing screens. Share authoritative cart/quote, transactional commerce, scoped order access and durable email contracts. Extend current admin tools; do not replace the application.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase/PostgreSQL, Tailwind 4, Vitest/Testing Library, isolated PGlite PostgreSQL tests.

**Spec:** `docs/audits/2026-09-07/AUDIT_AND_OPTIMISATION_PLAN.md` and its three findings appendices.

## Global constraints

- Work only in `/Users/shanakajayakody/eastcoastlabs/.worktrees/audit-implementation` on `codex/audit-implementation`.
- Never use production credentials/database/orders or send real email in tests. Use local fixtures and fake provider boundaries. Docker is unavailable; PGlite provides real PostgreSQL semantics but cannot prove independent-session locking under load.
- Do not invent business identity, scientific evidence, policies, metrics or test results. Missing certificates must produce an honest unavailable state. Remove unsupported recurring promises; a new recurring platform is optional separate scope in the accepted audit.
- Retain integer-cents pricing, Australian shipping/bank-transfer flows, allowlist auth, existing inventory pools and frozen sales COGS.
- No pushes, production migration application or deployment during implementation. Prepare migrations, verification and rollout instructions for review.
- Own assigned files; coordinate shared interfaces through the controller. Do not stage/commit while another worker edits. Controller creates review packages and commits reviewed batches.
- Write failing behaviour tests for meaningful business changes, run them, implement, then rerun. Visual/copy-only fixes earn manual/browser checks rather than source-string tests.

## Task map and ownership

| Task | Owner | Files | Observable result |
|---|---|---|---|
| 1. Isolated test/lint/build foundation | Controller | package/config/tests setup, CI | Vitest cannot contact production; build/type/lint are unattended commands |
| 2. Receipt/payment access | Controller | lib/order-access.ts; pay, thank-you, payment poller, email payment links; privacy migration | Display numbers/raw IDs alone return no order data; valid scoped token works |
| 3. Commerce integrity | Commerce worker | lib/admin/orders.ts, lib/checkout.ts, new commerce modules, commerce migration, tests/commerce | Transactional create/transition/refund; idempotent retries; correct partial/full stock and discount refunds |
| 4. Storefront correctness/accessibility | Storefront worker | components public except receipt/poller; catalog/stacks/coa, store pages except checkout/actions/pay/receipt/reviews; SEO/content | Responsive accessible checkout, consistent prices/copy/stock, honest COAs, no unsupported subscription |
| 5. Admin daily operations | Admin worker | components/admin, app/admin, admin product/settings/people/recovery/slip libraries (not orders.ts/email.ts) | Preserved drafts; dependable bulk results/tracking/print; validated transactional settings/product writes; complete paging |
| 6. Checkout orchestration/instrumentation | Controller after interfaces agreed | app/(store)/checkout/actions.ts, analytics consumers | Stable attempt ID, resolved/versioned quote, secure payment URL; no stale/unreviewed quote submit |
| 7. Outbox/consent/job health | Controller | lib/email/sender.ts, lib/admin/email.ts, cron/subscribe/unsubscribe/webhook routes, outbox migration | Claimed/idempotent sends, fresh eligibility, backoff/dead-letter, fail-closed jobs |
| 8. Data/fulfilment extensions | Workers after core review | Scoped follow-up plan against remaining audit items | Correct cohort/pagination; lot allocation and receipt valuation if core interfaces ready |
| 9. Migration/dependency/observability hardening | Controller | migration runner, unique migration identities, config, README/runbook | Tracked migrations do not replay seeds; compatible patches; health/error budgets |
| 10. Integrated verification and code review | Controller + independent reviewers | test suite, build, browser, diff/report | Reviewed changes, reproducible test results, honest unresolved external requirements |

## Task 1 — verification foundation

- [x] Install Vitest, Testing Library/jsdom, PGlite and compatible ESLint tooling in the isolated workspace.
- [x] Configure `@` alias and a test-only `server-only` stub. Clear service/provider variables and fail any unexpected remote fetch from tests.
- [x] Configure scripts `test`, `typecheck`, `lint`; keep framework production build.
- [x] Use real behaviour fixtures and PGlite migrations for business operations. For route tests mock the database boundary, never the authorization function under test.

## Task 2 — scoped access

- [x] Add failing tests: correct signed token returns matching ID; missing/wrong/expired/tampered/wrong-scope token returns null; signing is unavailable without a server secret; invalid access never invokes order lookup.
- [x] Add `createOrderAccessToken(orderId, scope, options?)`, `verifyOrderAccessToken(token, scope, options?)` and `paymentPath(orderId)` in a server-only module. Use HMAC SHA-256 with an explicit domain separator and timing-safe verification, finite expiry and canonical UUID parsing. Prefer ORDER_ACCESS_SECRET; a domain-separated derivation from existing service-role secret avoids unsafe deployment defaults.
- [x] Require token bound to order ID on payment page/poller. Redirect successful checkout directly to tokenised payment page. Thank-you with display number alone shows no private data.
- [x] Issue tokenised links in payment email templates; do not embed email addresses in URLs. Add private/no-store/referrer controls.
- [x] Restrict public reviews to an explicit safe column projection while keeping admin access.

## Task 3 — commerce contracts

Create RPCs for complete order creation and legal state/refund transitions using locked order/pool rows, operation identities and durable events. Validate before writes; total order/items/payment expiry/reservations must be all-or-nothing. Keep exported order-service interfaces compatible where possible; new optional inputs include `idempotencyKey`, `paymentExpiryHours` and expected quote information. Report exact interfaces to controller before action/UI integration.

Regression fixtures must cover: repeated same checkout; failure during item insert rolls back; paid twice; cancel/payment race invariants; three units partially returned one then fully returned two; order-level discount allocation and shipping; original line quantities versus remaining shippable quantities; inactive parent/variant from a saved cart. Derive expected cents/units by hand. New SQL may call existing inventory triggers; do not double-settle pack pool units.

## Task 4 — storefront

Use an explicit mobile grid with zero-minimum flexible tracks, visible field labels and accessible error state. Quote requests must clear stale readiness; ignore obsolete responses; retry visibly. Controller will expose authoritative `CartQuote.lines`, `version` and successful `paymentUrl`. Add stable per-attempt UUID and submit `quoteVersion` once available. Keep dirty contact input on failures. Cart line destination must be type-aware and storage validated/synchronised.

Remove subscribe selection and server-label discounts (coordinate commerce). Make active DB copy/SEO/prices primary; bundles derive current single cents. Inactive/empty catalogue must not silently resurrect offers. Hero COA must match product; only valid published document links can count as proof; no CSV fallback in production. Fix sitemap/canonicals and truthful placeholders/dispatch/payment copy. Use shared modal primitives, no offscreen tab targets; transaction routes exclude exit intent. Manually check narrow viewport and keyboard path.

## Task 5 — admin

Preserve dirty fields across image/stock refresh, protect internal navigation, reconcile version conflicts. Save product/settings changes atomically after finite/bounded validation; settings support/contact must reach public surfaces. Correct print quantities to match packing. Full refund/cancel require a clear record-only confirmation, optional physical return behaviour if server supports it, and valid source-status actions. Keep per-ID bulk failures and selection. Add audited tracking correction. Replace capped/in-memory People filtering with complete/stably paginated reads; reconcile recovery date controls and paid/net metrics. Preserve existing role checks on every mutation.

Regression fixtures: dirty description survives media/stock refresh; failed middle update commits nothing; print omits refunded units; pending order lacks invalid refund action; mixed five-order bulk batch retains two failures; search/export beyond 1,000 records; date/tab state persists; unpaid order contributes zero recovered paid revenue. Communicate required SQL schemas/RPCs and reserve distinct migration timestamp filenames.

## Task 6 — checkout integration

Controller coordinates `ClientCartLine`, `CartQuote` and create-order changes after worker interfaces settle. Quote includes authoritative paid/gift lines and a signed/canonical hash of resolved amounts and inventory-relevant identity. On final reprice mismatch, return changed quote without mutation; no ignored disappearance. Idempotent replay must return the same secure payment URL. Payment instructions enqueue is durable and provider delivery does not block checkout. Mark order-created and paid purchase separately; dedupe client purchase by transaction and avoid PII.

## Task 7 — outbox and consent

Add claim/lease/attempt/next-attempt/dead-letter fields, unique dispatch identity and SQL claim/finish functions. Drain due rows with SKIP LOCKED semantics; stable Resend idempotency key. Before each marketing send, check current suppression and workflow pause/cancel; transactional templates have an explicit exemption list. Retired templates are cancelled terminally. Provider success followed by persistence failure must surface; stable provider idempotency limits retries. Public subscription cannot clear an opt-out without mailbox confirmation; bound sources/input. Fail closed on missing cron secret and model job freshness per real schedule. Test with fake provider and local DB only.

## Task 9 — deployment guardrails

Use migration history/checksums; explicit baseline command for an existing DB rather than replaying old seeds. Resolve duplicate historical timestamp compatibility without silently rewriting applied migrations. Set project tracing root, document file inclusion and production env requirements, and update obsolete Woo documentation. Patch dependencies within tested supported ranges; major changes require their own compatibility verification. Prepare a rollout/recovery checklist and explicit external-input list.

## Review and release criteria

- [x] Each implementation reports tests actually run and self-review findings.
- [x] Review scoped diffs independently, fix important findings and re-review amended scope.
- [x] Run integrated tests/typecheck/lint/build once workers finish, then only repeat checks affected by fixes.
- [x] Browser-check narrow checkout, product/cart and available admin fixtures without production writes.
- [x] Record each audit finding as implemented, awaiting external evidence/configuration, optional experiment or unresolved with reason. Do not call the whole programme complete while actionable items are silently omitted.

## Preflight interface review

| Pair/task | Interface | Ruling |
|---|---|---|
| Commerce ↔ frontend | Cart resolution and stock types | Commerce owns resolver; frontend owns displays. Announce any new field/signature before integration. |
| Commerce ↔ controller | createOrder + checkout actions | Controller owns actions. Add optional compatible inputs first; controller removes redundant payment-plan write after atomic creation is verified. |
| Commerce ↔ admin | transition/refund/tracking | Commerce owns core services. Admin requests signatures and uses typed result, no parallel edits to orders.ts. |
| Admin ↔ frontend | catalog/settings content | Frontend owns catalog/COA; admin owns product persistence. Preserve DB shape or coordinate additive changes. |
| Outbox ↔ commerce | durable email enqueue | Controller owns sender/email seam. SQL events/outbox intent must be transactionally inserted; no network call in transaction. |
| Migration authors | migration order | Commerce prefix 20260908100000, admin 20260908110000, controller privacy 20260908090000, outbox 20260908120000. |
| All tasks | source scope and tests | No live mutations, credentials or invented certificates; targeted tests and manual QA. User-approved audit is the architectural spec. |

Ruling: use an ignored project-local worktree and isolate all tests from production; existing audit approval covers implementation design, so no repeated design approval is required. Cost if wrong: reversible local rework; deployment remains a separate concrete review step.

## Delivery outcome

Core authorised repairs are implemented and locally verified. Detailed finding status, explicit partial/optional/external scope and final evidence live in `docs/audits/2026-09-08-IMPLEMENTATION.md`. Production release is not executed; database staging/concurrency, operator QA, genuine evidence and account configuration are release gates. Browser checks cover public synthetic components; admin remains code based per user choice. No claim that the optional full programme or measured conversion/efficiency targets are complete.
