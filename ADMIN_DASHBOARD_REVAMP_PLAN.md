# Admin Dashboard & Experience Revamp Plan

> Status: **Phases 1 and 2 implemented (2026-09-02). Phases 3 and 4 remain proposals.**
> Not yet deployed — the Vercel project has no Git integration, so pushing does not publish.
> Shipped alongside this plan (2026-09-02): revenue chart period navigation (prev/next by month, calendar week, day; prior-period delta; URL-linkable; arrow keys). Files: `storefront/lib/admin/order-queries.ts` (`revenueWindow`), `storefront/app/admin/(dashboard)/revenue-actions.ts`, `storefront/components/admin/RevenueChart.tsx`, `storefront/app/admin/(dashboard)/page.tsx`.
> Precedent: `ADMIN_PRODUCTS_UX_PLAN.md` (implemented 2026-08-28). Same shape here: diagnosis, direction, phases with file targets.

## Diagnosis — the dashboard

1. **It is a status board, not a work surface.** Every tile is a count that links elsewhere. The operator reads it, then goes somewhere else to act. Nothing on the page can be *done* on the page.
2. **Revenue is the hero, but revenue is the wrong number for a sole provider.** Cost tracking exists (`lib/admin/costs.ts` → `profitSince(days)`) and is never rendered. Refunds, COGS, and cash not yet received (pending bank transfers) are invisible. The chart can now go back in time; profit still can't.
3. **No comparison, no trend beyond the chart.** "To fulfil: 0" is fine or alarming depending on whether yesterday was 6. Tiles have no sparkline, no delta, no "usual for a Tuesday".
4. **Signals are buried in prose.** "Idle 1h+ · recovery email queued hourly" is an explanation, not an affordance. Same smell the products plan identified: when the UI needs a sentence to explain itself, the structure is wrong.
5. **Recent activity is the raw audit log, unfiltered, eight rows.** It is the only read path for `admin_audit_log`; there is no page to go to when you want more.
6. **Everything loads in one `Promise.all` of eleven reads.** Good for consistency, but the page is all-or-nothing: one slow query stalls the whole first paint, and there is no per-section streaming.

## Diagnosis — the admin overall

From a page-by-page inventory (2026-09-02):

- **Three screens still gate destructive actions with native `confirm()`**: `OrderItemsPanel.tsx` (remove line, refund), `DiscountsManager.tsx` (delete), `CoaManager.tsx` (delete). `ConfirmModal.tsx` exists and is used elsewhere. Native dialogs are worse UX and block the browser test harness.
- **Orders has no date filter, no sort, no bulk actions, no export.** Products has export; orders doesn't. Search reloads the page rather than filtering live.
- **Customers is capped at 200 rows** (`slice(0, 200)`) with no pagination or "showing N of M". No export, no bulk tag/unsubscribe. `customer_profiles.tags` has no management UI.
- **Data that exists but is never aggregated anywhere:** `order_events` (time-to-ship, status funnel), `stock_movements` (store-wide shrinkage/adjustments), `email_events` (deliverability per template), `cart_sessions` (abandonment trend over time), `admin_audit_log` (who changed what), `sequence_overrides` (who is paused).
- **Cron-only operations have no operator view:** `payment-ops.ts` (unpaid reminders/expiry), `lifecycle.ts` (six sweep functions). The operator cannot see how many people sit in each lifecycle stage, nor trigger or inspect a sweep.
- **Entities don't link to each other.** COA batch → product/orders that shipped it; discount code → orders that used it; review → the order it came from; waitlist count → the actual people; customer → their audit trail. Each is a dead-end number.
- **Pipeline is read-only.** Flipping coming-soon → active means a detour into Products.
- **Manual order form has no customer lookup**, so phone orders don't attach to the customer record.
- **Recovery is fixed to a 30-day window.** Same "no time axis" problem the chart just had.

## Brainstorm — ideas considered

Grouped, roughly ordered by expected value. Starred items feed the phases below.

**Information design**
1. ★ **Action queue at the top.** "Needs you" list: paid orders to pack, bank transfers older than 24h, reviews pending, COA expiring, stock below threshold with waitlist demand. Each row has its one-click action inline (mark shipped, confirm payment, approve, reorder note).
2. ★ **Money strip: Revenue · Gross profit · Refunds · Cash owed.** Four numbers for the selected period, each with delta vs previous period, driven by the same `revenueWindow` machinery.
3. ★ **Sparkline + delta on every KPI tile.** 14-day mini trend and "vs last week" so a count has context.
4. Per-section streaming with `Suspense` so the action queue paints before the analytics.
5. Configurable dashboard: drag-to-reorder sections, hide what you don't use, persisted in `admin_settings`.

