# East Coast Labs audit implementation — 8 September 2026

The actionable storefront, commerce, admin and automation repairs are implemented on `codex/audit-implementation`, isolated from the original checkout. This is a reviewable application/database change, not a production deployment. Remaining external requirements and optional extensions are listed explicitly below. The audit's estimated programme outcomes, including conversion and operator-efficiency gains, are not claimed as measured results.

Base source: `72e1bb7`. Worktree: `/Users/shanakajayakody/eastcoastlabs/.worktrees/audit-implementation`.

## What changes for customers and operators

Customers get a narrow-screen checkout with labelled inputs, recoverable authoritative quotes, consistent live prices and availability, and private payment/review links. An uncertain checkout can recover its original committed order even after a reload or stock exhaustion. Raw customer details are not persisted for recovery; the tab stores only an opaque attempt UUID and request hash. Unsupported recurrence and certificate/dispatch promises are removed.

Operators get preserved product drafts, atomic versioned saves, explicit recorded-refund/physical-return choices, correct packing quantities, recoverable bulk results and tracking corrections. People, recovery and review aggregates no longer depend on truncated lists. Recovery distinguishes exposure, organic orders, paid conversion and net revenue. Automation exposes delivery failures, retries and job freshness.

The database owns order/payment/stock/refund invariants and durable notification intent. Workers recheck eligibility immediately before delivery. Mailbox-confirmed consent cannot be overridden by an unauthenticated request or an older link after unsubscribe. The migration runner records immutable history instead of replaying business seeds.

## Verification

Final integrated verification on 8 September 2026:

| Check | Result |
|---|---|
| Full isolated suite | **265 tests passed across 60 files** |
| TypeScript | Passed, incremental cache disabled |
| ESLint | Passed without warnings/errors |
| Production build | Passed with isolated `.next-verify` output |
| Locked install | `npm ci --ignore-scripts` completed; production build verified installed toolchain |
| Dependency audit | **0 vulnerabilities**, including development dependencies |
| Migration chain | Complete historical/new SQL chain executes in an isolated database; public-role denial checked |
| Whitespace check | `git diff --check` passed |

Logs retain command results with terminal whitespace normalized.

[Reproducible logs](evidence/2026-09-08-verification/tests.txt), [production build](evidence/2026-09-08-verification/build.txt), [dependency audit](evidence/2026-09-08-verification/npm-audit.json).

| Initial route JavaScript | Original audit build | Implementation build |
|---|---:|---:|
| Admin product editor | 257 kB | **135 kB** |
| Home | 116 kB | 118 kB |
| Shop | 119 kB | 120 kB |
| Product | 118 kB | 120 kB |
| Checkout | 112 kB | 116 kB |

The admin product initial download is about **47% smaller**; formatting tools load when editing starts. Public routes rise by 1–4 kB with recovery/accessibility/measurement code. Those increases are reported openly against the audit's no-regression goal; no field-speed claim follows from bundle size alone. Tests use synthetic fixtures, PGlite PostgreSQL and fake providers. No real orders, customer data, email sends, analytics events or production migrations were used.

Browser evidence: [component checks and screenshots](2026-09-08-component-preview-evidence.md). Actual CheckoutForm, BuyBox, CartDrawer and Header components were exercised at 390px and 320px with zero measured overflow, keyboard focus containment/restoration, failed quotes and overlapping responses. A reload retained the recovery control without retaining contact fields; the final post-click browser result is not claimed because the browser surface disconnected. Unit tests cover that recovery result. These fixtures do not replace full Next/staging or admin operator testing.

## Storefront finding status

“Implemented” means the repair is present and locally verified; every production behaviour still requires the coupled release and staging checks.

