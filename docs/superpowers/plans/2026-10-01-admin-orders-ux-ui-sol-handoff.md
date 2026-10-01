# Admin Orders UX/UI Implementation Plan — GPT-5.6 Sol Handoff

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task by task in the receiving task. Steps use checkbox (`- [ ]`) syntax for tracking. The intended executor is GPT-5.6 Sol. Do not create additional tasks, change models, or delegate unless the user explicitly requests it or applicable execution instructions require it.

**Goal:** Improve ECL's production admin orders experience with a compact, readable work queue, reliable task views, visible shipping and elapsed-time information, a contextual order drawer, and selection-aware packing, while preserving existing commerce operations.

**Architecture:** Keep Next.js server rendering and existing admin authorization. Add a read-only orders workspace query that supplies the list and its scoped counts, with shared query semantics for exports. Keep list/filter state in the URL, presentation preferences in per-admin browser storage, and order mutations in the existing server actions. The drawer is a client presentation of an authenticated, minimal order preview; the established packing and full-order pages remain available.

**Tech Stack:** Next.js 15.5.x App Router, React 19, TypeScript, Tailwind 4, Supabase PostgreSQL, Lucide, Sonner, Vitest/Testing Library, PGlite, existing Playwright/Vite fixtures. Repository engine requirement: Node `>=22.12.0 <23`; package manager `npm@10.9.8`.

