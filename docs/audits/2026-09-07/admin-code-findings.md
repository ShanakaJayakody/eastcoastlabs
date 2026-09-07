# East Coast Labs — admin audit (read-only, 2026-09-07)

Scope: current source in `/Users/shanakajayakody/eastcoastlabs/storefront`, including admin pages/components/services and relevant checked-in migrations. Reviewed the existing admin dashboard/products/customer plans as context, then verified implementation. No code/live data changed; no customer data or secrets read; no browser, DB mutation, cron or email invoked. No applicable AGENTS.md found in workspace or its ancestors. Findings below are static code findings, not claims of observed production incidents. Effort is engineering time including focused verification, not a delivery commitment.

## What is already good — retain and extend

- Request-scoped admin authentication cache and active allowlist: [lib/admin/auth.ts:28](</Users/shanakajayakody/eastcoastlabs/storefront/lib/admin/auth.ts:28>) and `:60`; mutation entry points normally call requireAdmin.
- Dashboard is already an action surface with independent Suspense boundaries: [app/admin/(dashboard)/page.tsx:64](</Users/shanakajayakody/eastcoastlabs/storefront/app/admin/(dashboard)/page.tsx:64>); money periods, revenue/profit, anomaly nudges and reports exist. Do not propose building these from scratch.
- Grouped shared sidebar/command navigation exists: [lib/admin/nav.ts:23](</Users/shanakajayakody/eastcoastlabs/storefront/lib/admin/nav.ts:23>)–51.
- Orders already have server pagination, date/search/sort/export, bulk payment/shipping/reinstatement, print slips, packing mode, keyboard navigation. See [lib/admin/order-queries.ts:73](</Users/shanakajayakody/eastcoastlabs/storefront/lib/admin/order-queries.ts:73>), [components/admin/OrdersFilters.tsx:72](</Users/shanakajayakody/eastcoastlabs/storefront/components/admin/OrdersFilters.tsx:72>), [components/admin/OrdersTable.tsx:158](</Users/shanakajayakody/eastcoastlabs/storefront/components/admin/OrdersTable.tsx:158>), [components/admin/PackingMode.tsx:80](</Users/shanakajayakody/eastcoastlabs/storefront/components/admin/PackingMode.tsx:80>).
- Product-per-row table, shared vial pool, stock drawer, status/filter/sort, unified details/pricing save, media, SEO preview, duplication and launch tier creation exist. Avoid repeating the 2026-08-28 redesign.
- Inventory reservation itself is atomic ([supabase/migrations/20260724110000_commerce.sql:111](</Users/shanakajayakody/eastcoastlabs/storefront/supabase/migrations/20260724110000_commerce.sql:111>)); movement-trigger inventory derivation and frozen sales COGS are sound foundations. The gap is transaction boundaries around multi-step business operations.
- Customer 360, notes, tags, segments, suppression, sequence pause/resume/skip/send-now, email outcomes and audit trails exist. Reports explicitly page full reads with unique-order guidance ([lib/admin/reports.ts:22](</Users/shanakajayakody/eastcoastlabs/storefront/lib/admin/reports.ts:22>)), unlike several older read paths.
- Cron health and email previews already exist. They need stronger operations workflows, not replacement.

## Prioritised findings

### A01 — P1, confirmed code risk: order/stock operations lack an atomic commit and ignore write errors

Evidence: [lib/admin/orders.ts:331](</Users/shanakajayakody/eastcoastlabs/storefront/lib/admin/orders.ts:331>)–362 reads stock_settled, appends sale movements/releases reservations, then updates the order without inspecting the update error. `:394` similarly ignores the status write result, then creates status/email/audit events. Partial refund uses read-then-absolute-write at `:777`–786, with an incorrect assumption that one admin action guarantees no concurrency. [lib/admin/inventory.ts:95](</Users/shanakajayakody/eastcoastlabs/storefront/lib/admin/inventory.ts:95>) inserts movement rows; schema [supabase/migrations/20260724110000_commerce.sql:78](</Users/shanakajayakody/eastcoastlabs/storefront/supabase/migrations/20260724110000_commerce.sql:78>) gives those rows independent UUIDs, no operation-level dedupe.

Impact: two tabs/admins/retries can settle the same stock twice; failure midway can leave a pending order with stock removed, or an audit/dispatch email describing a transition that failed. A successful toast is not proof of business commit.

