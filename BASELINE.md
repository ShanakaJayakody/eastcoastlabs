# East Coast Labs commerce baseline

Updated 13 September 2026 for the native Supabase storefront. **No production financial or analytics values have been collected or verified in this implementation.** Unknown values are not zero. The previous WooCommerce worksheet contained placeholders and arbitrary uplift targets; it is retained in Git history, not treated as a measured baseline.

## Measurement contract

Set and record a fixed baseline start/end, timezone (Australia/Sydney), extraction time, deployed commit and accounting basis before comparing results. Use actual paid orders and mature visitor/customer cohorts. Record refunds and expense corrections as known at extraction; current reports restate the original paid cohort rather than reconstructing a historical as-of ledger.

| Metric | Baseline | Current source and definition |
| --- | --- | --- |
| Paid orders | Not collected | Orders with actual paid_at within the declared period, including subsequently refunded purchases. |
| Net order revenue | Not collected | Paid order totals less recorded refunds; includes shipping, on the recorded tax basis. |
| Net paid AOV | Not collected | Net order revenue / paid orders; retain refunded orders in the denominator. |
| Merchandise gross profit | Not collected | Admin product reports: allocated discounts and merchandise refunds deducted; consumed product/gift costs retained unless a physical restock is confirmed. Unknown COGS means unknown profit. |
| Contribution before/after acquisition | Not collected | Admin contribution report: actual variable costs and confirmed basis, with cost coverage. Read the contribution runbook before interpreting tax treatment. |
| Eligible sessions / visitors | Ingestion unverified | Verify analytics provider, explicit consent coverage, bot/internal exclusions and stable eligible visitor definition. Do not substitute order count or email capture. |
| Paid conversion | Not collected | Paid orders attributed to an eligible visitor/session cohort / that same cohort, allowing a declared transfer lag. Ledger totals and measured coverage must both be shown. |
| Contribution per eligible visitor | Not collected | Contribution joined to the same assigned visitor cohort / all eligible assigned visitors. Do not mix all ledger revenue with only consented sessions. |
| Seven-day created-to-paid | Not collected | Admin funnel: orders paid within seven days / created orders old enough to reach seven days. This is operational payment completion, not session conversion. |
| 60/90-day second purchase | Not collected | Admin cohorts: buyers with a second paid purchase within horizon / first-time buyers whose own horizon has matured. Normalized checkout email includes guest buyers; aliases can split identity. |
| 60/90-day cumulative contribution | Not collected | All orders paid within each eligible buyer horizon, including the first order and one-time buyers; refunds/costs as known now. Show coverage. |
| CAC and payback | Not collected | Actual channel/creator acquisition expense, allocated once, divided by new paid customers; compare with realized cohort contribution and a cash reserve. |
| Quote p95 latency / failure rate | Not collected | Consented quote-request, ready/error event pairs and server operational evidence. Record sample size and browser coverage. |
| Mobile field performance | Not collected | Real field 75th-percentile LCP/INP/CLS over a declared window. Local fixtures and route budgets are engineering checks, not production field measurements. |

## Collection and reconciliation

1. Finance selects the baseline window and reviews full-price, discounted, gifted, partially refunded, no-restock and physical-restock orders against actual records. Complete frozen COGS gaps and actual variable expenses with documented evidence; never infer absent costs as zero.
2. Analytics verifies public consent, canonical item/size/pack identifiers, actual paid/refund ingestion, private-route exclusion and delayed-transfer attribution. Record consent/client-ID and attribution coverage beside totals. HTTP success alone does not establish provider reporting.
3. Export only the aggregate baseline needed for a decision into this file. Keep customer-level source records in authorized business systems. Record extraction time and source evidence so later restatements are explainable.
4. Select the minimum commercially worthwhile effect after the baseline exists. Use contribution as the primary commercial outcome and wrong-size contacts, refunds, payment failures, stock and complaints as guardrails. The previous +25% AOV/+30% repeat/+15% conversion targets were not validated forecasts.
5. For experiments, predeclare eligibility, randomization, duration/sample method, exclusions and maturation. Compare original assignments; ordinary before/after changes or traffic sent separately to `/` and `/1` do not demonstrate causality.

Operational instructions: [contribution](docs/operations/2026-09-13-CONTRIBUTION-REPORTING.md), [measurement](storefront/docs/MEASUREMENT.md), [retention](docs/operations/2026-09-13-RETENTION-OPERATIONS.md), and [release coverage](docs/operations/2026-09-13-CONVERSION-RELEASE.md).