**Analytics & insight**
6. ★ **Profit chart** with a Revenue / Profit toggle on the existing chart; COGS from `order_items` cost columns.
7. ★ **Product performance table for the period:** units, revenue, margin, refund rate, waitlist demand — sortable, links to product.
8. **Funnel: carts → checkouts → paid → shipped**, with time-to-ship median from `order_events`.
9. **Email deliverability panel** from `email_events`: sent/delivered/opened/clicked/bounced per template and per lifecycle sequence.
10. **Customer cohorts:** first-order month × repeat rate, LTV distribution, segment counts over time.
11. **Compare mode** on the chart: overlay previous period as a ghost series.
12. **Custom date range picker** on the chart in addition to the scale stepper.

**Operator workflow**
13. ★ **Kill native `confirm()` everywhere**; one `ConfirmModal` pattern with the consequence spelled out ("Refund $89.00 to j@…, restock 1 vial").
14. ★ **Orders: date range, sort, bulk mark-shipped + bulk print slips, CSV export, live search.**
15. ★ **Customers: real pagination, export, bulk tag / unsubscribe, tag management.**
16. Manual order: customer autocomplete from `customers` so phone orders attach to the profile.
17. Pipeline: inline "Activate" status flip and signup trend per compound.
18. Recovery and lifecycle: period navigation (reuse the window helper) and a store-wide "who is in which stage" board.
19. "Open in new tab" and prev/next on order detail, matching the product editor.

**Proactive & automation**
20. ★ **Daily brief** (07:00 Sydney, email or Telegram): yesterday's revenue and profit vs the same weekday last week, orders to fulfil, unpaid transfers by age, stock that will run out within N days at current velocity, waitlist demand for out-of-stock SKUs.
21. **Anomaly nudges on the dashboard:** "No orders in 36h (usual gap: 9h)", "Bounce rate 8% this week vs 1% usual", "MT2 6-pack sells 1.2/day, 0 left, 5 waiting".
22. **Reorder suggestions:** velocity × lead time vs on-hand, per product, one click to create a note/task.
23. Operator-visible cron health: last run, items processed, failures, "run now" for payment-ops and lifecycle sweeps.

**Navigation & IA**
24. ★ **Audit log page** with actor/entity/date filters and a per-entity trail (linked from order, product, customer).
25. **Entity cross-links everywhere:** COA ↔ product ↔ orders, discount ↔ orders, review ↔ order ↔ customer, waitlist count → people.
26. Sidebar regrouping: *Today* (Dashboard, Orders), *Catalogue* (Products, Pipeline, COAs), *People* (Customers, Recovery, Reviews), *Growth* (Discounts, Emails), *System* (Settings, Audit).
27. ⌘K grows into a true command surface: "mark #1042 shipped", "refund last order for j@…", "go to August revenue".
28. Reports area (`/admin/reports`) to hold the heavier analytics so the dashboard stays a daily surface.

**Mobile & delight**
29. Mobile dashboard = action queue only, one thumb-width, swipe to mark shipped; charts collapse behind a tap.
30. Packing mode: full-screen next-order-to-pack flow with slip, items checklist, and "shipped + tracking" on one screen.
31. Subtle celebration on personal-best day/week (the chart already knows the previous window).
32. Keyboard everywhere: `g o` orders, `g p` products, `/` search, `j/k` row navigation in tables.

## Direction

The dashboard becomes **three stacked surfaces, in this order**: what needs me (action queue), how the business is doing (money strip + period-navigable chart with a profit toggle), and what changed (a filtered pulse, not a raw log). Heavy analytics move to a Reports area so the dashboard stays fast and daily. Across the admin: one confirmation pattern, one time-axis helper, links between every entity, and pagination where lists can grow.

Everything reuses what exists: `revenueWindow` for any period-scoped number, `ConfirmModal`, `StatCard`, `Badge`, the command palette, the cost columns already in the schema.

## Phase 1 — Dashboard as a work surface — IMPLEMENTED 2026-09-02

> Shipped: attention queue with inline confirm-payment / mark-shipped / publish-review;
> money strip (revenue, gross profit, refunds, owed) scoped to the chart's window with
> prior-period deltas; Revenue/Profit toggle with a zero baseline for negative buckets;
> sparklines on the three tiles that have real daily history; four sibling Suspense sections.
> New files: `storefront/lib/admin/attention.ts`, `storefront/components/admin/ActionQueue.tsx`.
> Decisions taken: profit is net revenue minus COGS only, because shipping cost and payment
> fees are not tracked; cash owed is unpaid orders raised in the window, any age.
> Caveat: only 47 of 134 order lines carry a cost snapshot, so profit is overstated until
> costs are set — the strip says so in place rather than hiding it.
> Not browser-verified: admin needs a live session and Interceptor is not installed here.