Recommendation: one DB transaction/RPC per transition with order row lock, allowed-source-status predicate, operation idempotency key, stock/reservation/refund/event writes and durable outbox intent committed together. Check all PostgREST errors in the interim. Keep network email delivery after commit.

Validate: parallel mark-paid calls produce one movement set; injected failure after first line leaves no partial stock/order state; competing cancel/pay and two partial refunds preserve stock and money invariants; failed status writes cannot send dispatch emails. Effort: 4–7 days (foundational).

### A02 — P1, confirmed: full refund or cancellation after a partial refund restores stock twice

Evidence: partial refund restores r.qty at [lib/admin/orders.ts:790](</Users/shanakajayakody/eastcoastlabs/storefront/lib/admin/orders.ts:790>)–799, but only marks stock_restored when fully refunded at `:825`. Full refund loops original orderItems qty at `:676`–680; cancellation uses original qty at `:465`–468. Full refund remains reachable from paid/processing/shipped after a partial refund.

Impact: order of 3 vials, refund 1, then refund remainder via full-order button: stock gains 1 + 3, although only 3 were sold. A paid cancellation after a partial refund has the same excess restoration.

Recommendation: restore only each line's unreturned quantity with explicit returned/restocked quantities, sharing one routine across partial/full/cancel. Distinguish returning money from physically restocking a returned item.

Validate: 3 sold → partial 1 → full 2 restores exactly 3; partial then cancel; mixed pack tiers sharing a pool; repeated/retried operation. Effort: 1–2 days after A01.

### A03 — P1, confirmed: refund accounting ignores order discounts and final shipping delta

Evidence: discount is stored at order level ([lib/admin/orders.ts:170](</Users/shanakajayakody/eastcoastlabs/storefront/lib/admin/orders.ts:170>)–198); line prices stay undiscounted (`:218`–220). Partial refunds compute raw unit_price × qty (`:774`) and accumulate that value (`:816`–818). Completing the last line forces order.refunded_cents to total_cents, but the returned/refund-email amount remains the raw line amount (`:830`–842; [app/admin/(dashboard)/orders/actions.ts:289](</Users/shanakajayakody/eastcoastlabs/storefront/app/admin/(dashboard)/orders/actions.ts:289>)). UI preview uses the same raw amount ([components/admin/OrderItemsPanel.tsx:64](</Users/shanakajayakody/eastcoastlabs/storefront/components/admin/OrderItemsPanel.tsx:64>)).

Impact: discounted items can be over-refunded; heavily discounted mixed orders can record more refunded than paid before the last line. The final refund toast/email can disagree with the shipping-inclusive adjustment actually recorded on the order.

Recommendation: snapshot deterministic per-line allocation of order discounts, model shipping refunds explicitly, calculate remaining refundable balance and return actual incremental refund value. One server quote should drive modal, persisted ledger and email.

Validate: percent and fixed order discounts, odd-cent allocation, partial then final refund with shipping, free gift, zero-cost accessory, sum of recorded refunds never above amount paid. Effort: 2–3 days.

### A04 — P1, confirmed: printed packing slips still include refunded quantities

Evidence: [components/admin/PackingSlip.tsx:69](</Users/shanakajayakody/eastcoastlabs/storefront/components/admin/PackingSlip.tsx:69>) maps all order.items and prints original it.qty at `:79`. In contrast [components/admin/PackingMode.tsx:91](</Users/shanakajayakody/eastcoastlabs/storefront/components/admin/PackingMode.tsx:91>) filters refunded lines and `:171` subtracts refundedQty. Both single and bulk print routes use PackingSlip.

Impact: an operator following the printed slip can ship an item already refunded; two fulfilment surfaces show different quantities.

Recommendation: produce one fulfilment projection shared by packing UI and print, using remaining shippable quantities and clear refund annotations. Separate merchandise accounting totals from quantities to pack.

Validate: fully refunded line disappears from pick quantities; partly refunded line prints remainder; mixed refunded/gift lines; print and screen match. Effort: 0.5–1 day.

### A05 — P1, confirmed: packing slips infer a batch/COA from latest fuzzy name match

