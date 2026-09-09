# Audit completion — 8 September 2026

> The production release was completed on 9 September 2026; see [release evidence](2026-09-09-PRODUCTION-RELEASE.md). Statements below about production remaining unchanged describe the earlier implementation verification.

This report continues [the initial implementation record](2026-09-08-IMPLEMENTATION.md). Work is isolated on `codex/audit-implementation`. Production remains at its previously deployed commit until the coupled database/application release is approved and performed.

## Completed workflow extensions

### Refund review and transfer records

Both partial and full refunds now show the exact items, allocated discount, shipping and remaining refund balance before confirmation. The database binds that review to the order state, rejects stale reviews and safely replays the same committed request. A separate immutable settlement ledger records the reference, date and amount of a bank transfer already made by the operator. Recording a settlement does not move money or record another refund.

### Physical packing evidence and carrier import

Operators can register physical lots against existing inventory, associate receipt and verified certificate evidence, and allocate those lots to an order's remaining physical packing requirements. Pack and kit quantities use their frozen inventory claims. Dispatched assignments and certificate snapshots preserve historical evidence; unallocated items are identified explicitly on packing slips. Registering a lot does not add stock or invent traceability.

Carrier CSV import accepts the `order_number,tracking_number` columns, including quoted values. The workflow previews each row, rejects duplicate or conflicting instructions, validates the reviewed state again at commit, and returns per-row outcomes. Shipment notifications are an explicit option.

### Checkout identity, useful errors and requested cart recovery

New cart lines carry the exact active variant identifier. Older saved carts can still resolve their existing labels, while an explicitly invalid or mismatched identifier is rejected. Checkout errors identify their inputs, expose the linked explanation to assistive technology and focus the first failing field. An uncertain submitted order remains recoverable.

Cart recovery requires an unchecked purpose choice, an explicit request and mailbox confirmation. Visiting an email link alone does not activate reminders. Confirmation expires after 24 hours; restoration expires seven days after the request. The existing schedule permits at most three eligible reminders, at one, 24 and 72 hours. Newsletter permission remains separate.

Restoration requires an explicit button, rechecks prices and stock, and replaces the device cart only after a successful response. A private HttpOnly cookie and the exact restored line identities bind any later order attribution. Edited or unrelated carts are not credited to the recovery episode. Contact and address fields are not stored in the browser.

Manual reminders share the scheduled reminder's episode/stage identity and require the same confirmed permission. Admin stops and unsubscribe requests revoke the underlying recovery credentials; changing newsletter status later cannot revive those old links. Private recovery pages exclude analytics and email-capture UI, and carry no-store/no-referrer/noindex protection.

### Delivery operations, refund reporting and product publishing

Automation controls let authorised operators cancel eligible queued messages, request a bounded retry, or reconcile a known provider outcome with an audit reason. Active delivery leases cannot be overridden. Retries retain the frozen recipient, sender, subject, body and provider identity. When a provider ID was lost, reconciliation requires provider proof tied to that exact outbox message; legacy messages without sufficient proof remain unresolved. These controls never initiate a blind replacement send.

Each eligible committed refund with an original purchase/client analytics identity creates one immutable analytics intent containing the actual incremental goods and shipping amounts, with that original identity and no customer contact fields. Commerce evidence remains recorded when optional analytics is unavailable. A database reconciliation query compares recorded refunds, commerce events, queued analytics and provider-accepted amounts. Provider acceptance does not establish reporting ingestion. An ambiguous refund send stops for reconciliation; purchases retain their existing bounded retry contract.

Product creation and launch now apply their related product, variant and inventory changes in database transactions. Application privilege cleanup removes broad inherited grants on application-owned objects, preserves necessary service access and verified public certificate/review reads, and checks defaults for future objects. It does not alter Supabase-managed object ownership or other owners' defaults.

## Verification infrastructure

The release checks now run against disposable PostgreSQL 17 instances using independent sessions, deterministic contention and synthetic fixtures. They include checkout, stock, payment/expiry, refund, settlement, product/settings revisions, receipt reversal, provider completion, lot allocation and carrier replay. A custom-format backup is restored into a second disposable database and its table data and grants compared. This establishes repeatable test-database restoration; it is not a backup of production customer data.

Browser acceptance exercises the actual checkout and cart components with fake server actions at 320, 390 and 1,280 pixels. It checks overflow, labels, serious/critical accessibility findings, quote failure/retry, keyboard focus and uncertain-order recovery. CI runs these tests alongside the database, unit, type, lint, dependency, build and JavaScript-budget checks. A separate check starts the actual production build on loopback and verifies the expected HTTP status and private response headers on nine sensitive paths without application/provider credentials.

Route budgets measure the compressed, deduplicated JavaScript for each route and its ancestor layouts. This is a distinct metric from Next.js's printed first-load estimate. [The budget configuration](../../storefront/config/performance-budgets.json) defines the checked routes and thresholds. Field Core Web Vitals, query latency and operator-efficiency targets remain targets until measured with representative traffic and workflows.

An authenticated read-only operations health endpoint reports overdue jobs and failed/aged queues without sending messages or running a sweep. [Monitoring instructions](../../storefront/docs/MONITORING.md) define probe and alert conditions. An external alert destination still needs account configuration and an end-to-end delivery check.

## Production evidence gathered without writes

