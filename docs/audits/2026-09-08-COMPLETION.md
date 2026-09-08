# Audit completion — 8 September 2026

This report continues [the initial implementation record](2026-09-08-IMPLEMENTATION.md). Work is isolated on `codex/audit-implementation`. Production remains at its previously deployed commit until the coupled database/application release is approved and performed.

## Completed workflow extensions

### Refund review and transfer records

Both partial and full refunds now show the exact items, allocated discount, shipping and remaining refund balance before confirmation. The database binds that review to the order state, rejects stale reviews and safely replays the same committed request. A separate immutable settlement ledger records the reference, date and amount of a bank transfer already made by the operator. Recording a settlement does not move money or record another refund.

### Physical packing evidence and carrier import

Operators can register physical lots against existing inventory, associate receipt and verified certificate evidence, and allocate those lots to an order's remaining physical packing requirements. Pack and kit quantities use their frozen inventory claims. Dispatched assignments and certificate snapshots preserve historical evidence; unallocated items are identified explicitly on packing slips. Registering a lot does not add stock or invent traceability.

Carrier CSV import accepts the `order_number,tracking_number` columns, including quoted values. The workflow previews each row, rejects duplicate or conflicting instructions, validates the reviewed state again at commit, and returns per-row outcomes. Shipment notifications are an explicit option.

## Verification infrastructure

The release checks now run against disposable PostgreSQL 17 instances using independent sessions, deterministic contention and synthetic fixtures. They include checkout, stock, payment/expiry, refund, settlement, product/settings revisions, receipt reversal, provider completion, lot allocation and carrier replay. A custom-format backup is restored into a second disposable database and its table data and grants compared. This establishes repeatable test-database restoration; it is not a backup of production customer data.

Browser acceptance exercises the actual checkout and cart components with fake server actions at 320, 390 and 1,280 pixels. It checks overflow, labels, serious/critical accessibility findings, quote failure/retry, keyboard focus and uncertain-order recovery. CI runs these tests alongside the database, unit, type, lint, dependency, build and JavaScript-budget checks.

Route budgets measure the compressed, deduplicated JavaScript for each route and its ancestor layouts. This is a distinct metric from Next.js's printed first-load estimate. [The budget configuration](../../storefront/config/performance-budgets.json) defines the checked routes and thresholds. Field Core Web Vitals, query latency and operator-efficiency targets remain targets until measured with representative traffic and workflows.

An authenticated read-only operations health endpoint reports overdue jobs and failed/aged queues without sending messages or running a sweep. [Monitoring instructions](../../storefront/docs/MONITORING.md) define probe and alert conditions. An external alert destination still needs account configuration and an end-to-end delivery check.

## Production evidence gathered without writes

On 8 September, read-only deployment metadata identified the ready production application as `72e1bb72f4e54ac7c400bd6f1dcf16819efc8164` on `main`, deployment `dpl_4cbTAu5Twn3mbzu1WzmeHe9rnRaY`. Its database reports PostgreSQL 17.6 and the legacy application schema. It has no migration ledger or new commerce-event/checkout-idempotency/outbox-lease structures. Consequently, deploying application code alone would be incorrect.

The live anonymous role still had access to the review `order_id` column. The new migration chain removes that access in verification. Production's broad inherited table privileges also informed the new least-privilege checks; a fresh database with empty defaults would not reveal that condition.

Read-only aggregate checks found zero pending orders without expiry, invalid refund balances, invalid refunded quantities, invalid inventory balances or orders without line items. These limited counts do not establish that all historical accounting or physical stock evidence is correct.

A schema-only copy of production's `public` schema and grants was restored into disposable local PostgreSQL. No customer records were copied. The forward migrations were exercised against that actual schema shape. The migration runner's production dry run also succeeded with certificate and hostname verification enabled, using [Supabase's published public CA](../../storefront/supabase/certs/README.md). No migration ledger or business data was written in production.

The public home page and three separate optimized image requests returned HTTP 200; the audit's earlier image-service 402 response did not reproduce. The latest five scheduled GitHub sweeps succeeded. These observations do not replace ongoing monitoring or prove alert delivery.

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

## Final validation

Final integrated evidence and review status will be recorded here after checkout recovery and operations controls complete their review gates. Interim task test counts are not a claim that the finished branch has passed its final suite.