Evidence: [lib/admin/slips.ts:12](</Users/shanakajayakody/eastcoastlabs/storefront/lib/admin/slips.ts:12>) sorts by latest test_date, `:17`–21 matches product/compound by equality or either substring and takes the first match. [app/admin/(print)/orders/[id]/slip/page.tsx:18](</Users/shanakajayakody/eastcoastlabs/storefront/app/admin/(print)/orders/[id]/slip/page.tsx:18>)–19 computes this again every print; [components/admin/PackingSlip.tsx:63](</Users/shanakajayakody/eastcoastlabs/storefront/components/admin/PackingSlip.tsx:63>) labels it Batch / COA. No batch allocation appears in order_items schema or packing controls inspected.

Impact: a parcel can be labelled with a newer or similarly named compound's batch rather than the stock actually picked. Reprinting an old order after a new COA is published can change its purported batch.

Recommendation: explicit inventory lot/batch receipts and fulfilment allocation; snapshot shipped batch IDs per order line. Until available, label this as a general latest published certificate rather than parcel batch evidence; avoid fuzzy identity matching.

Validate: two simultaneous batches of same product, similar compound names, split batches on one line; old slip unchanged after new certificate. Effort: 3–6 days for lot allocation; 0.5 day truthful interim label.

### A06 — P1, confirmed: operator stop/suppression promises do not cover queued/failed email

Evidence: pause only writes sequence_overrides ([app/admin/(dashboard)/customers/actions.ts:47](</Users/shanakajayakody/eastcoastlabs/storefront/app/admin/(dashboard)/customers/actions.ts:47>)–52), suppress only writes subscribers (`:273`–278), stop recovery changes cart status (`:190`–194). Yet UI says “No further touches will send while paused” ([components/admin/CustomerControls.tsx:169](</Users/shanakajayakody/eastcoastlabs/storefront/components/admin/CustomerControls.tsx:169>)). [lib/email/sender.ts:94](</Users/shanakajayakody/eastcoastlabs/storefront/lib/email/sender.ts:94>)–118 drains queued and failed rows without rechecking suppression, pause or cart status; sendImmediately (`:69`–78) does not even require a queued/failed status.

Impact: an already queued or failed marketing email can send after operator pause/suppress/stop. Retrying with a stale UI can attempt to send a row that is now cancelled. Operators cannot rely on the controls' stated outcome.

Recommendation: enforce current eligibility at send time, cancel pending marketing outbox on suppression/terminal stop, revalidate selected-stage intent, atomically claim sendable rows. Preserve transactional-email exemptions. UI should state exactly whether already in-flight messages can be stopped.

Validate: queue/fail marketing → pause/suppress/stop → drain sends none; stale retry on cancelled row sends none; transaction confirmations still send; race cancel vs claim has deterministic result. Effort: 2–3 days (coordinate with backend audit).

### A07 — P2, confirmed: full-order destructive actions bypass the shared confirmation flow

Evidence: [components/admin/OrderActions.tsx:165](</Users/shanakajayakody/eastcoastlabs/storefront/components/admin/OrderActions.tsx:165>) calls refund immediately; `:173` calls cancel immediately. Its refund success says “Refunded — stock restored”; unlike line refund modal ([components/admin/OrderItemsPanel.tsx:213](</Users/shanakajayakody/eastcoastlabs/storefront/components/admin/OrderItemsPanel.tsx:213>)), it does not explain that money must be sent separately. Pending orders are also shown Refund (`:161`), although pending→refunded is rejected by [lib/admin/orders.ts:39](</Users/shanakajayakody/eastcoastlabs/storefront/lib/admin/orders.ts:39>).

Impact: one accidental click changes refund/cancellation records and stock; the operator may interpret a bookkeeping action as money having been returned. The primary refund button also presents an action that can only fail on pending orders.

Recommendation: reuse a corrected accessible ConfirmModal with order identity, actual remaining amount, physical restock choice, customer-email consequence, and “Record refund” language; show only allowed actions. Model refund payment completion/reference separately when manual bank transfer is required.

Validate: no mutation before confirm, cancel leaves state unchanged, pending order has no invalid refund action, confirmation/copy match actual bank-independent behaviour. Effort: 1–2 days.

### A08 — P2, confirmed: image or inventory updates silently discard dirty product edits

