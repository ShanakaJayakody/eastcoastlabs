# Conversion and profit implementation — release record

The approved audit is implemented on `codex/conversion-profit`, based on `061e76a`. This record distinguishes delivered engineering from business inputs, deployment and measured outcomes. The working copy is `.worktrees/conversion-profit`. The original checkout and its local user files were preserved.

## Audit coverage

| Finding | Engineering delivered | Remaining acceptance / owner |
| --- | --- | --- |
| F01: inconsistent starting prices | Shared size-aware listing data, available starting prices and explicit mass labels on product cards. | Operations: compare live catalogue and current inventory after deployment. |
| F02: stale selected size | Shared product selection updates SKU, size, description, imagery, evidence context, stock and cart identity; selected-size URL and variant schema. | Operations: supply accurate per-size copy/images; verify existing child-size redirects. |
| F03: long mobile buy area and pack-price surprise | Compact purchase controls, selected total beside CTA, explicit selection and early purchase anchor. The live-catalogue default becomes one vial, matching its entry price; packs remain available. | Growth: test the single-vial versus three-pack default using paid contribution. This is a clarity decision, not a measured winner. |
| F04: evidence gap | Clear unavailable evidence and certificate scope; narrower generic testing promises and no fabricated certificates. | Owner: verify and publish authentic batch certificates; reconcile database copy, rendered labels/images and actual shipment lots. Engineering cannot establish laboratory provenance. |
| F05: damaged descriptions | Safe structured React rendering of paragraphs, headings, lists, entities and approved links. | Operations: inspect the highest-traffic live descriptions and source references. |
| F06: sparse policy/identity | Contact, shipping, returns, privacy and terms routes; footer/purchase links; atomic admin business-profile editor. | Owner: enter verified legal name, ABN, contact/address and dispatch/returns terms; confirm policy accuracy. Empty fields are not presented as verified facts. |
| F07: recovery friction | Recovery is an optional disclosure after core contact details; explicit confirmation/consent retained. Coupon entry collapses; mobile summary shows confirmed total. | Growth: measure checkout completion and recovery contribution after release. |
| F08: overlapping gifts/accessories | Paid-item, current-stock and post-discount gift qualification enforced; gift-only cart removed; kit/component duplicates suppressed; one optional suggestion. | Finance: cost thresholds, gifts and promotions with actual fulfilment costs before changing incentives. |
| F09: inflated profit | Discount-aware and refund-aware gross profit; sellable stock recovery requires evidence; unknown costs remain unknown. Actual cost entry, contribution coverage and mature cohorts added. | Finance: complete costs/tax basis and reconcile representative real orders; see contribution runbook. |
| F10: inconsistent event identity / no attribution join | Canonical parent catalogue IDs, size/pack variants, validated first-party attribution joined to order and immutable paid/refund snapshots. | Analytics: configure matching campaign/experiment allowlists and reconcile ingestion. |
| F11: unverified analytics | Consent-gated browser loader and privacy controls; bounded quote/payment events; paid pipeline/runbook updated. | Analytics: configure GA and verify actual provider reports, consent coverage and delayed-payment association. Local tests do not prove ingestion. |
| F12: transfer-only journey | Clear order → transfer → confirmed-payment sequence and purchase information at checkout. | Owner: verify active payment settings and pursue provider acceptance only when commercially justified. No new processor account or platform migration. |
| F13: assumed reorder timing | Pack-derived timing removed in favour of explicit settings, stable optional retention holdouts and stock-aware reorder links; transactional messages preserved. | CRM: configure timing from observed/buyer-selected data, verify deliverability and review mature holdout results. |
| F14: unsupported popularity / unavailable discovery | Factual pack labels, stock-aware featured ordering and compact mobile filters. | Growth/finance: rank within eligible stock using paid demand and measured contribution once costs are complete. |
| F15: intermittent quote loading | Fifteen-second quote timeout, usable retry, stale-response protection and bounded timing/error events. | Analytics: measure production latency/error rates by browser; no claim of a prior sitewide outage. |

The audit's 90-day programme also covers operational actions: costed offer/channel pilots, inventory lead-time decisions, authentic creator rewards, Search Console coverage, field performance and mature experiment decisions. These require actual costs, accounts, verified product/channel eligibility and elapsed time. The release supplies measurement and reporting foundations; it does not launch advertising, send campaigns, invent profit floors or claim uplift.

## Release sequence