On 8 September, read-only deployment metadata identified the ready production application as `72e1bb72f4e54ac7c400bd6f1dcf16819efc8164` on `main`, deployment `dpl_4cbTAu5Twn3mbzu1WzmeHe9rnRaY`. Its database reports PostgreSQL 17.6 and the legacy application schema. It has no migration ledger or new commerce-event/checkout-idempotency/outbox-lease structures. Consequently, deploying application code alone would be incorrect.

The live anonymous role still had access to the review `order_id` column. The new migration chain removes that access in verification. Production's broad inherited table privileges also informed the new least-privilege checks; a fresh database with empty defaults would not reveal that condition.

Read-only aggregate checks found zero pending orders without expiry, invalid refund balances, invalid refunded quantities, invalid inventory balances or orders without line items. These limited counts do not establish that all historical accounting or physical stock evidence is correct.

A schema-only copy of production's `public` schema and grants was restored into disposable local PostgreSQL. No customer records were copied. The forward migrations were exercised against that actual schema shape. The migration runner's production dry run also succeeded with certificate and hostname verification enabled, using [Supabase's published public CA](../../storefront/supabase/certs/README.md). No migration ledger or business data was written in production.

The public home page and three separate optimized image requests returned HTTP 200; the audit's earlier image-service 402 response did not reproduce. The latest five scheduled GitHub sweeps succeeded. These observations do not replace ongoing monitoring or prove alert delivery. The authenticated read of the project's active custom firewall configuration returned `Config not found` (404); a project-specific checkout abuse policy was therefore not verified. This does not mean Vercel's platform-level protection is absent. No firewall settings were changed.

Read-only GitHub configuration checks found `main` unprotected and no repository rulesets. After the branch CI runs successfully, require its `verify` check before merging and review direct/force-push permissions. No repository settings were changed.

Available production environment names include the required Supabase, cron and Resend settings. Dedicated order-link and unsubscribe secrets are optional because the code has existing secure secret fallbacks. No secret values are included in this report. Optional GA configuration was absent, so analytics delivery must remain disabled until the intended property is configured and validated.

## Remaining external release work

- Take and restore a real production backup in an isolated authorised environment, reconcile historical evidence where necessary, and execute the coupled migration/application procedure in the [release runbook](../../storefront/docs/AUDIT-RELEASE.md).
- Complete signed-in staging operator acceptance, including timed fulfilment/product workflows, keyboard, zoom and assistive-technology checks. The user selected a code-based admin audit; synthetic component tests do not represent an operator's complete environment.
- Supply the legal business identity/ABN, approved policy/dispatch commitments and genuine product-matched COA documents. The audit identified 14 missing source PDFs; code cannot attest to or manufacture them.
- Configure and verify external monitoring/alert delivery, trusted-proxy WAF controls and, if desired, the GA property and Measurement Protocol credentials. Application rate limits and redacted diagnostics do not configure those accounts.
- Supply a recurring-delivery provider and cadence before enabling recurring checkout. Carrier CSV and manual settlement support current operations without inventing a provider.

## Decisions made during implementation

Manual settlement records and carrier CSV reconciliation were selected because they work with the existing bank-transfer operation. If another provider is selected, its adapter and operational rules will need additional work. Recurring checkout remains disabled until its provider and cadence are defined.

The existing visual identity was retained while completing behaviour and measurement. No replacement theme or conversion hypothesis was approved. A different visual direction would require a separate design decision and measured experiment.

Ambiguous GA refund delivery stops for reconciliation because purchase transaction deduplication is not a documented exactly-once guarantee for distinct partial refunds. This may leave an analytics gap until reporting is checked; the database remains the accounting source of truth.

The final fix wave was extended narrowly when review found that an automatic payment change could create a second identity for an unresolved order. Preserving the original attempt takes precedence over closing a review-round limit. This required extra regression/review time and may require an affected customer to perform another recovery check.

## Final validation

The [completion evidence](evidence/2026-09-08-completion/README.md) records the locked install and integrated run on Node 22.23.1 / npm 10.9.8, with application/provider credentials empty:

| Check | Result |
|---|---|
| Regression suite | 389 tests across 79 files passed |
| Typecheck and lint | Passed |
| npm dependency audit | Zero reported vulnerabilities |
| Next 15.5.25 production build | Passed |
| Native PostgreSQL | 33 migrations, 22 checks; all 37 fixture tables restored |
| Actual production schema-only replay | All 14 forward migrations passed; private review identity denied |
| Browser/component acceptance | 22 scenarios passed; two mobile-menu cases intentionally skipped at desktop width |
| Actual private route responses | Nine status/header checks passed |
| Compressed route JavaScript | All six budgets passed |

Measured compressed JavaScript: home 130.9 kB, shop 133.3 kB, product 132.5 kB, checkout 134.8 kB, admin product 159.1 kB and admin order 150.1 kB. These are build measurements, not field performance or conversion outcomes.

The install reported that the pinned ESLint 9.39.5 version is unsupported. The initial cold build emitted two webpack cache serialization advisories (108/259 KiB strings); the final build emitted neither. These successful runs and the original advisories are retained in the evidence. A compatible lint-toolchain upgrade is separate maintenance work; the dependency audit reported no vulnerabilities.

All feature and whole-branch review findings are closed; see the [independent review record](2026-09-08-REVIEW.md). Final application verification is at `f472117`, including the automatic shipping/payment uncertainty guards and both mobile header variants. Database SQL and native-check inputs are unchanged since the passing `12091e3` run. The branch is ready for the documented staging/release procedure, subject to its external gates. No production deployment has been performed.