Evidence: [components/admin/ProductEditor.tsx:82](</Users/shanakajayakody/eastcoastlabs/storefront/components/admin/ProductEditor.tsx:82>) recomputes initial on product prop identity, `:101` unconditionally setForm(initial). Images upload/remove/reorder call router.refresh ([components/admin/ProductImages.tsx:34](</Users/shanakajayakody/eastcoastlabs/storefront/components/admin/ProductImages.tsx:34>), `:44`, `:57`); stock adjustment refreshes ([components/admin/StockDrawer.tsx:122](</Users/shanakajayakody/eastcoastlabs/storefront/components/admin/StockDrawer.tsx:122>)). ProductEditor guard at `:105` only handles beforeunload, while header links use client-side Link (`:189`, `:203`).

Impact: edit description/prices, then upload an image or receive stock: refreshed props replace the unsaved edit buffer. Internal product navigation also bypasses the page-unload guard.

Recommendation: preserve draft fields across same-product refresh; track saved baseline/version separately and merge only changed server-owned media/inventory fields. Add dirty-navigation protection or explicit save/discard for internal navigation. Avoid sending every field unnecessarily on save.

Validate: description + media upload, price + stock receipt, cost edit + details draft; back/next/sidebar navigation; save after concurrent edit surfaces conflict rather than overwriting. Effort: 1–2 days.

### A09 — P2, confirmed: “save all” can publish only part of product or settings changes

Evidence: [app/admin/(dashboard)/products/actions.ts:165](</Users/shanakajayakody/eastcoastlabs/storefront/app/admin/(dashboard)/products/actions.ts:165>) labels save atomic, but `:182` updates product/status before sequential variant price and threshold writes. Failure later leaves earlier writes committed. Settings similarly runs ~20 separate putSetting calls ([app/admin/(dashboard)/settings/actions.ts:73](</Users/shanakajayakody/eastcoastlabs/storefront/app/admin/(dashboard)/settings/actions.ts:73>)–91), each independently upserts ([lib/settings.ts:133](</Users/shanakajayakody/eastcoastlabs/storefront/lib/settings.ts:133>)).

Impact: “Save failed” can still mean live title/status changed or some pack prices repriced. Payment methods/settings can be left in an intermediate configuration; audit/revalidation only happens after all writes. Retrying does not tell the operator what already changed.

Recommendation: schema validation first, one transactional product/settings update with optimistic version check and one audit diff; stage publishable changes until validation passes. If partial bulk operations are intentional, return an explicit per-item result instead of claiming atomicity.

Validate: reject/fail a middle variant/setting update and confirm nothing changes; concurrent settings saves do not silently overwrite; successful save changes all fields and audit exactly once. Effort: 2–3 days.

### A10 — P2, confirmed: settings allow malformed shipping rates and invalid hold windows

Evidence: [app/admin/(dashboard)/settings/actions.ts:41](</Users/shanakajayakody/eastcoastlabs/storefront/app/admin/(dashboard)/settings/actions.ts:41>)–70 validates free-shipping/gift/expiry, but not standardShippingCents, expressShippingCents or expressFreeThreshold before persisting (`:88`–91). paymentWindowHours is only compared to expiry (`:66`) with no finite/nonnegative check. Client money sanitiser ([components/admin/SettingsForm.tsx:72](</Users/shanakajayakody/eastcoastlabs/storefront/components/admin/SettingsForm.tsx:72>)) permits multiple decimal points; save converts with Number (`:61`–64).

Impact: ordinary mistyping such as “12..50” becomes NaN/null-like serialized data; invalid configuration can persist and be interpreted by downstream defaults. The save contract does not guarantee usable checkout/shipping numbers.

Recommendation: runtime schema validation at action boundary: finite bounded integers for cents, meaningful finite thresholds/window, required account names where used; field-specific errors and normalised currency inputs.

Validate: empty, multi-dot, NaN, Infinity, negative, fractional cents, expiry<hold, valid zero/free settings; invalid save writes nothing. Effort: 0.5–1 day.

### A11 — P2, confirmed source limits: People and several counts can silently omit data

