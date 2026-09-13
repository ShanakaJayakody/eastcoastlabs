# Conversion and Profit Implementation Plan

> **For agentic workers:** Use the parallel-agents skill for the independent domains below, with test-first changes and an integrated review. Preserve file ownership. The user's “lets implement all of this” approves the linked audit and this implementation work; do not restart design approval.

**Goal:** Implement the actionable engineering recommendations in the approved conversion/profit audit and make external business dependencies explicit and operable.

**Architecture:** Extend the existing Next.js/Supabase storefront and admin. Keep server repricing, stock enforcement, consent, private payment access, and idempotency authoritative. Add shared pure functions where accounting, catalogue identity, or offer eligibility must agree across surfaces; use additive migrations for persisted data.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind, Supabase PostgreSQL, Vitest, Testing Library, Playwright.

**Spec:** `docs/audits/2026-09-13-CONVERSION-AND-PROFIT-PLAN.md` (approved by the user).

## Global constraints

- Work on `codex/conversion-profit` in `.worktrees/conversion-profit`; preserve existing user files.
- Monetary arithmetic uses integer cents. Missing costs are unknown, never zero or confirmed profit.
- A created order is not a paid sale. Preserve payment/refund deduplication and actual timestamps.
- No invented certificates, identity, ABN, claims, reviews, provider acceptance, commercial costs, or uplift.
- Keep legal research-use restrictions, marketing consent and suppression, private-route protections, and server validation.
- Use one catalogue slug for analytics item identity; pack/size stays in `item_variant`.
- Retain the current brand; improve hierarchy and responsive behaviour. No new tracking/marketing vendor.
- Do not send messages, place live test orders, run marketing campaigns, or provision a payment provider.
- Add migrations and a release checklist; run them only against isolated test databases during implementation.
- External certificates, business identity, actual operating costs, analytics configuration, provider approval, and 90-day experiment results require business inputs or elapsed time. Build useful configuration/reporting instead of fabricating them.

## Task 1: Catalogue accuracy and mobile purchasing

**Owner:** catalogue agent.
**Files:** `storefront/lib/product-sizes.ts`, `lib/catalog.ts`, `components/ProductPurchase.tsx`, `BuyBox.tsx`, `ProductCard.tsx`, `app/(store)/product/[slug]/page.tsx`, `app/(store)/shop/page.tsx`, relevant catalogue/home components and product rendering tests. Coordinate before editing shared analytics/cart files.
**Interfaces:** Consume existing product/size/stock and COA types. Browser commerce events use slug `item_id`. Produce consistent size-aware card data, safe structured description rendering, selected product identity, mobile buy box and size deep links.

- [x] Add regression cases: parent 100 mg at 7,999 cents and child 50 mg at 5,999 cents must show a consistent purchasable starting price; selecting 50 mg must update the visible selected SKU/specification and cart payload; unsafe HTML URLs must not render, valid paragraphs/entities must.
- [x] Run the new tests and record the expected failures before production edits.
- [x] Fix size labels/mapping, retain the selected size in the URL, and show accurate selection context. Add variant structured data matching purchasable options.
- [x] Compact the mobile product area and put selected pack total by the CTA. Preserve intentional selection and stock limits. Replace unsubstantiated positional “Most popular” with factual pack labels.
- [x] Make featured discovery availability-aware and compact mobile catalogue controls. Keep search/sort/filter capabilities and visible reset.
- [x] Verify relevant component/catalogue tests and responsive browser fixtures. Report changed files, commands/results and any remaining business-content dependencies.

## Task 2: Profit and customer economics

**Owner:** economics agent.
**Files:** `storefront/lib/admin/costs.ts`, `lib/admin/reports.ts`, related dashboard/report/order-detail consumers, new pure economics helpers, additive economics migration if needed, `tests/admin/*economics*`, existing report tests.
**Interfaces:** Preserve existing consumers or update them together. Consume snapshotted line costs/allocated discounts, actual refund/restock records and paid timestamps. Return nullable profit/contribution when required costs are incomplete, with coverage counts. Do not edit checkout actions or analytics migrations.

- [x] Add hand-calculated regressions: 15,000 revenue - 1,500 discount - 9,500 cost = 4,000 gross profit; a missing cost makes margin unknown; no-restock refund must not reclaim consumed cost; true returned inventory may recover cost once.
- [x] Run failing tests, then centralize line economics so product and order reports reconcile discounts/refunds consistently.
- [x] Audit paging, paid-date/status inclusion and errors so reports do not silently truncate or return zero on failure.
- [x] Add a useful contribution/retention report: explicitly entered variable order costs, cost coverage, created-to-paid conversion with mature windows, 60/90-day second purchase and cumulative cohort contribution. Persist new inputs additively if the current schema lacks them; do not infer GST, shipping expense, or acquisition spend as zero.
- [x] Expose clear admin UI explaining gross profit versus contribution and missing data. Add a cost-entry route/action with existing authorization/validation patterns if required.
- [x] Verify formula boundaries, authorization and any SQL migration in isolated tests; report assumptions and unsupported historical precision.

## Task 3: Paid attribution and experiment measurement