**Spec:** The embedded [Design contract](#2-design-contract) is the specification for this plan. It incorporates the user's orders-page brainstorming request and the recommended table-plus-drawer direction. Earlier admin-revamp and fulfilment documents are supporting context, not authorization to implement other areas or deploy.

**Execution status:** Local implementation and independent review are complete on `codex/admin-orders-workspace`, tested code commit `1f706bf`. Consult the execution ledger before doing work; do not restart completed tasks. Three minor deviations remain recorded, and real authenticated Next acceptance plus native browser zoom are outstanding gates. See [implementation evidence](../../admin-orders/2026-10-01-implementation-evidence.md). Nothing was merged, pushed, deployed or migrated remotely. The original plan was written on 1 October 2026; production deployment still requires separate authorization.

## Global constraints

- Scope is `/admin/orders` and the minimum supporting order-detail, packing, export, and test changes. Do not redesign the whole admin or storefront.
- Preserve all existing payment, inventory, stock-lot, refund, cancellation, reinstatement, deletion, audit, and email effects. Reuse the current server actions and transactional commerce functions.
- Every new server entry point must authorize the admin before reading customer/order data. Read helpers stay server-only. New SQL functions are executable by `service_role` only.
- Use elapsed time, not invented dispatch deadlines. Do not introduce a 24-hour overdue threshold, business-day promise, carrier cutoff, or automatic priority based on Express shipping.
- Use `Australia/Sydney` for displayed dates and date-filter boundaries; durations are elapsed UTC differences. Show money in AUD using existing formatters.
- `completed` is an internal lifecycle state and is not evidence of delivery. A recorded refund is not evidence that money was transferred. Adding tracking is not carrier handover evidence.
- Physical units come from frozen `order_stock_claims.units_per_item`, including every claimed stock pool. An order line, a purchased pack, and a physical unit are distinct quantities.
- Preserve historical item snapshots. Reuse `orderItemVariantIdentity` and `orderShippingMethod`; never derive historical size or pack quantities solely from today's catalogue.
- Preserve existing public URLs and direct full-order links. Keep unknown/missing values explicit rather than converting them to zero or successful states.
- Introduce no new package or UI framework. Use the current admin theme and existing primitives where they fit.
- Keep customer records, search text, payment references, and order IDs out of persistent preference storage and screenshots committed to the repository. Synthetic browser fixtures must never call production services.
- Preserve existing untracked files and unrelated changes. Do not use broad staging, destructive cleanup, or copy synthetic preview data into application code.
- Complete local implementation and verification before requesting release approval. Do not apply production migrations, merge to main, or publish a deployment under this plan alone.

## Review focus

These five risks must have explicit tests in the owning tasks, not just a final visual check:

1. **Scope drift:** search, discount, dates, shipping filters, counts, pagination, and CSV must describe the same order population; test in Tasks 1–3 and 11.
2. **Misleading facts:** packs, accessories, partial refunds, missing claims, legacy timestamps, and automatic completion must not produce false quantities, timing, payment, or delivery claims; test in Tasks 1–3 and 6.
3. **Interrupted work:** opening another order, browser Back/Forward, closing a drawer, changing filters, and navigating a selected packing batch must preserve or explicitly clear the right state; test in Tasks 5–9 and 11.
4. **Stale or mixed selections:** another admin changes an order, a selected row disappears, or one bulk operation fails; act only on the intended eligible IDs and keep failures visible; test in Tasks 7–9.
5. **Access and input boundaries:** unauthenticated previews/exports, malformed URLs, corrupt preference storage, external return URLs, and cross-admin storage reuse must fail safely; test in Tasks 1–4, 7, 9, and 11.

---

## 1. Starting point and repository facts

Planning baseline: branch `codex/shipping-method-clarity`, commit `255d4e988e3c7006ea6e6dbd7c72084b6482df91` (`Make shipping method unmistakable during fulfilment`). This is a reference, not an instruction to reset the receiving checkout. Inspect the actual branch and differences before beginning.

The source checkout contains unrelated untracked documents and an untracked admin design study. Those files do not automatically appear in a new worktree. The implementation must not depend on their presence.

| Existing file | Relevant responsibility / observation |
| --- | --- |
| `storefront/app/admin/(dashboard)/orders/page.tsx` | Server list, default `to_fulfil` view, 25-row pages, status counts, query/date/discount handling. Default order currently follows placement descending. |
| `storefront/components/admin/OrdersTable.tsx` | List markup, sorting, selection, keyboard shortcuts, payment/reinstatement actions, and persisted bulk failures are currently mixed together. |
| `storefront/components/admin/OrdersFilters.tsx` | Debounced search, Sydney-based date presets, removable date filters, CSV link. |
| `storefront/lib/admin/order-queries.ts` | Shared legacy list/detail/export reads. `item_count` is the number of `order_items` rows. Current list search covers order number, customer name, and email. |
| `storefront/app/admin/(dashboard)/orders/export/route.ts` | Currently omits `discount` even when the page's export link includes it. Fix parity as part of the new read path. |
| `storefront/lib/admin/order-queries.ts`, `ordersCsv` | Existing export stops collecting at 20,000 rows; the replacement must refuse an oversized export explicitly rather than silently truncate. |
| `storefront/lib/admin/order-shipping.ts` | Express comes from `shipping_address.shipping_method`; legacy/missing values default to Standard. Preserve this established rule. |
| `storefront/lib/admin/order-item-identity.ts` | Prefers size from the order-time variant snapshot, with a linked-size fallback for older records. |
| `storefront/app/admin/(dashboard)/orders/[id]/page.tsx` | Full page includes item editing, lot assignment, refunds/settlements, economics, customer/address, timeline, and existing actions. |
| `storefront/app/admin/(dashboard)/orders/[id]/pack/page.tsx` | Existing guarded packing route, `LotPacking`, and `PackingMode`. |
| `storefront/components/admin/PackingMode.tsx` | Local checklist/tracking form, explicit shipping service, and existing `advanceStatus` call. Already resets local inputs when order identity changes. |
| `storefront/lib/admin/packing.ts` | Global queue uses `paid_at` ascending, nulls last, then ID; currently bounded to a 500-order navigation window with an explicit truncation indicator. |
| `storefront/lib/admin/fulfilment.ts` | Actual lot allocation and carrier preview/commit interfaces. Do not replace with prototype checkboxes. |
| `storefront/components/admin/ConfirmModal.tsx`, `useDialogFocus.ts` | Confirmation/focus primitives. The existing focus hook is not a general nested-dialog manager. Avoid competing focus traps. |
| `storefront/components/admin/AdminShell.tsx`, `Topbar.tsx` | Existing shell supplies an H1 and a 56px sticky top bar. Do not add a second page H1 or duplicate the shell. |
| `storefront/tests/preview/admin-revamp.tsx` | Optional synthetic design reference: drawer, tabs, and navy presentation. It is not production architecture or business logic. |
| `storefront/tests/preview/navigation.ts` | Current Vite navigation stub has no-op `push`, `replace`, and `refresh`. It cannot prove real Next.js navigation. |
| `storefront/tests/admin/fulfilment-analytics-sql.test.ts` | Example of applying every migration to isolated PGlite, plus timestamp and permission checks. |

Read these existing tests before changing the related behavior: `tests/admin/order-actions.test.tsx`, `order-reinstatement.test.ts`, `order-size-visibility.test.tsx`, `shipping-method-visibility.test.tsx`, `packing-address.test.tsx`, `fulfilment-ui.test.tsx`, `fulfilment-workflow.test.ts`, `refund-workflow-ui.test.tsx`, `order-deletion-ui.test.tsx`, and `tests/order-email-ui.test.tsx`.

The existing fulfilment spec explicitly records the owner's preference for elapsed-time reporting without targets. If available, read `docs/superpowers/specs/2026-09-27-fulfilment-experience-design.md`. Do not copy release authorization from that document or its plan into this task.

## 2. Design contract

### 2.1 Intended outcome and chosen scope

Serve an operator who alternates between payment checks, packing, and answering order questions. The default landing view remains To fulfil. Success means identifying the next order, checking its shipping/item details, and taking the correct action with less navigation and no loss of context.

Implement the production orders workspace incrementally. The design study is a visual reference only. Keep the existing dedicated packing screen; extend it to respect an explicitly selected batch. Do not build another shipping state machine inside the drawer.

Included: compact layout; objective attention flags; richer list data; separate payment/fulfilment presentation; task views; matching search/filter/export semantics; personal structural saved views and column/density preferences; preview drawer; bulk action clarity; selected-batch packing; mobile/accessibility states.

Excluded: full admin navigation/overview revamp; analytics charts; carrier integrations; automated bank matching; new payment, partial-shipment, or delivery states; shared/team saved-view backend; dispatch SLAs; drag-and-drop boards; barcode scanning; unsolicited customer messaging; production release.

### 2.2 Layout and visual hierarchy

Desktop order within the existing admin shell:

1. Compact local header: result/context line, secondary Create order, Export, and link to existing stock-lot/carrier tools.
2. Five primary views: To fulfil, Awaiting payment, Needs attention, Shipped, All orders. More views exposes Paid, Processing, Completed, Refunded, Cancelled without removing old links.
3. One toolbar: search, Filters, Sort, Columns, density preference. Active filters appear immediately below as removable chips, with Clear filters.
4. Selection action bar appears only when rows are selected, above the rows and sticky with the toolbar.
5. Table, then “1–25 of 74 orders”, Previous and Next. No arbitrary analytics or decorative summary cards.

Use current admin tokens. Desktop body text 14px minimum for order facts; secondary text at least 12px. Monetary columns use tabular numerals and right alignment. Comfortable desktop rows target 60–68px; compact rows target 48–52px for short content. Both may grow for long names or warnings. Never truncate an essential shipping method, quantity, size, or issue without an accessible expansion.

Shipping badges: Express receives a restrained attention treatment; Standard is neutral. Express is a purchased delivery service, not evidence the order is late. Routine fulfilment badges stay quiet. Reserve red for actual errors/blockers and always pair colour with text.

At 1280×900 in the existing shell, the first order should start within the top 360px of the viewport, with at least six ordinary short rows visible. This is a layout acceptance target, not a reason to shrink text. Exclude browser chrome and synthetic preview banners when measuring.

Below 768px, render stacked order cards instead of removing critical columns from a cramped table. Retain order/customer, shipping method, relevant wait, statuses, quantity summary, total, issue text, selection, and Open order. Advanced filters live in a labelled disclosure/panel; sorting remains available. Controls must remain usable at 320px, 200% zoom, keyboard-only, and touch with approximately 44px targets. Drawer becomes full-width on phones, with its primary action reachable and safe-area padding.

### 2.3 Views, search, sorting, dates, and counts

Canonical view key remains `status` to preserve links. Supported values: `to_fulfil`, `pending`, `needs_attention`, `shipped`, `all`, `paid`, `processing`, `completed`, `refunded`, `cancelled`.

- `to_fulfil`: raw status paid or processing, matching the existing operational definition.
- `needs_attention`: at least one of the objective issues defined below. It can overlap another view and is not added into the All count.
- Other status views match the named raw lifecycle state exactly; All includes every existing order.
- Default sort for To fulfil and Awaiting payment is `waiting_seconds desc`, unknown last, then ID ascending. Other views default to `created_at desc`, then ID ascending.
- Explicit supported sorts: `created_at`, `paid_at`, `waiting_seconds`, `order_number`, `total_cents`, `status`. Every sort uses ID as a stable secondary key, with unknown times last in both directions.
- Dates filter placement time, clearly labelled “Placed date”. Inclusive local date inputs become a half-open Sydney interval using the existing date-boundary helper.
- Search is a literal, case-insensitive substring over order number, customer name/email, payment reference, tracking number, and historical item name/variant/SKU. Do not interpret user input as SQL, regex, or wildcard syntax.
- Search stays within the visibly selected view. An explicit “Search all orders” control preserves the search term and sets `status=all`. Old links with `q` but no `status` continue to resolve to All.
- Tab counts include search, dates, discount, and shipping filters, but exclude the selected status. Thus each count describes switching to that tab while retaining the other filters. Label them as filtered counts when filters are applied.
- Remove any all-open summary that appears to follow a narrower filter but does not. The current workspace needs only its scoped result count and view counts.
- Changing filters/search/view resets page to 1, closes the drawer, and clears selection. Changing sort also clears selection. Page changes clear selection. Explicit sort remains when switching views; untouched default sort follows the new view's default.
- Filtered zero results say “No orders match these filters” with Clear filters. “All caught up” is allowed only for an unfiltered, empty To fulfil view.
- Clamp an out-of-range page to the last available page and replace the URL, preserving filters. Prevent redirect loops with zero results.

### 2.4 Order facts and honest labels

**Elapsed time:** pending uses `as_of - created_at`; paid/processing uses `as_of - paid_at` only if creation/payment chronology is valid and shipment is absent. Other statuses show their relevant absolute date, not an actively running fulfilment wait. Invalid/missing/future timestamps produce Unknown and an objective issue. The server supplies one `as_of` for the page; clients format it without starting a second drifting clock.

**Payment:** show Awaiting payment for pending; Payment recorded for paid/processing/shipped/completed or a valid recorded payment timestamp. A cancellation with no payment evidence says No payment recorded. Full/partial refund labels must say Refund recorded / Partial refund recorded, and show transfer outstanding when recorded refunds exceed settlement records. Do not label an unsettled refund Paid back. Unknown combinations remain explicit.

**Fulfilment:** paid = Ready to pack; processing = Packing; pending = Awaiting payment; shipped = Marked shipped; completed = Completed (internal); cancelled = Cancelled. A refunded order with shipment evidence keeps “Marked shipped” as its fulfilment fact; an unshipped fully refunded order says No fulfilment required. Never display Delivered based on completion.

**Quantities:**

```text
line_count = number of order_items rows
ordered_physical_units = sum(item.qty × claim.units_per_item across all claims)
remaining_physical_units = sum((item.qty - item.refunded_qty) × claim.units_per_item)
```

Require claim coverage for every positive-quantity item before treating a physical sum as complete. Missing claim coverage means the physical total is null, not a partial sum or zero. Do not infer from today's `product_variants.pack_size`. A bundled accessory can add another claimed pool; include it in physical totals. Prefer “physical units” to “vials” when the data does not establish a common unit type. Ready-to-pack rows show remaining units; historical rows show ordered units with refund information separately. Drawer shows purchased pack quantity and historical variant description as well as physical requirements.

**Objective attention issues:**

| Key | Exact predicate | Visible label / resolution |
| --- | --- | --- |
| `address_incomplete` | Paid/processing; blank line1, blank suburb and city, blank state, or blank postcode. Preserve existing country default AU. Do not claim postal validation. | “Address needs review”; open the full order to inspect. |
| `timing_incomplete` | Paid/processing/shipped/completed with missing/invalid paid_at; or shipped/completed with missing/invalid shipped_at; or timestamps ordered before their prerequisite or after as_of. | “Timing record needs review”; show unknown duration and timestamps. |
| `tracking_missing` | Shipped/completed or valid shipped_at, with blank tracking_number. | “Tracking missing”; full order provides existing correction controls. |
| `quantity_unknown` | Paid/processing with no item rows or any positive item lacking frozen stock-claim coverage. | “Packing quantity unavailable”; do not invent physical requirements. |
| `refund_transfer_pending` | `refunded_cents > sum(refund_settlements.amount_cents)`. | “Refund transfer outstanding”; link to existing settlement workflow. |

An ordinary unallocated stock lot is not automatically an exception. Existing lot and dispatch checks remain authoritative. Do not create alert badges from age alone.

### 2.5 Drawer and navigation

Clicking the explicit order link or Open order opens a drawer. Keep a real full-page `href` for modified clicks, opening a new tab, and no-JavaScript use. Do not put every interactive control inside a clickable row.

Drawer contents, in order: order/customer identity; payment and fulfilment labels; visible shipping service, address, and available customer instructions; item/size/pack/physical summary; relevant timestamps and payment reference; primary action; expandable internal notes/recent activity; Open full order.

Never label internal `order.notes` as customer delivery instructions. Only display delivery instructions if an existing snapshot field demonstrably stores them; otherwise omit that separate field and keep Internal notes clearly named.

Primary action:

- Pending: Confirm payment using existing `confirmPayment`, with a review of amount/order/reference and the known stock/email effects.
- Paid/processing: Open packing, using the existing pack route. The drawer does not fake lot allocation or dispatch.
- Shipped/completed: Open full order for tracking/history.
- Cancelled/refunded: Open full order for the existing reviewed actions and settlements.

Previous/Next traverse only the currently loaded page, following its current order, and say “Order 3 of 25 on this page”. Disable at page boundaries; do not claim traversal of the full result set. Closing restores focus to the originating control, or the list heading if that row has disappeared.

Opening pushes `order=<uuid>` onto the list URL; Previous/Next replace that parameter; explicit Close removes it with replace. Browser Back closes an opened drawer; Forward reopens it. Direct links with `order` work without assuming a prior history entry. Preserve the list's filters, page, sort, and scroll. Protect unsaved payment-reference input from accidental Next/Close with an inline discard confirmation; never use a browser-native confirm.

After a successful mutation, refresh the list and drawer from server truth. If the order no longer matches the view, retain the drawer long enough to show the success and “This order no longer matches this view”; do not unexpectedly jump to another order.

### 2.6 Selection and packing batches

Selection is page-scoped, capped at the existing 25 rows, with an indeterminate header checkbox. The label says Select all orders on this page. No “select every result” feature in this release.

Bulk bar names the total selected and per-action eligible counts. Show payment, printing, and reinstatement only where valid. A selected-batch packing action carries exactly the eligible IDs, in displayed order, into the packing route; it never opens an unrelated global queue.

Preserve all existing bulk action behavior and partial-failure reporting. Only failed visible IDs remain selected after a result. Successful orders must not remain selected. When filters/pages change, clear the selection but retain a dismissible result report with full-order links, including failures no longer visible. A filter change cannot silently turn those hidden failures into the next action's targets.

Do not globally persist selection or customer-bearing error messages. Replace the old broad sessionStorage failure restoration with a workspace session state owned by the mounted workspace; clear it on leaving the workspace/session. No loss of error detail during the current operation or a router refresh.

Selected packing context uses at most 25 validated UUIDs in `batch`, and a normalized internal `returnTo` for the orders list. Recheck current packability on the server, skipping changed/missing orders without substituting other orders. Keep the original total/position labelled as the selected batch and explicitly report skipped entries. Once the batch is finished, return to the exact saved list context. Existing direct packing URLs without a batch continue to use the global queue.

### 2.7 Personal views and preferences

Versioned storage key: `ecl:admin:orders:v1:<admin-user-id>`. Persist only structural filters (status, dates, shipping, discount), sort, visible column IDs/order, density, and user-named structural views. Do not persist `q`, `order`, `page`, selected IDs, or fetched order data. The Save view dialog explicitly says “Search text and selected orders are not saved.” Limit to 10 views; trim names to 1–40 characters; reject duplicate names case-insensitively. Provide rename, delete, and reset layout controls.

The URL controls server data. Apply a saved view by navigating to its explicit parameters. Do not silently change server filters after hydration. Stored density/column preferences may apply after hydration without changing the result set; URL column/density values take precedence. Storage denial/corruption produces default preferences and a working page.

Column IDs: `identity` (mandatory first), `items`, `payment`, `fulfilment`, `shipping`, `waiting`, `placed`, `total`. Fulfilment defaults: identity, items, shipping, waiting, fulfilment, total. Payment defaults: identity, payment, waiting, total, placed. Payment cells include method/reference when present. All defaults: identity, payment, fulfilment, shipping, placed, total. At most one explicit Open control per row; user-configured column order uses accessible Move up/Move down buttons, not required drag gestures. Important issue text stays attached to identity regardless of hidden columns.

## 3. File ownership and interfaces

All paths below are repository-relative. Run application commands from `storefront/`. Do not create all files as empty scaffolding; create each when its task implements a responsibility.

| File / group | Owner task | Responsibility |
| --- | --- | --- |
| `lib/admin/order-workspace/types.ts` | 1 | Serializable contracts only; safe for client type imports. |
| `lib/admin/order-workspace/params.ts` | 1 | URL parser, canonical builder, safe return URL, batch validation. |
| `lib/admin/order-workspace/presentation.ts` | 1 | Labels, elapsed-time formatting, column presets, quantity wording. |
| `supabase/migrations/20261001100000_admin_order_workspace.sql` | 2 | Additive, read-only facts/scope/list/export functions. Change timestamp only if it collides. |
| `lib/admin/order-workspace/queries.ts` | 3 | Server-only RPC adapters and runtime response validation. |
| `lib/admin/order-workspace/export.ts` | 3 | CSV construction from the shared query and unchanged legacy columns. |
| `lib/admin/order-workspace/preferences.ts` | 4 | Versioned preference validation/serialization. |
| `components/admin/orders/SavedOrderViews.tsx`, `OrderColumnsControl.tsx` | 4 | Personal view and layout controls. |
| `components/admin/orders/OrdersWorkspace.tsx` | 5 | Client coordinator for URL navigation, pending state, selection, drawer, preferences. |
| `components/admin/orders/OrdersToolbar.tsx`, `OrderViewTabs.tsx` | 5 | Responsive controls and scoped view counts. |
| `components/admin/orders/OrderWorkspaceTable.tsx` | 6 | Display/selection/keyboard presentation for the new workspace. Keep the legacy table running until Task 10 switches the route and migrates its tests. |
| `components/admin/orders/OrderCards.tsx`, `OrderStatusPair.tsx` | 6 | Mobile presentation and shared labels. |
| `components/admin/orders/orders-workspace.css` | 5–7 | Styles scoped to `.orders-workspace`; current admin tokens only. |
| `app/admin/(dashboard)/orders/[id]/preview/route.ts` | 7 | Authenticated minimal preview response, private/no-store. |
| `lib/admin/order-workspace/preview.ts` | 7 | Server-only preview loader, reusing `getOrder` and `getOrderFulfilment`. |
| `components/admin/orders/OrderPreviewDrawer.tsx`, `OrderQuickPayment.tsx` | 7 | Drawer, loading/error states, existing payment action, controlled focus. |
| `components/admin/orders/OrdersBulkActions.tsx`, `useOrderSelection.ts` | 8 | Eligibility, selected actions, per-order result report. |
| `lib/admin/packing.ts`, `PackingMode.tsx`, `[id]/pack/page.tsx` | 9 | Validated selected-batch navigation and return context. |
| `app/admin/(dashboard)/orders/page.tsx`, `loading.tsx`, new `error.tsx` | 10 | Guarded workspace integration and truthful page states. |
| `app/admin/(dashboard)/orders/export/route.ts` | 3, 10 | Use the same normalized filters as the list. |
| `app/admin/(dashboard)/orders/[id]/page.tsx` | 10 | Accept normalized return context; preserve existing functionality. |
| `tests/admin/order-workspace-*.test.ts[x]` | 1–10 | Focused behavioral and read-model tests. |
| `tests/helpers/order-workspace-fixtures.ts` | 1 | Typed synthetic records reused by UI/query tests and browser fixture. |
| `tests/preview/orders-workspace.html`, `.tsx` | 11 | Isolated render of actual production workspace components with synthetic adapters. |
| `tests/preview/order-workspace-actions.ts`, `order-workspace-preview.ts` | 11 | Explicit fake mutation/preview adapters for the fixture. |
| `tests/browser/orders-workspace.spec.ts` | 11 | Responsive/accessibility and fixture interaction acceptance. |
| `tests/browser/orders-workspace-next.spec.ts`, `playwright.admin-orders.config.ts` | 11 | Opt-in authenticated local/staging Next.js navigation tests. |
| `playwright.config.ts` | 11 | Exclude the opt-in Next integration spec from the ordinary Vite fixture test suite. |
| `docs/admin-orders/2026-10-01-implementation-evidence.md` | 12 | Actual commands/results, screenshots, limitations, review and rollout notes. |

### 3.1 Type contract

Create these exports in `types.ts`; consumers must use these names consistently. Keep raw lifecycle status separate from display facts.

```ts
import type { OrderStatus } from '@/lib/admin/orders';

export type OrderView = OrderStatus | 'to_fulfil' | 'needs_attention' | 'all';
export type WorkspaceSort = 'created_at' | 'paid_at' | 'waiting_seconds' |
  'order_number' | 'total_cents' | 'status';
export type OrderColumn = 'identity' | 'items' | 'payment' | 'fulfilment' |
  'shipping' | 'waiting' | 'placed' | 'total';
export type OrderIssue = 'address_incomplete' | 'timing_incomplete' |
  'tracking_missing' | 'quantity_unknown' | 'refund_transfer_pending';
export type ShippingFilter = 'any' | 'standard' | 'express';

export interface OrderWorkspaceParams {
  status: OrderView;
  q: string;
  from: string;
  to: string;
  discount: string;
  shipping: ShippingFilter;
  sort: WorkspaceSort;
  dir: 'asc' | 'desc';
  explicitSort: boolean;
  page: number;
  order: string | null;
  columns: OrderColumn[] | null;
  density: 'comfortable' | 'compact' | null;
}

export interface OrderItemSummary {
  id: string;
  product_name: string | null;
  variant_label: string | null;
  size_label: string | null;
  sku: string | null;
  qty: number;
  refunded_qty: number;
}

export interface OrderWorkspaceRow {
  id: string;
  order_number: string;
  status: OrderStatus;
  customer_name: string | null;
  customer_email: string;
  total_cents: number;
  refunded_cents: number;
  refund_settled_cents: number;
  created_at: string | null; // Non-finite legacy values normalize to unavailable.
  paid_at: string | null;
  shipped_at: string | null;
  payment_method: string | null;
  payment_ref: string | null;
  tracking_number: string | null;
  shipping_method: 'standard' | 'express';
  destination: string | null;
  line_count: number;
  items: OrderItemSummary[];
  ordered_physical_units: number | null;
  remaining_physical_units: number | null;
  waiting_seconds: number | null;
  issue_keys: OrderIssue[];
  has_notes: boolean;
}

export interface OrderWorkspacePage {
  rows: OrderWorkspaceRow[];
  total: number;
  counts: Record<OrderView, number>;
  as_of: string;
  page: number;
  page_size: 25;
}

export interface OrderLabel {
  label: string;
  detail: string | null;
  tone: 'neutral' | 'info' | 'warning' | 'success' | 'critical';
}

export interface StoredOrderView {
  id: string;
  name: string;
  filters: Pick<OrderWorkspaceParams, 'status' | 'from' | 'to' |
    'discount' | 'shipping' | 'sort' | 'dir' | 'explicitSort'>;
  columns: OrderColumn[];
  density: 'comfortable' | 'compact';
}

export interface OrderPreferences {
  version: 1;
  columns: OrderColumn[] | null;
  density: 'comfortable' | 'compact';
  views: StoredOrderView[];
}
```

Keep the list payload to its necessary facts; full addresses, complete events, notes, economics, and stock-lot catalogues belong in the preview/full order. Cap list `items` to three summaries and use `line_count` for “+N more”. Search must still include every item, not just those returned for display.

### 3.2 Function contracts

```ts
// params.ts
export type RawOrderParams = Record<string, string | string[] | undefined>;
export function parseOrderWorkspaceParams(raw: RawOrderParams): OrderWorkspaceParams;
export function orderWorkspaceHref(
  current: OrderWorkspaceParams,
  patch?: Partial<OrderWorkspaceParams>,
): string;
export function orderWorkspaceScopeKey(params: OrderWorkspaceParams): string;
export function safeOrdersReturnTo(raw: string | null | undefined): string;
export function parsePackingBatch(raw: string | null | undefined): string[] | null;

// presentation.ts
export function paymentLabel(row: OrderWorkspaceRow): OrderLabel;
export function fulfilmentLabel(row: OrderWorkspaceRow): OrderLabel;
export function waitingLabel(row: OrderWorkspaceRow): string;
export function physicalQuantityLabel(row: OrderWorkspaceRow): string;
export function defaultOrderColumns(view: OrderView): OrderColumn[];

// queries.ts: import 'server-only'
export function getOrderWorkspace(params: OrderWorkspaceParams): Promise<OrderWorkspacePage>;
export function getOrderWorkspaceRow(id: string): Promise<OrderWorkspaceRow | null>;
export function getOrderWorkspaceExport(params: OrderWorkspaceParams): Promise<{
  rows: OrderWorkspaceRow[]; total: number; as_of: string;
}>;

// preferences.ts
export function defaultOrderPreferences(): OrderPreferences;
export function parseOrderPreferences(raw: string | null): OrderPreferences;
export function serializeOrderPreferences(value: OrderPreferences): string;
```

The export uses the same row type with `items: []`, because its CSV includes line and physical totals rather than product-summary arrays. Do not fetch or transmit all item summaries just to export the list. Do not use `any` to conceal a contract mismatch.

## 4. Execution tasks

Run tasks in order. Each task ends with its focused checks and a scoped commit if committing is supported and consistent with repository instructions. Never commit someone else's untracked prototype or reports. Record the commit and checks in the execution ledger. A failed focused test must be understood before building dependent code.

For new DOM test files, start with `// @vitest-environment jsdom`, import `@testing-library/jest-dom/vitest`, and register Testing Library cleanup after each test. Use `userEvent.setup()` for realistic interaction sequences; use fake timers only for the debounce cases and restore them afterward. SQL tests keep the default Node environment. Test snippets below show the required behavior; add their explicitly named imports and fixture/harness definitions in each owning test file.

### Task 1 — Establish URL, presentation, and synthetic-data contracts

**Files:** Create `types.ts`, `params.ts`, `presentation.ts`, `tests/helpers/order-workspace-fixtures.ts`, `tests/admin/order-workspace-params.test.ts`, and `tests/admin/order-workspace-presentation.test.ts` at the paths above.

**Consumes:** Existing `OrderStatus`, `sydneyDayBoundary`, `orderShippingMethod`, `orderItemVariantIdentity`, `formatAud`.

**Produces:** All interfaces/functions in Sections 3.1–3.2 except server queries/preferences, plus `makeWorkspaceRow(patch?: Partial<OrderWorkspaceRow>): OrderWorkspaceRow` and `makeWorkspaceParams(patch?: Partial<OrderWorkspaceParams>): OrderWorkspaceParams` test helpers. Fixtures use deterministic UUIDs and `example.test` identities.

- [ ] Inspect actual branch/status, applicable `AGENTS.md`, Node/npm versions, and migrations. Use the worktree skill if isolation is needed; base work on the intended current code, not a guessed default branch. Preserve local untracked design studies.
- [ ] Write parser/presentation behavior tests before implementing the helpers. Include:

```ts
it('keeps old search links global and new explicit views scoped', () => {
  expect(parseOrderWorkspaceParams({q: 'ECL-1048'}).status).toBe('all');
  expect(parseOrderWorkspaceParams({status: 'pending', q: 'ECL-1048'}).status)
    .toBe('pending');
});

it('preserves filters while moving between pages', () => {
  const state = makeWorkspaceParams({status: 'pending', q: 'ref(1),20%',
    discount: 'VIP_20', shipping: 'express', from: '2026-10-01'});
  const url = new URL(orderWorkspaceHref(state, {page: 2}), 'https://example.test');
  expect(url.searchParams.get('q')).toBe('ref(1),20%');
  expect(url.searchParams.get('discount')).toBe('VIP_20');
  expect(url.searchParams.get('page')).toBe('2');
});

it('never treats external or lookalike return URLs as admin navigation', () => {
  for (const raw of ['https://evil.test', '//evil.test', '/admin/orders-evil',
    '/admin/orders/1048', '/admin/orders?returnTo=https://evil.test']) {
    expect(safeOrdersReturnTo(raw)).toBe('/admin/orders');
  }
});

it('does not call an internally completed order delivered', () => {
  expect(fulfilmentLabel(makeWorkspaceRow({status: 'completed'})).label)
    .toBe('Completed (internal)');
});

it('preserves unknown physical quantity and payment time', () => {
  const row = makeWorkspaceRow({remaining_physical_units: null, waiting_seconds: null});
  expect(physicalQuantityLabel(row)).toBe('Physical quantity unavailable');
  expect(waitingLabel(row)).toBe('Payment time unavailable');
});
```

- [ ] Add cases for duplicate query values, invalid view/sort, leap dates, invalid/reversed date range, negative/NaN/huge page, empty search, whitespace, malformed UUID, duplicates and >25 batch IDs, columns without identity, unknown columns, and explicit/default sort switching. Normalize unsupported dates to blank and show no misleading applied chip; submit-time date UI must explain invalid/reversed ranges before navigation.
- [ ] Run `npm test -- tests/admin/order-workspace-params.test.ts tests/admin/order-workspace-presentation.test.ts`; confirm the intended missing-export/behavior failures.
- [ ] Implement the helpers. Bound q to 200 trimmed characters, discount to 100, page to integer 1–1,000,000. Retain literal punctuation in search. Use an anchored UUID validator. Malformed or oversized `batch` returns null and later receives a visible invalid-batch response, never silent fallback to the global queue. Distinguish absent batch from invalid batch in the caller using the raw parameter's presence.
- [ ] `orderWorkspaceHref` must use `URLSearchParams`; strip unknown parameters; serialize `status` explicitly; omit sort/dir when `explicitSort=false`; retain all known filters. Its default does not reset page implicitly—callers pass page 1 when they change the result set. `scopeKey` includes filters/sort/page but excludes drawer, density, and columns.
- [ ] `safeOrdersReturnTo` accepts only a relative URL with exact pathname `/admin/orders`, no fragment, no duplicate scalar keys, and known list/presentation parameters. Reject `order`, `batch`, nested `returnTo`, backslashes, scheme-relative URLs, and encoded path separators; normalize accepted values through the parser/builder. Fallback is `/admin/orders`.
- [ ] Run both focused tests and `npm run typecheck`; commit only Task 1 files.

**Acceptance:** Every subsequent task can use the same URL/types/labels. No implementation needs to guess whether age means time since placement or payment.

### Task 2 — Add one consistent read model for rows, counts, and exports

**Files:** Create the additive migration and `tests/admin/order-workspace-sql.test.ts`. Read existing commerce/stock-claims/refund-settlement migrations; do not edit them.

**Consumes:** Orders, item snapshots, frozen stock claims, refund settlements, and the contract in Sections 2.3–2.4.

**Produces:** These service-only read functions:

```sql
-- Shared normalized non-view scope. Return one row per order, never per item.
public.admin_order_workspace_scope(p_filters jsonb, p_as_of timestamptz,
  p_order_ids uuid[] default null)
  returns table (order_id uuid, status text, facts jsonb);

-- Shared membership predicate used by list, counts, and export.
public.admin_order_workspace_matches_view(p_status text, p_issues text[], p_view text)
  returns boolean;

-- One JSON envelope avoids PostgREST's set-returning row cap.
public.admin_order_workspace(p_filters jsonb, p_as_of timestamptz default now())
  returns jsonb;

public.admin_order_workspace_export(p_filters jsonb, p_as_of timestamptz default now())
  returns jsonb;
```

`p_filters` contains only `status`, `q`, `from_at`, `to_at`, `discount`, `shipping`, `sort`, `dir`, `page`; dates are normalized ISO bounds from the adapter. Reject unrecognized status/shipping/sort/dir, bad bounds, and invalid page at the SQL boundary too. `facts` has the row fields from Section 3.1. Scope applies every filter except status, computes issues/quantities, and does not paginate. The optional server-only `p_order_ids` bounds the same facts query for an individual preview; it is never accepted from the list/export URL. Reject more than 25 IDs in this helper. Public list counts that scope by view, applies active view, calculates total, clamps page, and returns its 25 rows. Return all view keys even when zero.

- [ ] Build an isolated PGlite test harness using the existing all-migrations pattern. Use transaction rollback/savepoints per test. Include deterministic fixtures spanning all lifecycle statuses, missing/null data, real frozen multi-pool claims, and refund settlements.
- [ ] Write integration tests with independently calculated expectations. Minimum dataset includes two purchased 3-packs plus an accessory, one partially refunded pack, a missing claim, a refunded shipped order, unsettled vs settled refund, and a payment confirmed across Sydney's DST change.

```ts
it('counts physical claims rather than order lines or current pack sizes', async () => {
  const result = await workspace({status: 'to_fulfil'});
  const row = result.rows.find(r => r.order_number === 'WORKSPACE-PACKS');
  expect(row).toMatchObject({line_count: 2, ordered_physical_units: 7,
    remaining_physical_units: 4});
});

it('counts all matching orders before paginating', async () => {
  await insertSyntheticPendingOrders(1005);
  const result = await workspace({status: 'pending', q: 'workspace-bulk'});
  expect(result.total).toBe(1005);
  expect(result.counts.pending).toBe(1005);
  expect(result.rows).toHaveLength(25);
});

it('treats wildcard-looking input as literal text', async () => {
  const result = await workspace({status: 'all', q: 'ref(1),20%_'});
  expect(result.rows.map(r => r.order_number)).toEqual(['WORKSPACE-LITERAL']);
});
```

Define `workspace(filters)` in the test as a call to `admin_order_workspace` with fixed `p_as_of='2026-10-05T04:00:00Z'`. Define `insertSyntheticPendingOrders(count)` with `generate_series`, unique order numbers, and `workspace-bulk@example.test`. These are test-local helpers, not application exports.

- [ ] Test counts/list/export equality under combined search+discount+shipping+date filters; an item match beyond the first three items; payment/tracking reference search; no duplicate orders from multi-item/claim joins; null times last for both sort directions; stable ID tiebreak; out-of-range pages; and all five issue predicates. Verify ordinary unallocated lots and long waits alone do not enter Needs attention.
- [ ] Run `npm test -- tests/admin/order-workspace-sql.test.ts` and confirm missing-function failures.
- [ ] Implement parameterized SQL with `stable security definer set search_path=public`. Use literal substring matching such as `strpos(lower(coalesce(value,'')), lower(term)) > 0`; item matching uses `EXISTS`. Aggregate claims and settlements separately before joining to orders to avoid multiplication. Use order-time claims; use catalogue only for the existing size fallback. Use allowlisted CASE sort expressions and an ID tiebreak; do not interpolate user text into SQL identifiers.
- [ ] Example physical-total rule to implement, with aliases explicitly bound in the surrounding query:

```sql
-- item_claims groups public.order_stock_claims by item_id first.
case
  when count(*) filter (where i.qty > 0 and c.claim_count is null) > 0 then null
  else sum(i.qty::bigint * coalesce(c.units_per_item_total, 0))
end as ordered_physical_units
```

Use the equivalent `qty - refunded_qty` expression for remaining units. Handle zero item rows separately. Store/use bigint internally and validate safe integers in the TypeScript adapter. Do not cap incomplete sums to a plausible number.

- [ ] List rows and counts must be from the same function call/snapshot. Export must apply identical scope/view logic in a single database statement and return one JSON envelope. Export up to 20,000 rows; above that raise a named `ORDER_EXPORT_TOO_LARGE` error. Do not implement multi-request offset export and describe `as_of` as a transactional snapshot—it would not be one.
- [ ] Revoke execute on every new helper/public function from PUBLIC, anon, and authenticated; grant only service_role. Do not expose a public view. Test all functions with `has_function_privilege`, then actual role calls. Assert order/event/outbox/stock counts unchanged after reads.
- [ ] Run SQL tests and existing `counts.test.ts`, `fulfilment-analytics-sql.test.ts`, and `fulfilment-workflow.test.ts`. Inspect query plans on a synthetic 10,000-order dataset; add a targeted index only if the plan proves a need. Existing arbitrary substring search need not be replaced with a new search subsystem.
- [ ] Commit migration and tests. Do not apply it to a remote database in this task.

**Acceptance:** No client-side filtering after pagination, no N+1 per-order detail reads, no silent row-limit truncation, and no commerce mutation.

### Task 3 — Wire typed server adapters and a matching export

**Files:** Create `queries.ts`, `export.ts`, `tests/admin/order-workspace-queries.test.ts`, `tests/admin/order-workspace-export.test.ts`. Keep the current export route connected to the current list until Task 10 switches both together.

**Consumes:** Task 1 parameters/types and Task 2 RPCs. Reuse `csvRow` in `lib/csv.ts`.

**Produces:** `getOrderWorkspace`, `getOrderWorkspaceRow`, `getOrderWorkspaceExport`, and `workspaceOrdersCsv(params: OrderWorkspaceParams): Promise<string>` from `export.ts`.

- [ ] Mock the adminDb RPC boundary and write tests that assert exact normalized filter arguments, error propagation, and rejected malformed payloads. Check all row IDs/statuses/numeric quantities, safe integers, nullable timestamps, expected view-count keys, row count <=25, and valid `as_of`.

```ts
it('sends every population filter to the shared export read', async () => {
  await workspaceOrdersCsv(makeWorkspaceParams({status: 'pending',
    discount: 'VIP_20', shipping: 'express', q: 'PAY-1048'}));
  expect(rpc).toHaveBeenCalledWith('admin_order_workspace_export', {
    p_filters: expect.objectContaining({status: 'pending', discount: 'VIP_20',
      shipping: 'express', q: 'PAY-1048'}),
  });
});
```

- [ ] Test zero rows, named oversize error, RPC rejection, formula-leading customer fields, and totals larger than returned rows. No caught query error may return an empty successful CSV. Task 10 owns the route-level authorization tests when it integrates this adapter.
- [ ] Run `npm test -- tests/admin/order-workspace-queries.test.ts tests/admin/order-workspace-export.test.ts` to red.
- [ ] Implement the server-only adapter. Convert from/to through `sydneyDayBoundary`; strip drawer/presentation params from RPC arguments. Do not introduce a client import of adminDb or Supabase service-role code. Reject malformed responses with a useful server error, never `as OrderWorkspacePage` alone.
- [ ] `getOrderWorkspaceRow(id)` calls the same scope function with validated `p_order_ids: [id]`, default unfiltered parameters, and one server-generated as_of. Decode its facts through the same row validator; return null only for an actual missing order. Test that it never queries the entire list or silently substitutes the first matching row.
- [ ] Preserve these existing CSV columns first and with their old meaning: `order_number,status,customer_name,customer_email,items,total_aud,placed_at`. `items` stays line count for compatibility. Append `shipping_method,payment_state,fulfilment_state,ordered_physical_units,remaining_physical_units,paid_at,shipped_at,waiting_seconds,issue_keys,as_of`. Empty unknown numeric values remain empty, not 0. Use the shared presentation labels and `csvRow` formula protection.
- [ ] Define and test the named oversize error so Task 10 can map it to a readable 400 with “More than 20,000 orders match. Narrow the date range or filters.” Other read/format failures remain errors, not CSV content. Leave the live route unchanged until the list and export can switch in the same integration task.
- [ ] Run the focused tests, legacy `counts.test.ts`, and `npm run typecheck`; commit. Keep legacy `listOrders/orderStatusCounts/ordersCsv` available until their call sites are deliberately migrated; no unrelated query refactor.

**Acceptance:** Export includes all active population filters and fails visibly instead of silently narrowing or truncating.

### Task 4 — Add resilient personal views and layout controls

**Files:** Create `preferences.ts`, `SavedOrderViews.tsx`, `OrderColumnsControl.tsx`, `tests/admin/order-workspace-preferences.test.ts`, and `tests/admin/order-workspace-preferences-ui.test.tsx`.

**Consumes:** Task 1 params/column presets. Receives `adminUserId` from the guarded server page; never derives identity from a client-provided URL.

**Produces:** Controlled components with explicit callbacks:

```ts
interface SavedOrderViewsProps {
  current: OrderWorkspaceParams;
  preferences: OrderPreferences;
  onPreferencesChange: (next: OrderPreferences) => void;
  onApply: (view: StoredOrderView) => void;
}
interface OrderColumnsControlProps {
  columns: OrderColumn[];
  onChange: (columns: OrderColumn[]) => void;
  onReset: () => void;
}
```

- [ ] Test storage corruption, unknown version, missing storage, quota/write exceptions, cross-admin keys, malformed column arrays, duplicate names, 11th view, and URL precedence.

```ts
it('never serializes record-specific context into preferences', () => {
  const preferences = defaultOrderPreferences();
  const encoded = serializeOrderPreferences(preferences);
  expect(encoded).not.toMatch(/customer_email|payment_ref|selectedIds/);
  expect(parseOrderPreferences('{bad')).toEqual(defaultOrderPreferences());
});
```

Also construct a saved view from a current state containing a customer email in q and an order UUID; assert neither appears in the serialized preference. Checking an empty default alone is insufficient.

- [ ] Run the focused tests to red, then implement validation by reconstructing allowlisted fields, not shallow spreading unknown stored objects.
- [ ] Add accessible Save view/Rename/Delete controls. Start with inline forms/popovers that fit inside the toolbar; use existing confirmation for deleting only a saved view preference. Expose the no-search-persistence note. Deleting a saved view never deletes orders.
- [ ] Enforce mandatory first identity column, at least one additional visible column, 10-view limit, and labels for Move up/Move down. Layout changes retain filters and current selection because the population is unchanged.
- [ ] Run focused tests and typecheck; commit.

**Acceptance:** Disabling browser storage does not break order work, and applying a saved view always changes the URL visibly.

### Task 5 — Build the compact workspace and URL-driven toolbar

**Files:** Create `OrdersWorkspace.tsx`, `OrdersToolbar.tsx`, `OrderViewTabs.tsx`, scoped CSS, and `tests/admin/order-workspace-navigation.test.tsx`. Read `OrdersFilters.tsx` for existing date/search behavior; keep its live call site intact until Task 10.

**Consumes:** Tasks 1–4 and `OrderWorkspacePage`. **Produces:** `OrdersWorkspace({params, data, adminUserId, reinstatable})` where reinstatable retains the current `{recoverable:boolean;short:number}` map for visible cancelled rows. Build/test the coordinator and toolbar before connecting its table, drawer, and bulk bar in subsequent tasks. Keep the current production page unchanged until Task 10, so intermediate component work cannot remove existing order actions.

- [ ] Write navigation tests using a functional router harness, not no-op mocks: type debounced search; switch tab; remove discount; retain from/to; clear all filters while retaining view; change page/sort; open saved view; handle old q-only URLs.

```ts
it('keeps discount and shipping when changing the sort', async () => {
  const harness = renderWorkspace({status: 'to_fulfil', discount: 'VIP_20',
    shipping: 'express', page: 3});
  await harness.chooseSort('Order total', 'Descending');
  expect(harness.currentParams()).toMatchObject({discount: 'VIP_20',
    shipping: 'express', sort: 'total_cents', dir: 'desc', page: 1});
});
```

Define `renderWorkspace` in the test file around Testing Library, a memory URL state, and mocked Next navigation that updates that state. Its `chooseSort` uses visible labelled controls; `currentParams` parses the current URL with Task 1's parser. Do not make the test pass by changing state directly.

- [ ] Run `npm test -- tests/admin/order-workspace-navigation.test.tsx` to red.
- [ ] Define the workspace's typed props and a test-only mount that supplies Task 1's synthetic data. No application route switches in this task. The server integration in Task 10 will call requireAdmin, load the read model and visible cancelled-row reinstatability, pass session.userId, and canonicalize a clamped page.
- [ ] Implement one navigation function in the workspace. Filter edits push semantic navigation or replace debounced search as appropriate, preserve other filters, set page 1, clear order, and clear selection. Avoid competing search effects that overwrite restored Back/Forward state. Initial hydration must not navigate.
- [ ] Add 300ms search debounce with cancellation on unmount, Enter to apply immediately, and a pending status. Do not disable the input while fetching or erase the typed value. Keep applied filter chips consistent with server-applied values. Dates get visible labels and invalid-range feedback.
- [ ] Implement primary/More views, count scope labels, explicit mobile sorting, columns, density, and secondary actions. Keep Create order secondary to the task-specific selected-row action.
- [ ] Scope CSS to the workspace, account for the shell's 56px sticky bar, and avoid nested overflow ancestors that disable sticky table headers. No new global typography or storefront token changes.
- [ ] Run navigation and preference tests and typecheck; commit.

**Acceptance:** The URL can reconstruct the active query, and every visible chip/count describes the actual backend filter.

### Task 6 — Make the table and mobile cards readable and truthful

**Files:** Create `OrderWorkspaceTable.tsx`, `OrderCards.tsx`, `OrderStatusPair.tsx`; add `tests/admin/order-workspace-table.test.tsx`. Keep legacy `OrdersTable.tsx` and its existing tests unchanged until Task 10 migrates the live route.

**Consumes:** Rich rows, column IDs, sort params, selection callbacks, and shared labels.

**Produces:** Presentational table/card props shared by both layouts:

```ts
interface OrderListProps {
  rows: OrderWorkspaceRow[];
  params: OrderWorkspaceParams;
  selectedIds: ReadonlySet<string>;
  columns: OrderColumn[];
  density: 'comfortable' | 'compact';
  onToggle: (id: string) => void;
  onTogglePage: () => void;
  onOpen: (id: string, trigger: HTMLElement) => void;
  onSort: (sort: WorkspaceSort, dir: 'asc' | 'desc') => void;
  dialogOpen: boolean;
}
```

- [ ] Write interaction tests for an indeterminate header checkbox, page-scoped label, keyboard row navigation, links preserving modified clicks, checkbox clicks not opening orders, active header `aria-sort` on `<th>`, and no shortcut firing while an input, button, link, or dialog owns focus.

```tsx
it('keeps critical shipping and unknown quantity information visible', () => {
  render(<OrderCards {...listProps} rows={[makeWorkspaceRow({
    shipping_method: 'express', remaining_physical_units: null,
    issue_keys: ['quantity_unknown'],
  })]} />);
  expect(screen.getByText('Express')).toBeVisible();
  expect(screen.getByText('Physical quantity unavailable')).toBeVisible();
  expect(screen.getByRole('button', {name: /open order/i})).toBeEnabled();
});
```

Use a complete typed `listProps` object with `vi.fn` callbacks, Task 1 params/fixtures, default columns, and empty selection in the test setup.

- [ ] Add render cases for long names/email, no name, multiline historical product labels, 10+ items, unknown timestamps, pending payment reference, completed without delivery evidence, and a refunded shipped order. Check that issue text remains when optional columns are hidden.
- [ ] Run focused tests to red, then implement table presentation and connect it to the new workspace. Keep selection callbacks in the coordinator; Task 8 supplies the final selection hook and action bar. Do not copy legacy mutations into either table or mobile cards. Preserve j/k/x/Enter and Escape behavior with discoverable help and actual accessible order links.
- [ ] Show up to three item summaries with size/variant distinction and +N more opening the drawer. Show physical quantities and line count with different labels. Use absolute dates with explicit timezone context; relevant running wait includes “since payment” or “since order placed”.
- [ ] Render only the applicable visible table/card controls to accessibility APIs. Responsive CSS must not leave hidden duplicates keyboard-focusable. Align money and use actual ascending/descending indicators rather than rotating a bidirectional glyph.
- [ ] Run new tests plus `tests/admin/order-actions.test.tsx`, `tests/order-email-ui.test.tsx`, `order-size-visibility.test.tsx`, `shipping-method-visibility.test.tsx`, and typecheck; commit.

**Acceptance:** The operator can identify the item size, physical quantity, shipping service, wait basis, and next action at desktop and mobile widths.

### Task 7 — Add the authenticated order preview and contextual drawer

**Files:** Create preview route/loader and drawer/payment components; add `tests/admin/order-workspace-preview-route.test.ts`, `order-workspace-drawer.test.tsx`, and `order-workspace-quick-payment.test.tsx`. If needed, update only `getOrder` in `lib/admin/order-queries.ts` to propagate errors from its item/event reads instead of treating them as empty successful arrays.

**Consumes:** Existing getOrder/getOrderFulfilment, confirmPayment, Task 1 URLs, Task 3's getOrderWorkspaceRow, Task 5 coordinator. **Produces:** An `OrderPreview` type in `types.ts` containing `order: OrderDetail`, `fulfilment: OrderFulfilment`, and `facts: OrderWorkspaceRow`. Import existing detail types with `import type`. The loader is `getOrderPreview(id: string): Promise<OrderPreview | null>`. Facts supply identical labels/refund totals/physical totals to the table; fulfilment supplies existing physical-lot requirements. Pending fulfilment lines have zero requiredUnits, so use facts for ordered physical quantity and never present those zeros as the purchased quantity.

- [ ] Test the preview route: admin guard runs before reads; malformed UUID 400; missing/deleted order 404; query failure generic 500; successful response `Cache-Control: private, no-store`; no economics or lot-catalogue read on opening the drawer. Do not catch and convert Next authorization redirects/forbidden signals into a 200 or application error.
- [ ] Load order, facts, and fulfilment in bounded parallel reads. A failed child read is an error, not an empty order. If the identity/status/refund totals disagree because a mutation occurred between reads, retry the preview once; if still inconsistent return a retryable conflict with “This order changed. Reload its details.” Do not claim these separate reads are a transactional snapshot. Add a test for a stale facts/detail combination.
- [ ] Write drawer tests with a controllable delayed request: order A starts loading, B is opened, B resolves, A resolves late. B must remain displayed. Abort previous fetches and validate response identity. A 404 shows “Order no longer available” with Close, and a failure offers Retry without changing the list.

```ts
it('does not replace the selected order with a late response', async () => {
  const harness = renderDrawerWithDeferredPreviews();
  await harness.open(orderA.id);
  await harness.open(orderB.id);
  harness.resolve(orderB.id);
  await screen.findByRole('heading', {name: `Order ${orderB.order_number}`});
  harness.resolve(orderA.id);
  expect(screen.queryByRole('heading', {name: `Order ${orderA.order_number}`}))
    .not.toBeInTheDocument();
});
```

Define this test-local harness with two deferred promises and the actual drawer's preview-loading callback; `open` rerenders with a new selected ID, not a fake screen. Also test request abortion and auth-expired/non-JSON responses explicitly.

- [ ] Run these tests to red. Implement a native `<dialog>` drawer to get one modal boundary, body-scroll lock/restoration, labelled title, Escape, and focus return. Render payment review/discard confirmation inline within the drawer, so the existing custom confirmation focus hook does not compete with a second trap. Closing is blocked while a payment write is pending; its status is visible.
- [ ] Keep full shipping service/address visible, and reuse item/size helpers. Show internal notes/activity behind explicit disclosures. The existing full order remains one click away, carrying normalized `returnTo`.
- [ ] Implement order query-param history semantics from Section 2.5. Store origin element and scroll position in the mounted workspace. Changing columns/density must not remount the drawer. Previous/Next use the loaded page only; after a mutation removes the row, preserve an immutable copy of the prior neighbor IDs solely for navigation and revalidate any opened order.
- [ ] Pending payment review displays order, total, entered payment reference, and “Confirms payment, commits stock, and queues the customer receipt.” Submit only `confirmPayment(id, reference)`, disable duplicate submission, preserve input on failure, refresh after success, and report queued rather than delivered email. Do not add a new mark-paid API.
- [ ] Test input discard, pending Escape, focus restoration after row removal, mutation failure/success, opening full order, and normal/modified order link clicks.
- [ ] Run the new tests plus `operations.test.tsx`, `order-actions.test.tsx`, `order-email-ui.test.tsx`, and typecheck; commit.

**Acceptance:** Opening/closing order context does not lose the list, expose private data without authorization, race with older requests, or invent a new shipping workflow.

### Task 8 — Extract clear bulk selection and per-order results

**Files:** Create `OrdersBulkActions.tsx`, `useOrderSelection.ts`, `tests/admin/order-workspace-selection.test.tsx`, `order-workspace-bulk-actions.test.tsx`. Wire the new workspace to this controller/bar; Task 10 removes the legacy table only after its existing action tests have been migrated.

**Consumes:** Current page rows; reinstatability; existing bulkConfirmPayment/bulkReinstate; current params. **Produces:** `useOrderSelection(rows, scopeKey)` with selectedIds, toggle, togglePage, clear, and retainFailures; the action bar receives these values and `onResult`.

- [ ] Test mixed pending/paid/processing/shipped/cancelled selections; restock eligibility; all/none/indeterminate header states; row updates with the same IDs; and scope changes that clear selection. Derive eligibility from current rows each render rather than a stale snapshot.

```ts
it('keeps only failed visible IDs selected after a partial payment result', async () => {
  bulkConfirmPayment.mockResolvedValue({ok: true, moved: 1,
    failed: [{id: second.id, error: 'Stock no longer available'}]});
  render(<BulkHarness rows={[first, second]} />);
  await user.click(screen.getByLabelText('Select all orders on this page'));
  await user.click(screen.getByRole('button', {name: 'Confirm 2 payments'}));
  await user.click(screen.getByRole('button', {name: 'Confirm payments'}));
  expect(bulkConfirmPayment).toHaveBeenCalledWith([first.id, second.id]);
  expect(await screen.findByText('Stock no longer available')).toBeVisible();
  expect(screen.getByLabelText(`Select ${second.order_number}`)).toBeChecked();
});
```

`BulkHarness` mounts the actual selection hook and action bar; fixtures first/second are pending. Initialize `user` with `userEvent.setup`. Add assertions that first is no longer selected and retry sends only second.

- [ ] Run new tests to red. Implement a contextual sticky bar with action-specific counts, review confirmations, duplicate-submit prevention, and explicit no-eligible-order messages.
- [ ] Keep printing limited to selected visible IDs. Preserve reinstatement's existing stock checks and result semantics. Explain skipped/ineligible counts before an action. Never introduce an unreviewed bulk Mark shipped button.
- [ ] Keep failure results in workspace state across `router.refresh`, including full-order links for hidden failures. Explicit Dismiss removes the report. Filter/page changes clear selectedIds and cannot silently restore hidden targets. Stop reading/writing `admin-order-bulk-failures`; remove that obsolete key once if accessible without touching unrelated storage.
- [ ] Prepare packing creates a batch URL from exactly eligible selected IDs in visible sort order and a `returnTo` built without the drawer parameter. Task 9 validates it server-side. The stock-lot/carrier-tools link remains an independent utility link; do not present it as acting on the selection.
- [ ] Run bulk/selection tests and existing payment/reinstatement tests; commit.

**Acceptance:** “5 selected” never means “all matching orders”, and a partial failure cannot cause a successful payment to be applied again through stale selection.

### Task 9 — Respect selected batches in the existing packing workflow

**Files:** Modify `lib/admin/packing.ts`, `[id]/pack/page.tsx`, `PackingMode.tsx`; add `tests/admin/order-workspace-packing.test.ts`, `order-workspace-packing-ui.test.tsx`.

**Consumes:** Task 1 batch/return parser, existing global `packQueuePosition`, current order status, existing shipping action. **Produces:**

```ts
export interface SelectedPackContext {
  ids: string[];
  originalPosition: number;
  originalTotal: number;
  eligibleIds: string[];
  skippedIds: string[];
  nextId: string | null;
  returnTo: string;
}
export function selectedPackContext(
  currentId: string, ids: string[], returnTo: string,
): Promise<SelectedPackContext>;
```

- [ ] Test stable original batch order; only batch members fetched; changed/refunded/cancelled/deleted entries skipped; no fallback to a global order; current order absent from batch; malformed or oversized batch; external returnTo; and legacy direct packing links still using global queue.

```ts
it('never substitutes a global-queue order into a selected batch', async () => {
  const context = await selectedPackContext(first.id,
    [first.id, cancelled.id, last.id], '/admin/orders?status=to_fulfil&shipping=express');
  expect(context.eligibleIds).toEqual([first.id, last.id]);
  expect(context.skippedIds).toEqual([cancelled.id]);
  expect(context.nextId).toBe(last.id);
});
```

Use a mocked `.in('id', ids)` query whose results arrive in a different order; assert the helper restores input order and ignores any unexpected returned ID.

- [ ] Run focused tests to red; implement one bounded server query for the validated batch, authorize at the page before reading it, and preserve original positions separately from remaining eligible positions.
- [ ] On invalid batch or current ID not included, show “This packing batch is invalid” with a safe Back to orders link. Do not continue packing a different order. On an order becoming un-packable, show its actual current state and the next eligible selected entry. Never claim an order is already shipped merely because it fell outside a query window.
- [ ] Add optional `nextHref` and `exitHref` props to PackingMode; default them to the current behavior for non-batch callers. The page computes validated URLs carrying batch and returnTo. On successful shipping, navigate via `nextHref` or `exitHref`, then refresh. Preserve the existing item/checklist/tracking reset on order identity change and existing server mutation validation.
- [ ] Keep `LotPacking`, mandatory tracking, actual lot rules, and dispatch confirmation unchanged. Changing batch navigation must not make new claims that every lot is allocated or every parcel is handed to a carrier.
- [ ] Test the final batch returns to the saved filters/page/sort; skipped-order messaging; two-click protection; errors retain tracking; and switching orders resets the checklist and tracking.
- [ ] Run focused tests plus existing `fulfilment-ui.test.tsx`, `shipping-method-visibility.test.tsx`, `packing-address.test.tsx`, `order-size-visibility.test.tsx`, and typecheck; commit.

**Acceptance:** Selecting two orders and choosing Prepare packing processes those two, with explicit skips if their state changes, then returns to the same orders view.

### Task 10 — Complete route integration and loading/error states

**Files:** Finalize orders `page.tsx`, `loading.tsx`, new `error.tsx`, export route, and full-order return link; add `tests/admin/order-workspace-page.test.tsx` and route-state tests.

**Consumes:** All preceding contracts/components. **Produces:** Complete integrated orders route without prototype dependencies.

- [ ] Replace the live orders page's legacy list/table with the completed workspace. Call requireAdmin before reads, normalize parameters, load Task 3's read model, and load reinstatability only for visible cancelled rows. Pass session.userId. If the server clamps page, canonicalize the URL while retaining filters and preventing zero-result loops.
- [ ] In the same task, switch the export route to Task 3's adapter and shared parser. Call `requireAdmin` outside its application error handler; authorize before any RPC; return private/no-store CSV only after successful construction. Map `ORDER_EXPORT_TOO_LARGE` to the specified 400 message and other failures to a generic 500. Add route tests proving auth precedes data access, discount/shipping/search/date parity, and no successful response on failure.
- [ ] Test no-filter empty To fulfil, filtered empty To fulfil, empty another view, read failure, out-of-range page, unknown values, URL deep-link to a drawer, and recovery after retry. Verify exactly one H1 when rendered with the real shell.

```ts
it('does not say all caught up when a filter hides existing work', () => {
  render(<OrdersWorkspace params={makeWorkspaceParams({q: 'no-match'})}
    data={emptyWorkspacePage} adminUserId="synthetic-admin" reinstatable={{}} />);
  expect(screen.getByText('No orders match these filters')).toBeVisible();
  expect(screen.queryByText(/all caught up/i)).not.toBeInTheDocument();
});
```

Define `emptyWorkspacePage` using every required view-count key set to zero, rows [], total 0, page 1, page_size 25, and a fixed as_of. Do not use an incomplete cast.

- [ ] Run new tests to red. Match skeleton geometry to the final layout; render pending changes without replacing the whole page with a blank screen. Error state offers Retry and preserves URL filters. Do not swallow database errors as zero counts.
- [ ] Full-order page reads optional normalized returnTo; its Back action returns there. Other actions, refunds, lot controls, economics, timeline, and deletion stay as currently implemented. Do not move them into a smaller drawer merely to make the screenshot look complete.
- [ ] Verify old status URLs, q-only search URLs, packing/slip/export links, customer-linked orders, and discount drilldowns still reach the correct view. Keep Completed/Refunded/Cancelled accessible.
- [ ] Migrate the legacy bulk/table cases in `tests/admin/order-actions.test.tsx` and `tests/order-email-ui.test.tsx` to mount the new workspace or bulk harness. Preserve the exact-failure/selection assertion and the ban on bulk shipping without individual tracking. Update the old carrier-import expectation to its independent utility link plus the new selected-batch packing action; do not delete the behavior coverage. Remove unused `OrdersTable.tsx`/`OrdersFilters.tsx` only after no production or test imports remain.
- [ ] Remove only now-unused imports/files within this feature. Inspect the final diff for accidental changes to AdminShell, revenue dashboard, shared storefront tokens, auth, or commerce mutations.
- [ ] Run affected route/table/action tests, typecheck, and focused lint; commit.

**Acceptance:** The production route is coherent in loading, success, empty, filtered-empty, stale-order, and failing-read states.

### Task 11 — Verify actual interactions and responsive accessibility

**Files:** Create actual-component Vite fixture and fake adapters, `tests/browser/orders-workspace.spec.ts`, opt-in Next integration spec/config. Update Vite aliases only for the new fixture's explicit server-action boundaries, preserving existing fixtures.

**Consumes:** Production presentation components with synthetic query/mutation/preview adapters. **Produces:** Reproducible screenshots and browser checks; separate evidence for fixture interactions and real App Router behavior.

- [ ] Build the fixture using actual `OrdersWorkspace`, table/cards, drawer, and bulk bar. Provide at least 30 synthetic orders, all statuses/issues, long content, missing data, several items, two eligible batch orders, and controlled error/latency scenarios. A fixture adapter may update synthetic state, but cannot call Supabase, email, carrier, or production routes.
- [ ] Make query navigation functional for this fixture. Do not globally replace the current preview navigation no-op for unrelated screens. Add a conditional workspace fixture adapter or explicit navigation dependency; ensure the fixture's URL/state changes actually rerender the production component. Loading preview data must be explicitly fake.
- [ ] Add browser assertions such as:

```ts
test('keeps the shipping service and return context through an order preview', async ({page}) => {
  await page.goto('/orders-workspace.html?status=to_fulfil&shipping=express');
  await page.getByRole('link', {name: 'ECL-1048', exact: true}).click();
  const drawer = page.getByRole('dialog', {name: 'Order ECL-1048'});
  await expect(drawer.getByText('Express', {exact: true})).toBeVisible();
  await expect(drawer.getByText('12 Sample Street', {exact: true})).toBeVisible();
  await drawer.getByRole('button', {name: 'Close order'}).click();
  await expect(page).toHaveURL(/shipping=express/);
  await expect(page.getByRole('link', {name: 'ECL-1048', exact: true})).toBeFocused();
});
```

Use those exact synthetic labels in the fixture. When the responsive card uses the Open button instead of an order link, target that known button in the narrow-viewport test rather than relying on a hidden desktop element.

- [ ] Verify 320, 390, 768, 1280, and 1440px widths; 200% browser zoom; reduced motion; long data; narrow full-screen drawer; sticky toolbar/bulk action overlap; no document horizontal overflow; keyboard access to tabs, columns, search, sort, selection, drawer, and confirmation. Check computed contrast with existing Axe tooling; do not call a clean Axe run a full accessibility certification.
- [ ] Browser cases: debounce/Enter/search reset; filtered counts; zero results; separate payment and fulfilment labels; order A/B request race; Escape and input discard; partial bulk failure/retry; saved view apply/rename/delete; denied storage; selected batch; pending and failure states. For the layout target, measure the first actual row/card, excluding fixture banners.
- [ ] Run `npm run test:browser -- tests/browser/orders-workspace.spec.ts` using the existing local fixture server. Add explicit 768/1440 tests inside the spec with `page.setViewportSize` or a focused project, without multiplying every unrelated test project.
- [ ] Add `testIgnore: ['**/orders-workspace-next.spec.ts']` to the ordinary `playwright.config.ts` so a full Vite browser run cannot accidentally invoke authenticated Next tests. The new Next config must explicitly match only `orders-workspace-next.spec.ts` and must not inherit that exclusion.
- [ ] Add `playwright.admin-orders.config.ts` for a separate, opt-in real Next test target. It reads `ECL_ADMIN_ORDERS_BASE_URL` and `ECL_ADMIN_ORDERS_STORAGE_STATE` from the operator's test environment, and refuses a production hostname. Do not read or print credentials in the test. Use a disposable/synthetic local or staging environment and a supplied test login/storage state. Do not create an authentication bypass.
- [ ] Real Next cases must verify direct `?order=` load, push/open then Back/Forward, query-only replace, refresh retaining selection results, full-order returnTo, authenticated preview response, unauthenticated redirect/denial, and selected-batch route navigation. Keep mutations synthetic or in an explicitly disposable test environment. These cannot be considered proven by the Vite fixture.
- [ ] Run real Next tests when that environment is available. If unavailable, mark that gate **not run** with the exact missing setup and do not claim navigation/auth acceptance complete. Complete independent fixture and unit/SQL checks instead.
- [ ] Commit fixture/spec/config changes and synthetic evidence only.

**Acceptance:** The visual review checks actual production components, and routing/auth claims are backed by the right environment rather than no-op preview stubs.

### Task 12 — Review, verify the branch, and prepare the release handoff

**Files:** Create `docs/admin-orders/2026-10-01-implementation-evidence.md`; update this plan's execution ledger. No production publishing is part of this task.

**Consumes:** All implemented tasks and their real outputs. **Produces:** Reviewable branch/diff, reproducible test evidence, known limitations, and concrete release/rollback instructions.

- [ ] Review the whole diff against every Design contract section and the coverage matrix below. Inspect authorization on each new route, query correctness, no client secrets, no fake deadline logic, no current catalogue pack multiplication, no nested focus traps, and no off-page selection surprises.
- [ ] Obtain any independent review required by the execution skill, with a bounded task focused on this branch. Resolve actionable findings; do not introduce unrelated refactors. If delegation is not authorized/available, do a documented self-review and state that limitation.
- [ ] Run final verification from `storefront` on the final code state:

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run test:browser -- tests/browser/orders-workspace.spec.ts
npm run check:budgets
git diff --check
```

- [ ] Because an additive migration is included, run `npm run test:postgres` against its existing loopback-only disposable Docker setup when available. Do not substitute production database access. Run `npm run test:headers` using its documented target/setup if changed route behavior affects those checks. Record unavailable infrastructure distinctly from passing checks.
- [ ] Where the safe real Next environment is supplied, run:

```sh
npx playwright test --config playwright.admin-orders.config.ts
```

- [ ] Record each command, exit/result, commit under test, browser widths, fixture vs real-route scope, and any baseline failures. Fix regressions from this change and rerun only affected checks plus the necessary final gates. Do not copy test counts from older preview documentation.
- [ ] Prepare a release checklist: apply the tested additive migration first; verify grants and RPC shape using a non-production environment; deploy the matching app revision only after user authorization; smoke-test read-only list, filters, counts, CSV, preview, and direct-order links. Production payment/dispatch tests require separately authorized disposable orders.
- [ ] Document rollback: revert the application change to the prior version; leave additive read-only functions in place initially. They do not mutate orders or change existing function contracts. Do not drop functions while any deployed app version uses them. No commerce data rollback should be required.
- [ ] Final executor response links the plan/evidence/diff, names what changed, reports actual checks and limitations, and explicitly states whether anything was deployed. If requesting release approval, present the tested commit and concrete migration/deployment steps so approval is the final step.

**Acceptance:** A reviewer can identify the exact implementation, reproduce checks, understand every unverified gate, and release or roll back without guessing.

## 5. Coverage matrix

| Requirement | Owning tasks | Evidence required |
| --- | --- | --- |
| Compact navy UI, readable table/cards, one H1 | 5, 6, 10, 11 | Real-component screenshots, viewport/heading/overflow checks |
| Visible shipping, historical size, accurate physical counts | 1, 2, 6, 7 | Frozen multi-pool SQL fixture, legacy shipping/size regressions |
| Honest elapsed time, completion, and refund labels | 1, 2, 6 | Missing/invalid/DST timestamp and unsettled-refund cases |
| Task views and objective Needs attention | 1, 2, 5 | Exact predicates, normal-work exclusions, overlap count tests |
| Filters, counts, pages, export share scope | 1, 2, 3, 5 | Combined-filter SQL and route arguments; >1,000 orders; oversize export rejection |
| Personal views, columns, density | 4, 5, 11 | Corrupt/blocked storage, no PII persistence, per-admin scope, visible navigation |
| Drawer and list context | 5, 7, 10, 11 | Request race, focus/discard/pending tests; real Next history/deep-link checks |
| Existing quick payment behavior | 7 | Existing action called exactly once; failure retains input; refresh uses truth |
| Bulk eligibility and partial failures | 8 | Mixed selection, refreshed status, hidden failure report, retry exact IDs |
| Selected packing queue | 9, 11 | Exact selected IDs, changed/missing members, final returnTo, legacy direct links |
| Preserved advanced full-order operations | 10, 12 | Existing action/refund/deletion/lot tests remain meaningful and pass |
| Admin privacy and read-only SQL | 2, 3, 7, 11 | SQL grants, denied route calls before data access, no-store and side-effect checks |
| Safe rollout and rollback | 12 | Tested commit/migration pair, explicit outstanding gates and release authorization |

## 6. Decisions already made; avoid reopening them during implementation

- Use the table-plus-drawer design with existing dedicated packing; do not start by rebuilding the whole admin shell.
- Support fulfilment and payment checks through different default columns on the same workspace.
- Default To fulfil to oldest valid payment wait; do not add an arbitrary overdue SLA.
- Keep physical units distinct from line count and purchased packs.
- Personal saved views are browser-local and structural; no shared database schema for preferences.
- Selection and Previous/Next are page-scoped. Batch packing is explicitly selected, at most 25 IDs.
- Use additive service-only reads, preserving existing commerce mutations.
- A confirmed refund record and a bank transfer are distinct; a completed order and delivery are distinct.
- Build with existing dependencies; keep documentation and test fixtures free of real customer records.

If new evidence contradicts one of these decisions, record the concrete conflict and propose the smallest correction. Continue independent tasks; do not ask the user to reapprove routine implementation details already fixed by this plan.

## 7. Execution ledger

The rows below are the execution record. Procedural checkboxes above retain the original handoff instructions; they are not a second status tracker. Counts are observed task-scoped runs at the listed commits, followed by final whole-branch checks at `1f706bf`.

| Task | State | Commit | Verification / limitation |
| --- | --- | --- | --- |
| 1 — Contracts | Implemented | `a6193ed` | 2 files / 20 tests passed; final review notes Paid/Processing default-sort deviation. |
| 2 — SQL read model | Implemented | `33942e8`, `6004fd6` | 4 files / 39 tests passed; synthetic 10,000-order query plan inspected. |
| 3 — Queries/export | Implemented | `5c42b1c` | 3 files / 20 tests passed; exact scope and malformed-payload tests. |
| 4 — Preferences/views | Implemented | `72903cd` | 2 files / 11 tests passed; corrupt/denied storage and per-admin isolation. |
| 5 — Workspace/toolbar | Implemented | `28c98e0` | 3 files / 14 tests passed; functional URL harness; separate Search all orders control deferred. |
| 6 — Table/cards | Implemented | `5031238` | 6 files / 30 tests passed; existing shipping/size/action coverage retained; payment method display deferred. |
| 7 — Preview/drawer | Implemented | `492d525` | 6 files / 22 tests passed; auth, request races, review, discard and pending states. |
| 8 — Bulk actions | Implemented | `48462ed` | 4 files / 11 tests passed; current-row eligibility and retained failures. |
| 9 — Packing batch | Implemented | `9b57510` | 6 files / 27 tests passed; exact selected IDs and legacy navigation. |
| 10 — Route integration | Implemented | `8821301` | 7 files / 22 tests passed; live list/export moved together, legacy behavior tests migrated. |
| 11 — Browser acceptance | Fixture verified; real Next/native zoom pending | `2abe28c` | Initially 26 browser passes / 4 intentional skips; final 29 passes / 4 skips after review fixes. Safe authenticated environment not supplied. |
| 12 — Review/release handoff | Local review and handoff complete | `1f706bf` plus documentation commit | Five Important findings fixed RED→GREEN; 195 files / 1,202 tests, typecheck, lint, build, 29 browser cases, 30 native PostgreSQL checks, 6 budgets and 9 headers pass. Release/rollback and remaining gates documented. |

Final review covered `255d4e9..2abe28c` with a fresh reviewer. Fix commit `1f706bf` preserves search focus, scopes payment notices to their order, normalizes non-finite timestamps, removes obsolete session failure data, and displays payment/shipment milestone times. The full suite passed after those fixes. There were no declined-to-judge items.

**Ruling:** Client-safe date validation stays in the parameter layer instead of importing the server database query module. Cost if wrong: date boundary drift; DST/filter-argument tests cover this risk.

**Deferred minors:** Payment cells omit the available method; a separately labelled Search all orders action is absent although the All orders tab preserves search; Paid/Processing default to waiting time instead of newest placement, with manual sorting available.

**Unverified gates:** Authenticated real Next history/refresh/navigation needs `ECL_ADMIN_ORDERS_BASE_URL`, `ECL_ADMIN_ORDERS_STORAGE_STATE` and synthetic IDs. Native 200% browser zoom needs manual verification; CSS zoom reflow passed. See the [evidence and release checklist](../../admin-orders/2026-10-01-implementation-evidence.md) for exact setup and limits.

## 8. Research and supporting references

These inform interaction patterns; they are not evidence that a particular merchant's private admin was inspected.

- [Shopify: searching, viewing, and configuring orders](https://help.shopify.com/en/manual/fulfillment/managing-orders/viewing-orders/searching-orders) — task views, columns, direct detail access.
- [Shopify: filtering orders](https://help.shopify.com/en/manual/fulfillment/managing-orders/viewing-orders/filtering-orders) — combined filters and explicit view scope.
- [Shopify: order statuses](https://help.shopify.com/en/manual/fulfillment/managing-orders/order-status) — payment and fulfilment are separate facts.
- [Nielsen Norman Group: complex application design](https://www.nngroup.com/articles/complex-application-design/) — preserve context, reduce clutter, and keep critical information salient.
- Optional local visual reference: `docs/admin-revamp/README.md` and `storefront/tests/preview/admin-revamp*`; these were untracked at planning time.

## 9. Copy-and-paste prompt for the receiving GPT-5.6 Sol task

```text
Implement the admin orders UX/UI plan at:
docs/superpowers/plans/2026-10-01-admin-orders-ux-ui-sol-handoff.md

Read the entire plan, including its embedded design contract, before editing application code. The repository is /Users/shanakajayakody/eastcoastlabs; the app is storefront/. Inspect the current checkout and applicable AGENTS.md instructions. Do not reset to the planning baseline or overwrite unrelated/untracked work.

Use the executing-plans workflow and implement the 12 tasks sequentially, keeping the execution ledger current. This implementation request authorizes the scope defined in the plan. Resolve routine details yourself and continue until the local implementation, tests, and reviewable handoff are complete. If a required test environment is unavailable, record the precise limitation and finish independent work; do not report the missing gate as passed.

Preserve existing payment, inventory, refund, lot-allocation, carrier, audit, and email behavior. Reuse existing actions. Do not invent dispatch deadlines, delivery evidence, physical pack quantities, or settled refunds. Keep rows, view counts, search/filter state, and CSV consistent. Reuse the real packing flow, with exact selected-batch IDs and safe return navigation.

Use synthetic data for tests. Verify both the actual components and real Next.js routing where a safe authenticated test environment is available. Keep changes scoped, commit only task-owned files, and report actual verification results and remaining limitations.

Do not apply production migrations, merge to main, or deploy. Finish with the implementation diff, evidence document, tested commit, and concrete release/rollback checklist ready for review.
```