1. Review the branch and business content. Verify authentic certificates and database claims separately from generic site copy. Fill public business fields in Admin → Settings. Confirm actual shipping charges, dispatch terms, payment expiry, returns process and provider processing details.
2. Back up the target database using the established migration procedure. Apply the additive migrations in order: `20260913110000_order_economics.sql`, `20260913120000_order_attribution.sql`, then `20260913130000_public_business_settings.sql`. Apply and smoke-test on staging before production. The application depends on the new schema/functions; deploy it after migration success.
3. Follow [contribution reporting](2026-09-13-CONTRIBUTION-REPORTING.md) to enter actual costs, the accountant-reconciled tax adjustment, and confirm a consistent net-of-applicable-tax basis. Null is unknown; record a verified zero explicitly. No tax rate, registration or credit is inferred. Reconcile discounted, gifted, partially refunded and returned-inventory orders before trusting contribution.
4. Follow [measurement configuration](../../storefront/docs/MEASUREMENT.md) and [paid analytics](../../storefront/docs/PAID-ANALYTICS.md). Keep GA and experiments inactive unless properly configured. Public environment allowlists and service-only database allowlists must agree. Keep the anonymous session denominator and unattributed-order coverage visible.
5. Follow [retention operations](2026-09-13-RETENTION-OPERATIONS.md) before enabling reorder timing or a holdout. Keep the same experiment ID, allocation key and eligibility throughout a test. Confirm consent, unsubscribe, repeat-purchase suppression, provider authentication and bounce handling in staging. No live emails were sent during implementation.
6. Exercise the deployed journey with synthetic staging data: size deep link, sold-out selection, pack/cart totals, included items, gift after coupon, empty cart, recovery disclosure, quote failure/retry, duplicate submission, transfer instructions, paid transition, partial refund and order-cost editor. Verify private links stay out of analytics and indexing.
7. Record deployed commit, migration results, content verification, provider-ingestion evidence and baseline dates. Monitor quote errors, order-created versus paid counts, stock failures, support contacts, cost coverage and email failures. Use measured field LCP/INP/CLS, not a quota-error PageSpeed file.

For rollback, revert the application release first only after checking compatibility with the installed additive schema. Do not delete newly captured economics or attribution data. Restore privileged functions only through a reviewed forward migration; never blindly roll back commerce tables or paid/refund history.

## Experiments to run after a trustworthy baseline

Accuracy, privacy, accounting and failure-recovery repairs ship as fixes. For valid alternative designs/offers, choose one experiment at a time: pack default, evidence placement, accessory offer, or shipping/gift threshold. Predeclare eligible visitors, persistent allocation, primary contribution metric, minimum worthwhile effect, sample method, maturation period and stop rule. Monitor wrong-size contacts, refunds, margin, unsubscribes and stock. The existing `/` and `/1` pages do not randomize traffic.

Use mature 60/90-day second-purchase cohorts and cumulative contribution, including one-time buyers. Optional retention holdouts measure incrementality only within their declared eligibility and observation window. Transactional payment/shipping/support messages continue. Do not infer human use or consumption from pack size.

## Verification

Final verification on 13 September 2026:

| Check | Result |
| --- | --- |
| `npm test -- --reporter=dot` | 117 files, 628 tests passed. Baseline was 97 files, 497 tests. |
| `npm run typecheck` | Passed after the production build finished generating its type files. |
| `npm run lint` | Passed. |
| `npm run build` | Passed; public catalogue falls back to unavailable/empty states without service configuration. |
| `npm run check:budgets` | All six existing budgets passed without increasing limits. Home 134.6 kB, shop 135.8 kB, PDP 136.5 kB and checkout 137.1 kB initial gzip JavaScript. Optional analytics and exit-intent UI load separately. |
| `PREVIEW_PORT=4191 npm run test:browser -- --workers=2` | 62 passed, 7 intentional desktop skips for mobile-only checks; 320 px, 390 px and desktop fixtures. Includes keyboard, accessibility, selection, recovery and checkout failure/retry journeys. |
| `npm run test:postgres` | All 39 migrations applied to disposable PostgreSQL; 22 concurrent/operational checks passed, including restoration of all 43 public/storage tables. |
| `npm run test:headers` | 9 private-response checks passed on an owned loopback production server. |
| Independent review | Catalogue/measurement and economics/checkout/profile reviewed by separate agents. Important findings fixed and retested; no important unresolved review finding. |

Review regressions covered stale size content and navigation, description link spacing/safety, missing same-page consent events, retired attribution blocking checkout or erasing prior assignments, delayed-payment dashboard revenue, explicit tax adjustment, restored-cart gifts, ABN typos and transient size-selector contrast. The corrected flows were exercised with synthetic data.

Checks ran against local fixtures and disposable databases, not customer orders. No deployment, production migration, payment, campaign or live customer communication is included in this implementation record. Actual certificates, entity ownership, costs, provider ingestion and mature commercial results remain the explicit business acceptance items above. ABN format checking follows the [Australian Business Register checksum](https://abr.business.gov.au/Help/AbnFormat); it does not verify registration or ownership.