- **Action queue** section above the chart. Rows sourced from: orders `paid`/`processing`; `pending` bank transfers older than 24h (age shown); pending reviews; low-stock variants that also have waitlist demand. Inline actions call existing server actions (`orders/actions.ts`, `reviews/actions.ts`) with `ConfirmModal` where destructive.
  Files: `app/admin/(dashboard)/page.tsx`, new `components/admin/ActionQueue.tsx`, new `lib/admin/attention.ts`.
- **Money strip** replacing the Today / 7d / 30d footer: Revenue · Gross profit · Refunds · Cash owed for the *chart's current window*, each with delta. Extend `revenueWindow` to also return `profitCents`, `refundedCents`, `pendingCents` (one extra join on `order_items` cost + `refunded_cents` + `pending` orders).
  Files: `lib/admin/order-queries.ts`, `components/admin/RevenueChart.tsx`.
- **Profit toggle** on the chart (Revenue | Profit), same buckets.
- **Sparkline + delta** on the four KPI tiles: add a tiny 14-point series prop to `StatCard`.
- **Streaming**: wrap the analytics section in `Suspense` with the existing `Skeleton` so the queue paints first.

## Phase 2 — One confirmation pattern + list-page basics — IMPLEMENTED 2026-09-02

> Shipped: every native `confirm()` in the admin replaced with `ConfirmModal`, each naming
> its consequence; bulk mark-paid / mark-shipped now confirm too, and report partial failures
> separately instead of as a trailing clause. Orders gained a date range with presets, sortable
> columns, debounced live search and CSV export, all URL-driven and all carried by the export.
> Customers gained real pagination with "showing N of M", CSV export, and bulk tag /
> marketing-suppression. ECL-1042's missing refund amount was corrected.
> New files: `storefront/lib/csv.ts`, `storefront/components/admin/{OrdersFilters,CustomersTable}.tsx`,
> `storefront/app/admin/(dashboard)/{orders,customers}/export/route.ts`.
> Not browser-verified: admin needs a live session and Interceptor is not installed here.

- Replace `confirm()` in `OrderItemsPanel.tsx`, `DiscountsManager.tsx`, `CoaManager.tsx` with `ConfirmModal`, with consequence copy.
- Orders: `?from=&to=` date range (reuse the calendar helpers), column sort, bulk select → mark shipped / print slips, CSV export route mirroring `products/export/route.ts`, live search via `router.replace` (products already does this).
- Customers: real pagination (`range()` + page param), export, bulk tag/unsubscribe, tag editor on the profile.
  Files: `app/admin/(dashboard)/orders/*`, `components/admin/OrdersTable.tsx`, `app/admin/(dashboard)/customers/*`, `lib/admin/people.ts`.

## Phase 3 — Links, audit, and proactive signals (~2 days)

- **Audit log page** at `/admin/audit` with actor/entity/date filters; per-entity trail component embedded on order, product, and customer pages. Add to `NAV` under a *System* group.
- **Cross-links**: COA batch → product + orders; discount → orders using it (count on the discounts table); review → order/customer; waitlist count → filtered customers list; manual order → customer autocomplete.
- **Anomaly nudges** on the dashboard (order gap, bounce rate, stock-out with demand, unpaid > 3 days), computed in `lib/admin/attention.ts` from `order_events`, `email_events`, `stock_movements`.
- **Daily brief** as a cron (`app/api/cron/daily-brief/route.ts`) rendering the same attention + money data to email via the existing outbox; optional Telegram.
- **Cron health** card on Settings: last run and counts for each cron route (write a `cron_runs` row per invocation).

## Phase 4 — Reports area and polish (~2 days)

- `/admin/reports` with: product performance for a period, cart → paid → shipped funnel with time-to-ship, email deliverability per template/sequence, customer cohorts. All period-navigable with the same stepper component (extract `PeriodNav` from `RevenueChart`).
- Recovery and lifecycle get period navigation and a stage board.
- Sidebar regrouping, ⌘K verbs, keyboard shortcuts, packing mode, mobile action queue.

## Decisions to make before starting

1. **Profit definition**: gross (revenue − COGS) only, or also minus shipping cost and payment fees? Fees aren't tracked today.
2. **Cash owed**: count `pending` bank-transfer orders of any age, or only those under the expiry window `payment-ops.ts` enforces?
3. **Daily brief channel**: email via outbox (exists) vs Telegram (needs a bot token).
4. **Reports as separate area vs tabs on the dashboard.** This plan says separate, to keep the dashboard fast.

## Verification constraints

Admin routes require a real Supabase session and the Interceptor CLI is not installed, so browser verification has to happen on the operator's machine. Each phase should ship with `bunx tsc --noEmit`, a full build, and bun probes of new query functions, and say plainly what was and wasn't seen in a browser.
