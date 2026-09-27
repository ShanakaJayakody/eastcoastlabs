# Fulfilment experience and historical trends

## Intent and approved direction

Give the operator a clear account of how long customers wait between placing an order, payment confirmation, and fulfilment, which customers are waiting now, and whether performance is improving over time.

The user approved the dedicated Fulfilment page and interactive design on 27 September 2026, then explicitly requested week-by-week and month-by-month metrics covering the database's entire available history and continuing into the future. The user chose elapsed time only; no service target, business-day adjustment, or late/on-time classification belongs in this release.

The page lives at `/admin/fulfilment`, under Today beside Orders. It follows the existing admin shell and visual language. The reviewed mockup is a design reference, not deployed application code; its sample figures are not production results.

## Confirmed data foundation

A read-only audit of the configured production database at 2026-09-27 04:35 UTC found:

| Check | Result |
| --- | ---: |
| Existing orders | 177 |
| Earliest order, Australia/Sydney | 10 August 2026, 07:00 |
| Orders with recorded payment times | 140 |
| Orders with recorded shipping times | 131 |
| Paid/processing orders currently waiting | 8 |
| Pending orders currently waiting for payment | 6 |
| Missing payment times expected from current lifecycle | 0 |
| Missing shipping times on shipped/completed orders | 0 |
| Payment before creation; shipping before payment; future timestamps | 0 for each check |

Every recorded payment and shipping timestamp has a corresponding genuine status-transition event. The audit found zero disagreements exceeding one second between those timestamps and the respective earliest transition events. Edits that leave the status as shipped were excluded from this event check.

These are audit-time counts, not constants for the application. The earliest existing order establishes available history; schema creation dates do not establish earlier trading history, and deleted records cannot be reconstructed from this audit.

Existing sources are `orders.created_at`, `orders.paid_at`, `orders.shipped_at`, and `order_events`. Existing `completed` transitions can be automatic ten days after shipping and are not evidence of delivery. Payment confirmation records the operator's action, not an independently verified bank receipt timestamp. Marked shipped records the application's shipping action, not an independently verified carrier handover.

## Page structure

### Overview

- Three duration summaries: Placed to paid, Paid to marked shipped, and Placed to marked shipped. Each shows decimal elapsed days and a readable equivalent such as `1d 6h 24m`.
- Typical (median) is the default, with an average (mean) switch. Each summary shows its eligible order count and date basis.
- A distribution of paid-to-shipped durations, with neutral ranges up to 1 day, over 1 through 2 days, over 2 through 3 days, and over 3 days. These ranges are descriptive, not service targets.
- A longer-waits summary with the 90th percentile and longest recorded wait, plus timing coverage.
- A clearly separate current queue, oldest payment first. Its label says `Current queue · all dates`; a historical period selection never hides older current work. An unpaid queue uses order creation as its clock start.

### Trends

This is a first-release feature, with a prominent tab beside Overview and Order timings.

- A Week / Month grouping switch changes the granularity without changing the selected date range. Weeks run Monday through Sunday. Months are calendar months.
- Range options: All history, Last 12 weeks, Last 12 months, and a custom inclusive local-date range. Default to All history, grouped by week. The actual available start date is visible.
- Display all three stage trends in aligned panels with a common time axis, explicit day units, and clearly stated populations. Default to median; allow mean and 90th percentile. Do not stack stage medians, since they are not additive.
- Show relevant payment or shipping counts beneath each period. The paid-to-shipped panel is visually primary; its shipping volume is visible alongside duration so the operator can assess speed and workload together.
- A period table supplies exact values, counts, coverage, and comparison changes. Selecting a period filters historical summaries and the order-timing table to the same interval and metric population. The current queue retains its all-date scope.
- Selecting a point exposes its date bounds, statistic, sample count, coverage, and partial-period label. Details are accessible by keyboard and touch, not only by hovering.
- Period-table and order-level CSV exports preserve the active date range, grouping or metric basis, statistic, units, and timezone. Export raw timestamps and unrounded duration seconds for order-level reconciliation.

### Order timings

- Separate current paid-waiting, current unpaid, historical payments, and historical shipments views.
- Sort by payment delay, fulfilment delay, total elapsed duration, or milestone date. Use order ID as a stable secondary sort key.
- Show current status, order identity, applicable milestone timestamps, stage durations, and total elapsed time. The order identifier opens the existing order page; a timeline detail presents the intervals without requiring navigation away.
- A missing future milestone shows a running wait with `so far`, not zero or a completed duration. Pending orders do not have a paid-to-shipped clock.
- The selected metric or chart period carries its basis into this table, so the operator can inspect exactly the contributing orders.