| Audit finding | Status and resulting behaviour |
|---|---|
| F01 predictable receipt access; platform01 review UUID leak | Implemented scoped HMAC links, matching ID/scope/expiry validation, private headers and explicit safe review-column grants. Old raw-ID/display-number access is closed. |
| F02 unsupported subscribe-and-save | Implemented removal of recurrence controls and label-based discounts. A real recurring platform remains separate. |
| F03 quote failure/staleness | Implemented readiness reset, stale-response rejection, visible retry, final transaction price check and updated quote return. |
| F04 omitted items/summary mismatch | Implemented resolved summary and explicit changed-quote review. Original purchased lines persist for replay/cart completion. |
| F05 static bundle pricing | Implemented current component/variant cents for bundles, savings and checkout. |
| F06 unfulfillable packs/bundles | Implemented quantity/pack pool limits, kit dependencies and server transaction revalidation. |
| F07 unavailable offers resurrected | Implemented active parent/variant checks and empty catalogue behaviour; historical offers are not fallback inventory. |
| F08 misleading payment status | Implemented status-specific private payment page/polling and payment-before-dispatch copy. |
| F09 offscreen cart/menu keyboard targets | Implemented shared modal focus containment, Escape/restore and removal of closed controls. |
| F10 labels/errors/mobile overflow | Implemented persistent labels, linked aggregate errors/status and flexible zero-minimum columns; 320/390px checked. Field-specific server error mapping and full VoiceOver/zoom/device acceptance remain further refinement. |
| F11 intrusive capture | Implemented removal of desktop scroll trigger, silent email-blur capture and transaction/private-page popups/footer capture. New explicit recovery-acquisition UI is not included. |
| F12 missing/dropped revenue events | Implemented early-event buffering, separate order-created and optional paid purchase outbox, stable transaction identity and private-route exclusions. GA property setup, debug validation, attribution and DB reconciliation remain external. Refund analytics is not implemented; DB net revenue remains authoritative. |
| F13 cart destinations | Implemented type-aware product/stack/accessory destinations. |
| F14 storage/quantity drift | Implemented bounded stored-cart validation and multi-tab sync, server-authoritative pricing and session-only uncertain-attempt recovery. A future migration from legacy variant labels to structured variant IDs remains a design improvement. |
| F15 admin copy absent from PDP | Implemented live product description/SEO precedence and current supporting copy. |
| F16 broad/capped reads | Implemented summary/detail projections, direct slug and bounded related lookups, stable catalogue pages, request-memoized settings and SQL review aggregates with bounded review bodies. Production query latency budgets remain to be measured. |
| F17 crawl/canonical inconsistency | Implemented www metadata, sitemap, robots and JSON-LD origins, live SEO overrides and private-route noindex. Verify deployed redirects/output; richer editorial/FAQ schema is not invented. |
| F18 trust/support inconsistency | Implemented settings-driven support/shipping and removal of unsupported fixed promises/placeholder evidence. Owner must provide verified identity, policies and genuine certificates. |
| Mobile/COA/image addenda | Implemented measured layout fix, product-matched verified PDF gating and honest unavailable states. The 14 missing COA files and production image quota/billing require owner/account action. |

## Admin finding status

| Audit finding | Status and resulting behaviour |
|---|---|
| A01 non-atomic order/stock state | Implemented locked transactional creation/transitions with durable event/audit/outbox intent, durable attempt replay and injected failure coverage. Separate-session races remain a staging gate. |
| A02 duplicate returns after partial refund | Implemented returned/refunded quantities and remaining-unit logic; replay cannot restore the same units twice. Historical discrepancies need reconciliation. |
| A03 wrong refund cents | Implemented allocated order discounts, exact remaining line balance and final shipping delta. Recorded refund is distinct from sending bank funds. |
| A04 refunded units on slips | Implemented remaining pack quantities and omission of fully refunded/cancelled fulfilment. |
| A05 guessed batch/COA | Implemented exact compound matching and verified general-document labels. Dedicated stock-lot/parcel allocation is not implemented. |
| A06 queued sends ignore stop/suppression | Implemented current eligibility checks, cancellation, durable unsubscribe and pauses at dispatch. |
| A07 destructive confirmation | Implemented named-order confirmation and explicit physical restock choice; invalid pending refund action removed. |
| A08 lost drafts | Implemented draft retention across media/stock refresh and session navigation, discard protection and revision reconciliation. |
| A09 partial saves | Implemented atomic product-detail/variant-price/threshold saves and atomic settings/audit writes. This does not claim every legacy product-creation/launch utility has been rewritten. |
| A10 invalid settings | Implemented bounded numeric/payment/hold validation and settings revisions. |
| A11 capped People/counts | Implemented full SQL People projection before filtering/page/export, exact counts and stable ordering. |
| A12 misleading recovery date navigation | Implemented shared capture-date bounds for metrics/list, retained tabs/anchor and reachable older pages. |
| A13 gross/unpaid recovery revenue | Implemented immutable episodes, distinct exposures/orders/paid/net attribution; legacy rows marked unknown, organic orders not credited. |
| A14 receipt Undo cost drift | Implemented atomic weighted valuation and guarded exact receipt reversal; later stock/cost activity prevents unsafe rewind; frozen sales COGS retained. |
| A15 lost bulk failure details | Implemented per-ID outcomes/reasons and retained failed selections. Saved stock with follow-up failure returns a warning rather than a false stock failure. |
| A16 modal focus | Implemented shared containment/restore, safe cancel focus and accessible descriptions. Actual admin device/VoiceOver testing remains external. |
| A17 fulfilment correction | Implemented per-order tracking correction with optional current-state notification. Carrier integration/CSV reconciliation remain separate. |
| A18 automation workspace | Implemented read-only queue/health workspace with attempts, failures, dead rows, next attempt and lease state. Reconciliation/retry controls remain an operator procedure rather than a one-click blind resend. |