**Owner:** measurement agent.
**Files:** `storefront/lib/analytics.ts`, `lib/paid-analytics.ts`, `lib/variant.ts`, analytics components, `app/(store)/checkout/actions.ts`, attribution helper/migration, related tests. Coordinate minimal CheckoutForm prop/payload changes with root. Do not edit product or admin economics files.
**Interfaces:** `GaItem.item_id` is the canonical parent catalogue slug, consistent with paid snapshots; physical child slugs remain the cart/stock identity. Keep existing public/private URL allowlist. Add allowlisted first-party experiment/acquisition data to created orders and paid snapshots without personal data or full referrers.

- [x] Regress inconsistent browser/paid identity and missing assignment-to-order join using explicit literal payload expectations.
- [x] Add durable, validated experiment assignment and safe acquisition identifiers; preserve consent and reject PII/private URL material. Do not claim existing `/` versus `/1` routing is randomized.
- [x] Persist order attribution additively and expose it in the existing paid-event pipeline without changing payment idempotency. Keep true paid/refund times and transaction deduplication.
- [x] Provide bounded typed event helpers for product/list/size/pack, cart removal, quote readiness/error/duration and payment steps. Root and catalogue agent wire events in owned components using your documented signatures.
- [x] Keep new experiments inactive/configurable until eligible traffic and business approval support a meaningful test. Build assignment/holdout primitives and a documented readout workflow without announcing results.
- [x] Test privacy, malformed values, repeat requests, SQL snapshots and paid worker payloads. Document actual configuration/ingestion checks needed after release.

## Task 4: Cart, checkout, policies and trust presentation

**Owner:** root.
**Files:** `storefront/components/CartContents.tsx`, `CartUpsell.tsx`, `CheckoutBump.tsx`, `CheckoutForm.tsx`, `FreeShippingProgress.tsx`, `Footer.tsx`, shared offer eligibility helper, `lib/commerce.ts` or actual cart resolver, policy/contact routes, policy settings and tests.
**Interfaces:** Consume existing server quotes/settings and canonical analytics helpers. Offer eligibility requires a non-gift paid line and current threshold/stock. Use factual existing contact/dispatch settings only.

- [x] Add regressions: zero threshold plus no paid line yields no gift; gift disappears after paid removal; kits suppress duplicate component suggestions; sold-out accessories are not suggested.
- [x] Repair gift eligibility in both UI and server. Replace zero-target shipping progress with an included-shipping statement. Keep deliberate extra purchases possible.
- [x] Collapse optional cart recovery below core contact fields and coupon entry into a disclosure. Add a compact mobile total/items summary without duplicating form controls or screen-reader labels.
- [x] Add a bounded quote timeout/retry with stale-response protection. Preserve idempotency and prevent order submission on stale/failed quotes.
- [x] Clarify bank-transfer sequence and add policy/contact access near purchase. Publish factual shipping/returns/privacy/terms/contact pages based on current operation; avoid invented entity/address/ABN. Flag missing verified identity as an operational dependency.
- [x] Narrow generic testing/purity promises where evidence is unavailable and centralize reliable evidence status. Retain genuinely verified certificate paths.
- [x] Run targeted tests, browser journeys, keyboard/zoom/narrow-width checks; no live orders.

## Task 5: Retention, operational readiness and integrated verification

**Owner:** root after shared interfaces stabilize; may delegate a bounded independent retention task.
**Files:** `storefront/lib/admin/sequences.ts`, lifecycle/email cron routes, reminder preferences/admin controls, admin operations/reports, relevant tests, release/runbook documents.
**Interfaces:** Keep transactional communications for all eligible customers; optional marketing uses existing consent/suppression. Holdout assignment must be stable and separate from transactional delivery. Do not infer consumption from pack size.

- [x] Verify existing flow eligibility, pagination, deduplication, payment/refund suppression and overlap. Add regression tests for any actual gaps before fixes.
- [x] Replace unvalidated pack-size reminder logic with configurable measured/buyer-selected timing; use conservative disabled defaults where facts are missing.
- [x] Add mature cohort/holdout guidance and operational reporting without treating vendor attribution as incremental results.
- [x] Record every audit finding as implemented, configured, externally dependent, or a future measured experiment; include owners and acceptance checks.
- [x] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, route budgets and relevant browser/PostgreSQL checks. Fix new failures; document baseline/environment limits precisely.
- [x] Review the integrated diff independently, resolve important findings, and verify affected checks again. Commit the reviewed implementation on the isolated branch and present release-ready changes and external dependencies to the user.

## Verification ledger

Baseline commit: `061e76a`. Clean baseline: 97 files / 497 tests passed.

Implementation and independent review completed on 13 September 2026. Final full suite: 117 files / 628 tests passed. Typecheck, lint, production build and all six unchanged route budgets passed. Browser fixtures: 62 passed with 7 intentional mobile-only desktop skips. Disposable PostgreSQL: all 39 migrations, 22 checks and backup/restore of 43 tables passed. Private production-response headers: 9 checks passed.

The audit coverage and exact business acceptance items are recorded in `docs/operations/2026-09-13-CONVERSION-RELEASE.md`. All engineering checklist items above are complete; authentic certificates, verified business facts, cost/tax entries, provider configuration/ingestion, deployment and mature experiment outcomes remain explicit external steps. No live orders, payments, messages, production migrations or deployment were performed.

Independent review corrections included selected-size navigation and evidence context, safe description links/spacing, same-page consent measurement, preservation of committed attribution across campaign retirement/retry, automatic rewards on restored carts, ABN checksum validation, paid-date dashboard revenue and an explicit nullable tax adjustment in contribution. Each important finding received regression coverage and a passing verification run.