## Metric and population contract

Durations use elapsed UTC timestamp differences. One elapsed day equals 86,400 seconds, including weekends and public holidays. Local timezone rules only determine display and period boundaries. Store and calculate without rounding; round only display values.

| Metric | Calculation | Historical period membership |
| --- | --- | --- |
| Placed to paid | paid_at minus created_at | Payment confirmed within the selected interval |
| Paid to marked shipped | shipped_at minus paid_at | Marked shipped within the selected interval |
| Placed to marked shipped | shipped_at minus created_at | Marked shipped within the selected interval |
| Current payment wait | report time minus created_at | Currently pending, across all dates |
| Current fulfilment wait | report time minus paid_at | Currently paid/processing and not yet shipped, across all dates |
| Current total wait | report time minus created_at | Applicable current queue, across all dates |

This makes a payment confirmed this week part of this week's payment metric, even if shipping has not occurred. A shipment marked this week contributes to this week's fulfilment metric even if it was paid last month. The metric labels and sample counts explicitly distinguish these populations. This refines the initial sample mockup, whose three cards all used the same shipped-order population for illustration.

Use the same definitions for cards, charts, tables, exports, and comparisons. Mean is the arithmetic mean. Median and the 90th percentile use continuous linear interpolation, equivalent to PostgreSQL `percentile_cont(0.5)` and `percentile_cont(0.9)`. The prototype's nearest-rank illustration is superseded by this production definition.

Later cancellation/refund status does not erase an observed payment or shipment from historical duration metrics. Cancelled/refunded orders that never shipped have no completed shipping duration and are not part of the active fulfilment queue. Current status never substitutes for a missing timestamp. Reinstated orders use the recorded payment timestamp for their current payment cycle; placement remains the original order creation time, so the total customer wait is retained.

Validate endpoints for every metric: timestamps must be present, no later than the captured report time, and in the correct chronological order. Exclude invalid pairs from that metric and expose the excluded count. Do not clamp negative durations to zero or infer dates from `updated_at`, status, or automatic completion.

## Weekly/monthly comparisons

- Use Australia/Sydney to match existing admin reports. Convert local calendar boundaries into UTC half-open intervals, with daylight-saving transitions handled correctly.
- Create a continuous bucket sequence from the bucket containing the first existing order to the bucket containing the report time, intersected with the requested range. Do not fabricate earlier periods based on the migration date.
- An empty period shows zero milestone events and unavailable duration statistics, not zero-day fulfilment. A trend line has a gap at unavailable values.
- Current periods are visibly `In progress`. The first bucket is `History begins here` when recorded history starts after its boundary. Custom ranges that cut through buckets are labelled partial as well.
- Chart all available periods, including partial ones, but base the default improvement headline on the two most recent consecutive, fully elapsed and fully covered calendar periods. Do not silently skip an empty period to find a favorable comparison. When either adjacent period lacks valid observations, show that a comparison is unavailable.
- Show absolute duration change and relative percentage change: `(current - previous) / previous`. Shorter durations are labelled faster; longer durations slower. If the previous duration is zero, show only the absolute change. Always retain sample counts and flag fewer than 10 observations as a small sample.
- For this/month-to-date or this/week-to-date comparisons, the operator can explicitly select `Same point in previous period`. Compare each interval through the same local calendar position and wall-clock time, clipping to the previous period's end where it is shorter. Label these comparisons provisional; do not assert statistical significance or a cause.
- A month with the start of available history is not a complete historical comparator. Initially there may be no valid full-month comparison; the chart remains useful and displays the available periods honestly.

## Historical backfill and future freshness

Backfill means calculating the reporting history from all existing recorded milestones. The production audit shows that this release does not need to repair order timestamps or replay order operations.

Implement read-only aggregation over existing order records, covering the entire available history from the first release. Generate weekly and monthly summaries directly from those records. Do not add synthetic order events, dispatch records, or customer notifications to populate analytics.

The page uses a single captured report time for historical bounds and current wait calculations. Read it dynamically on page load, range/grouping changes, and a visible Refresh action; show an `Updated at` timestamp. Newly confirmed payments and shipments appear on the next refresh. No scheduled backfill, daily job, external analytics delivery, or persisted summary table is required for the initial data volume. The selected period is always calculated from its member orders; monthly percentiles must never be averages of weekly percentiles.