## Platform and performance

All 13 platform findings map to the repairs above or these foundations: atomic commerce (02/03), fail-closed cron auth (04), leased frozen-body outbox with bounded provider identity and exact webhook matching (05), runtime/email reservation limits plus mailbox consent (06), current suppression (07), consistent sale eligibility (08), query/aggregation improvements (09), settings/bundle authority (10), checked job errors/cadence and complete sweep reads (11), immutable migration history (12), and reproducible locked test/type/lint/audit/build CI (13).

Additional fixes found during review include expired confirmation delivery, a later unsubscribe versus older opt-in link, welcome identity mismatch, dead/sending display semantics, webhook-before-provider-ID persistence, old review URLs in queued/manual payloads, stale relative payment deadlines, and lost back-in-stock requests. Stock notification request claim and outbox insertion are atomic and use a fresh request identity; stock/consent is rechecked at delivery. A never-attempted first delivery cancelled solely for unavailable stock preserves the original waitlist request for the next restock. Prior provider contact, legacy uncertainty, suppression and operator cancellation never trigger automatic rearming.

The rich text editor loads on explicit edit intent, with an editable fallback during loading/failure. Catalogue lists omit full descriptions/SEO; PDP and related-product reads are bounded; rating totals run in SQL. Redacted request-error instrumentation and vitals hooks provide a starting point for monitoring. These changes do not establish field performance, image-account health or a conversion lift.

Dependencies stay within tested compatible manifest ranges. Next.js remains 15; React remains 19. The npm lockfile is canonical and the compatible PostCSS security patch is pinned through an override. ESLint 9 is retained for the current Next lint configuration despite its upstream support warning; migration to the next lint/config major is a follow-up compatibility task, not a security-fix claim.

## Remaining work and release conditions

The [release runbook](../../storefront/docs/AUDIT-RELEASE.md) is the authoritative deployment procedure. Required external work: backup/restore proof, exact deployed schema/commit/grants, independent PostgreSQL session races, staged admin operator checks, valid certificates/policies/business identity, production image service limits, GA configuration/reconciliation, WAF/IP/session controls and actual scheduler/alert delivery. No production approval is implied by passing local tests.

Optional programme extensions remain explicit: parcel lot allocation, authoritative preflight refund quote, refund transfer/reference settlement ledger, carrier import/reconciliation, new consent-based cart acquisition, a recurring-delivery platform, a new theme, and measured homepage/PDP experiments. Existing UI supports correct committed refunds and per-order tracking without claiming those extensions.

Further engineering refinements: structured cart variant identities, field-specific server validation messages, broader device/VoiceOver/zoom checks, automatic browser acceptance in CI, monitoring vendor/error-budget configuration, and production query/route-JS budgets. The existing component harness and regression suite are reusable foundations.

## Review and delivery record

Implementation and independent reviewers cross-checked storefront/commerce/admin boundaries. Important findings were reproduced, fixed and tested again. No files were staged or committed while workers were editing. The original checkout's tracked source was left unchanged; all implementation is in the isolated worktree. No push or deployment is part of this delivery. A fresh reviewer independently checked the final checkout/outbox/consent/analytics/stock bridges, reproduced and re-reviewed the stock rearming fix, and found no remaining P1/P2 issues in that bounded scope; 61 selected tests passed independently. This is not a claim of an exhaustive full-branch review.

Operational guides: [migrations](../../storefront/docs/MIGRATIONS.md), [checkout abuse limits](../../storefront/docs/CHECKOUT-ABUSE.md), [paid analytics](../../storefront/docs/PAID-ANALYTICS.md).