Evidence: [lib/admin/people.ts:70](</Users/shanakajayakody/eastcoastlabs/storefront/lib/admin/people.ts:70>) explicitly caps customer source at 1,000; cart/subscriber reads (`:71`–75) are unpaged; segments/search/export operate on this result. Customers UI only slices in memory ([app/admin/(dashboard)/customers/page.tsx:44](</Users/shanakajayakody/eastcoastlabs/storefront/app/admin/(dashboard)/customers/page.tsx:44>)–49) but labels full totals (`:82`–86). [lib/admin/order-queries.ts:128](</Users/shanakajayakody/eastcoastlabs/storefront/lib/admin/order-queries.ts:128>) unpaged status rows derives all counts. Recovery list has limit(50) ([lib/admin/cart-recovery.ts:184](</Users/shanakajayakody/eastcoastlabs/storefront/lib/admin/cart-recovery.ts:184>)) with no pagination/count visible in recovery page. Project max-row setting was not queried; unpaged queries are potentially capped by its configured limit.

Impact: low-LTV/new customers become unfindable/export-incomplete after 1,000; segment thresholds/counts skew; order badge totals can disagree with exact list counts; older recovery work cannot be reached. Newest recovery carts sort first and can crowd out older actionable work.

Recommendation: one DB people/segment view with exact filtered count, indexed server search and stable pagination; aggregate counts in SQL, page reports/exports explicitly; expose “showing N of M” and older recovery pages. Fail visibly rather than silently treating read error as no data.

Validate: fixtures with >1,000 purchasers/subscribers/orders and >50 recoverable carts; search last row; full export cardinality; list/segment/count parity; tie-stable sort. Effort: 2–4 days.

### A12 — P2, confirmed: recovery date navigation changes metrics but not the listed carts

Evidence: range passed to metrics/funnel but listCartsFor(tab, 50) gets none ([app/admin/(dashboard)/recovery/page.tsx:40](</Users/shanakajayakody/eastcoastlabs/storefront/app/admin/(dashboard)/recovery/page.tsx:40>)–46). Tab hrefs at `:179` discard scale/at; empty recovered copy at `:196` claims “in this window”. Default PeriodNav uses calendar title while a separate note explains rolling 30 days (`:85`–93).

Impact: selecting an old month can show current/recent recovered cards underneath historical metrics; switching tab unexpectedly resets the period. Operator cannot reconcile rows with report totals.

Recommendation: explicitly separate current-work queue from historical results; filter recovered/expired list by selected period using appropriate event timestamp, preserve period query across tabs, make rolling/calendar selection one coherent control.

Validate: choose August→Recovered→Expired retains August and only eligible historical rows; no-period label exactly describes rolling 30 days; current queue clearly labelled independent of date. Effort: 0.5–1 day.

### A13 — P2, confirmed: “revenue recovered” counts unpaid/refunded order totals; funnel mixes units

Evidence: checkout marks cart recovered immediately after payment instructions ([app/(store)/checkout/actions.ts:220](</Users/shanakajayakody/eastcoastlabs/storefront/app/(store)/checkout/actions.ts:220>)), before payment. [lib/admin/cart-recovery.ts:253](</Users/shanakajayakody/eastcoastlabs/storefront/lib/admin/cart-recovery.ts:253>) sums linked order.total_cents with no paid-status/refund filter. Funnel sent is number of emails (`:290`–298), recovered is number of carts created in same date range regardless of exposure (`:317`–325), and UI computes every stage as percent of sent ([app/admin/(dashboard)/recovery/page.tsx:154](</Users/shanakajayakody/eastcoastlabs/storefront/app/admin/(dashboard)/recovery/page.tsx:154>)–161). captureCart overwrites one row per email ([lib/admin/cart-recovery.ts:36](</Users/shanakajayakody/eastcoastlabs/storefront/lib/admin/cart-recovery.ts:36>)–47), retaining an old created_at across new episodes.

Impact: pending bank transfers and refunded purchases look like recovered revenue, spontaneous conversions appear as email outcomes, repeated carts cannot support trustworthy period/cohort attribution. This is a measurement issue, not evidence that marketing is ineffective.

Recommendation: separate checkout resumed, payment received and net recovered revenue; immutable cart/recovery episode ID with captured/recovered/paid timestamps, distinct exposed-cart conversion cohort and separate email-delivery funnel. Show attribution definition in context.

Validate: unpaid, paid, partial/full refund, organic recovery without email, three touches per cart, repeated cart episode across months, delayed payment after reporting window. Effort: 2–4 days.