If a future audit reveals missing milestones, show coverage and exclusions first. Any evidence-based repair is a separate reviewed migration and must preserve provenance. Conflicting or ambiguous events never silently replace the authoritative order timestamps.

## Implementation boundaries

- Add the route, navigation entry, and command-palette discovery within the existing admin application. Extend existing shared admin patterns instead of introducing a separate reporting app.
- Introduce focused fulfilment analytics types and pure duration/period helpers. Keep the existing large reports module from becoming the home for unrelated page behavior.
- Use a service-role-only, read-only database aggregation RPC for summary, trend, and coverage calculations, with explicit range/grain/basis validation and one report-time value. Compute all-history bounds server-side. Charts receive aggregates, not every customer's order record.
- Use server-side pagination and deterministic sorting for the order-timing drilldown and export. Do not rely on the database API's default response cap; a history longer than 1,000 orders must still be complete.
- Every page, drilldown, and export retains `requireAdmin` and server-only database access. No service-role key, full customer dataset, or unnecessary customer fields are passed to client components.
- Reuse existing order detail/actions for operations. Analytics does not introduce a second path for changing payment, stock, shipping, or order state.

## Loading, empty, and error states

- Loading preserves the layout with skeletons. Failed reads show a retryable error, never an empty chart or a zero count presented as success.
- No orders at all shows an explicit empty history state; no eligible milestones within a selected period shows zero events and unavailable duration metrics.
- Invalid or missing timestamps show metric-specific coverage counts and a link to the affected orders. Unknown values remain visibly unknown in CSV exports as well.
- Keep the current queue distinct from history on desktop and mobile. Charts and controls reflow without clipping; the dense order table may scroll horizontally.

## Verification and release acceptance

1. A production read-only baseline and the implemented results reconcile for all-history order counts and eligible milestone counts at the same captured report time.
2. Weekly and monthly metrics cover all available records and use the documented endpoint-date basis. Events crossing a week/month boundary land in the correct bucket.
3. Month boundaries, Monday-start weeks, leap dates, Sydney DST changes, partial first/current periods, and custom boundaries are verified.
4. Median, mean, and interpolated percentiles are tested against known odd/even samples. Monthly results are computed from orders, not weekly summaries.
5. Missing, future, and reversed timestamps, legitimate zero-duration intervals, refunds after shipping, cancellation before shipping, and reinstatement are handled by the documented rules.
6. Current queues are independent of the historical range. Waiting clocks use the shared report time and stop at their actual milestones.
7. Partial/empty periods cannot produce misleading complete-period improvements. Zero-baseline and small-sample comparisons have explicit states.
8. Pagination/export verification includes more than 1,000 records and confirms no silent truncation or metric/table mismatch.
9. Browser verification covers weekly/monthly switching, all-history range, period drilldown, order timelines, current queues, comparison labels, keyboard access, and responsive layouts.
10. The release adds no order mutations or notification side effects. Migration privileges and admin authorization are tested before rollout.

## Audit baseline for reconciliation

The following aggregates were queried from production on 27 September 2026. They use recorded shipments grouped by shipping date in Australia/Sydney and include any later-refunded shipments. Durations are elapsed days, rounded here to four decimals. This snapshot is evidence for the design and a reconciliation example, not a fixture to hardcode into the app.

| Shipment period | Shipped orders | Median paid-to-shipped days | Mean days | 90th percentile days |
| --- | ---: | ---: | ---: | ---: |
| August 2026 — history starts 10 Aug | 48 | 0.5279 | 1.1543 | 3.0551 |
| September 2026 — in progress | 83 | 0.5549 | 1.3391 | 3.7576 |
| Week of 10 Aug — history starts here | 7 | 3.0551 | 3.1435 | 4.3384 |
| Week of 17 Aug | 23 | 0.2403 | 0.5459 | 1.6972 |
| Week of 24 Aug | 12 | 0.5279 | 0.6408 | 0.9778 |
| Week of 31 Aug | 14 | 1.1413 | 1.5542 | 2.9751 |
| Week of 7 Sep | 15 | 0.4822 | 1.5290 | 5.5775 |
| Week of 14 Sep | 23 | 0.4029 | 0.8785 | 2.2916 |
| Week of 21 Sep — in progress | 37 | 1.1923 | 1.6054 | 4.0551 |

## Deferred capabilities

Service targets, business-day clocks, carrier-confirmed delivery, satisfaction scoring, delay-reason attribution, staff rankings, notification automation, and speculative timestamp reconstruction are outside this release. They require additional definitions or evidence and are unnecessary for the user's chosen elapsed-time view.
