# Audit completion specification

Continue the authorised audit implementation from commit 8686367 in the existing isolated worktree. Finish repository-owned improvements and make deployment readiness objectively checkable. Maintain the current brand and truthful customer promises.

## Constraints
- Work only in the audit-implementation worktree; do not mutate production data, send customer messages, or publish without a concrete reviewed release.
- Preserve existing checkout idempotency, price/stock authority, narrow access tokens, consent, delivery identity, and refund invariants.
- Database changes are new forward migrations; privileged functions deny anon/authenticated execution unless explicitly public-safe.
- Refunds are accounting records; settlement records describe a transfer an operator has already made and never initiate payment.
- Lot allocation requires operator evidence. Never infer an order's batch from a product's newest certificate or invent certificates, legal identity, or policies.
- Existing fake-provider/PGlite tests remain isolated. Native PostgreSQL verification uses disposable synthetic databases only.
- Never persist checkout contact/address fields in browser storage or automatically enrol a customer into recovery or marketing.

## Deliverables
1. Exact refund preview showing discount, shipping and remaining balance, bound to current order state at commit. Stale previews require review again. An idempotent audited ledger records real transfer references/date/amount and prevents settlement beyond recorded refunds.
2. Stock lot creation/receipt association and remaining-quantity allocation on order packing. Assignments cannot exceed lot stock or packable units. Actual allocated lot and its verified COA are printable; unmatched/unallocated units are explicit. CSV carrier reconciliation supports quoted CSV, preview, duplicate/conflict rejection, per-row commit outcomes, and optional existing notification intent.
3. Explicit, purpose-specific email cart recovery with mailbox confirmation, safe restore links and immutable episode attribution. Structured variant identifiers coexist with legacy carts. Checkout field errors are linked to inputs and focus the first failing field without disrupting recovery.
4. Operator controls expose safe cancellation, known provider reconciliation and bounded retry without blind resend. Refund analytics derives immutable financial deltas, excluding PII, and reconciles against database amounts. Legacy product creation/launch changes become transactional.
5. Repeatable separate-session PostgreSQL races, backup/restore verification, fixture browser acceptance in CI, accessibility checks, route JavaScript budgets, and monitoring/release checks. Verify available deployment metadata read-only and identify any actual external gaps.

## Decisions requiring real-world inputs
No new subscription billing service or delivery cadence is invented. Keep recurring checkout disabled until a provider/cadence is supplied. No legal, certificate, billing or monitoring account facts are fabricated. Carrier CSV and manual settlement records are useful without a new external service. A new theme and conversion experiments need a measured hypothesis; preserve visual identity and provide measurement readiness rather than an arbitrary redesign.