### A14 — P2, confirmed: costed inventory “Undo” reverses units but not the cost basis

Evidence: stock receipt updates weighted average and receipt cost ([app/admin/(dashboard)/products/actions.ts:260](</Users/shanakajayakody/eastcoastlabs/storefront/app/admin/(dashboard)/products/actions.ts:260>)–269). Toast Undo only posts inverse delta as reason recount, no receipt link/cost reversal ([components/admin/StockDrawer.tsx:105](</Users/shanakajayakody/eastcoastlabs/storefront/components/admin/StockDrawer.tsx:105>)–114). Back-in-stock notification has already been queued on availability transition ([lib/admin/products.ts:617](</Users/shanakajayakody/eastcoastlabs/storefront/lib/admin/products.ts:617>)–620).

Impact: accidentally entering a high supplier cost then Undo leaves future COGS inflated even though quantity appears restored. “Reverted” overstates what was undone; already-triggered restock alerts cannot be unsent. tagMovementCost selects latest receipt rather than returned movement ID ([lib/admin/costs.ts:63](</Users/shanakajayakody/eastcoastlabs/storefront/lib/admin/costs.ts:63>)–75), also vulnerable to competing receipts.

Recommendation: return receipt/movement ID, use auditable receipt reversal with linked valuation correction and explicit notification state; label quantity-only correction accurately until that exists. Combine receipt quantity and valuation in one transaction.

Validate: receive at different cost then reverse returns pre-receipt units and valuation; two simultaneous receipts retain correct unit prices; after subsequent sale provide controlled correction rather than silent rewind. Effort: 1–2 days.

### A15 — P2, confirmed: bulk-operation failure details are discarded

Evidence: bulk payment/shipping returns failed order identifiers ([app/admin/(dashboard)/orders/actions.ts:199](</Users/shanakajayakody/eastcoastlabs/storefront/app/admin/(dashboard)/orders/actions.ts:199>)–208) but OrdersTable shows only count and says “open them individually” then clears selection ([components/admin/OrdersTable.tsx:165](</Users/shanakajayakody/eastcoastlabs/storefront/components/admin/OrdersTable.tsx:165>)–171, `:185`–191). Reinstate returns per-id error but UI similarly discards it (`:208`–214).

Impact: after a large partial batch, the operator has no durable list of which orders need attention or why; clearing selection removes the work context. Repeating the whole batch increases reliance on correct idempotency.

Recommendation: persistent per-order results panel with reason and order link, retain only failed selections, offer retry failed after refresh. Use the same contract for product bulk updates, which currently stop on first exception after prior rows may have committed.

Validate: mixed five-order batch with two known failures shows exact successful/failed identities, preserves two failures, retry applies only those; navigation/back retains result until acknowledged. Effort: 0.5–1 day.

### A16 — P2, confirmed code accessibility gap: modal declares modal semantics without focus containment

Evidence: [components/admin/ConfirmModal.tsx:27](</Users/shanakajayakody/eastcoastlabs/storefront/components/admin/ConfirmModal.tsx:27>) focuses confirm, `:31` only handles Escape, `:55` declares role=dialog/aria-modal. No tab trap, inert background or trigger-focus restoration appears. Default focus is on destructive confirm as well. StockDrawer implements only Escape ([components/admin/StockDrawer.tsx:69](</Users/shanakajayakody/eastcoastlabs/storefront/components/admin/StockDrawer.tsx:69>)–76); similar pattern should be audited across palette/mobile drawer.

Impact: keyboard users can tab behind a blocking dialog and focus is lost after close; initial Enter can immediately accept a destructive choice. Accessibility semantics and real interaction differ.

Recommendation: shared tested dialog primitive/native dialog with focus containment/restoration, background inertness, description association and deliberate least-destructive initial focus. Preserve pending-state dismissal lock.

Validate: keyboard-only Tab/Shift+Tab cycles in dialog, Escape restores trigger, background unusable while open, screen-reader name/description announced, pending confirmation cannot dismiss. Effort: 1–2 days across shared surfaces; browser verification needed.

### A17 — P2, workflow proposal with confirmed constraints: fulfilment needs tracking correction and reconciliation

Evidence: bulk ship has no tracking input and queues tracking_number:null ([app/admin/(dashboard)/orders/actions.ts:185](</Users/shanakajayakody/eastcoastlabs/storefront/app/admin/(dashboard)/orders/actions.ts:185>)–194); order detail exposes tracking only while paid/processing ([components/admin/OrderActions.tsx:133](</Users/shanakajayakody/eastcoastlabs/storefront/components/admin/OrderActions.tsx:133>)). Status writes assign tracking only when transitioning to shipped ([lib/admin/orders.ts:390](</Users/shanakajayakody/eastcoastlabs/storefront/lib/admin/orders.ts:390>)); shipped→shipped is not allowed (`:42`). No independent tracking correction action found.

Impact: once bulk shipped without tracking, or after a typo, the normal workflow cannot add/correct it. Staff need off-workflow data edits or customer messages. Automatic completed after ten days ([lib/admin/orders.ts:412](</Users/shanakajayakody/eastcoastlabs/storefront/lib/admin/orders.ts:412>)) is age-based, not carrier delivery confirmation.

Recommendation: add audited edit/add tracking with explicit notification choice, carrier link/validation and CSV paste/import for batch tracking. Keep dispatch, delivered and exception status conceptually separate; use “assumed complete” label if retaining age-only completion. Packing mode already exists—extend it.

Validate: ship→add/correct tracking without changing shipped_at or duplicate sale; batch partial-validation results; customer receives correction only when chosen; age-based completion visible in history. Effort: 1–3 days; carrier integration separately scoped.

### A18 — P3, product proposal: create one operator-facing automation work area

Evidence: Emails is only template preview ([app/admin/(dashboard)/email-templates/page.tsx:8](</Users/shanakajayakody/eastcoastlabs/storefront/app/admin/(dashboard)/email-templates/page.tsx:8>)–20), cron health is read-only under Settings ([components/admin/CronHealth.tsx:29](</Users/shanakajayakody/eastcoastlabs/storefront/components/admin/CronHealth.tsx:29>)–54), per-person controls already exist ([components/admin/CustomerControls.tsx:110](</Users/shanakajayakody/eastcoastlabs/storefront/components/admin/CustomerControls.tsx:110>)), admin roster requires direct table editing ([components/admin/SettingsForm.tsx:324](</Users/shanakajayakody/eastcoastlabs/storefront/components/admin/SettingsForm.tsx:324>)). No global stage workload/actionable failed-outbox screen or global sequence controls in inspected settings.

Impact: finding a failed automation/send requires knowing the person or visiting separate settings/reports/templates; recovery from outages depends on technical context. Existing plan's “all deferred closed” should not be treated as evidence these capabilities exist.

Recommendation: reuse current cron_runs, email_outbox, sequence derivation and reports for an Automation area: failed sends with safe retry, pending queue age, paused sequence counts, last successful run/duration and readable error detail. Add authenticated controlled run-now/global pause only after A01/A06 send idempotency fixes. Keep admin access management a separate small future enhancement if staff expansion warrants roles.

Validate: operator can locate failed/overdue job, inspect affected messages, retry only selected eligible items and see durable outcome, without database/tool knowledge. Effort: 2–4 days; optional roles/access management 2–3 days separately.

## Recommended order and practical validation

1. First protect operations: A01–A07, then accurate refund-aware slips and batch truth. These are higher-value than another visual dashboard revamp.
2. Fix everyday editing and consistency: A08–A12, A14–A16. Reuse existing components and server utilities.
3. Make reporting and operations trustworthy: A13, A17–A18; instrument route/query latency and result counts before deciding on caches/materialised views.

For a full operator browser pass, use non-production fixtures and complete five scenarios: bank payment→pack→tracking; partial refund→full refund; edit details→upload→stock receipt→save; locate low-LTV customer past first 1,000→suppress queued marketing; inspect historical recovery→retry failed send. Check desktop and narrow/mobile viewport, keyboard-only flow, refresh/back and two simultaneous admin sessions. Do not mutate live customer orders to prove an audit.

The old plans contain explicit outstanding browser verification caveats and some completion claims that current code does not support (for example customer data cap, cross-entity COA tracing, and fully consistent confirmations). No load timing, actual database row count/configuration, production incident frequency, authentication session, or live visual usability was measured in this sub-audit. Root agent owns any browser evidence. All files above are relative to `/Users/shanakajayakody/eastcoastlabs/storefront`.
