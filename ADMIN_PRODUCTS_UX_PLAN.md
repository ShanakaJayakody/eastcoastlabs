# Admin Products UX Redesign Plan

> Status: **all four phases implemented and pushed** (commit `7b024cf`, 2026-08-28).
> Outstanding: no browser verification — the admin needs a Supabase session and the
> Interceptor CLI isn't installed on this machine. Build + typecheck pass.
> Scope: `/admin/products` (list), `/admin/products/[slug]` (editor), `/admin/products/new` (create).
> Files: `storefront/app/admin/(dashboard)/products/*`, `storefront/components/admin/{ProductsTable,ProductEditor,NewProductForm}.tsx`, `storefront/lib/admin/products.ts`.

## Why it feels clunky today (diagnosis)

1. **Variant-per-row list.** Every product renders 3–4 rows (one per pack tier), so ~10 products become ~35 rows. But stock is ONE vial pool per product — the per-tier "On hand"/"Available" columns are all *derived* from the same number, so 80% of the table is redundant noise.
2. **No visual anchors.** `ProductListRow.image` exists but the list shows no thumbnails; no status badges on the list (draft/archived/coming-soon products look identical to active ones).
3. **Hidden interactions.** Inline price edit (click the price), inline stock adjust (click "Available" → injected form row), and product-checkbox toggle (click the name area) are all invisible until discovered. The page needs a footer paragraph to explain itself — a classic smell.
4. **Bulk bar mismatch.** Bulk stock adjust operates on *variant IDs*, but stock lives on the pack_size=1 pool — bulk-adjusting a 3-pack row is conceptually wrong. Bulk reprice by % across mixed tiers is rarely what you want. Uses `confirm()` (blocks browser-pane testing — known feedback).
5. **Search requires a submit button.** No live filtering, no status filter, no sorting.
6. **Editor has three save models.** One dirty-tracked save bar (details/pricing/SEO), immediate ledger writes (stock), and a separate "Set" button (cost) — with cost appearing in three places (pricing table column, sidebar card, receipt input). Users can't predict what's committed when.
7. **Editor is one long scroll** — Details → Media → Pricing → Inventory → SEO with no wayfinding; status is buried in a sidebar `<select>`; header shows the slug instead of status/stock at a glance.

## Design direction

Product-centric, Shopify-grade patterns, sized for a small catalog (~10–20 products): **one row per product**, progressive disclosure for tiers, a **drawer** for stock (the highest-frequency task), and a **tabbed/anchored editor** with one save model made explicit.

---

## Phase 1 — Products list: product-per-row (biggest win)

Rewrite `ProductsTable` + `products/page.tsx`:

- **One row per product**: thumbnail (40px, from `image`), name + SKU, **status badge**, price range ("$89 – $399" from tiers), **vials on hand** (the pool number — the only real stock figure), low-stock warning pill, tier count.
- **Expandable row** (chevron): reveals the tier sub-table — label, SKU, price (inline-editable, keep pencil affordance visible), margin, availability. Per-variant detail is there when needed, gone when not.
- **Filter tabs** above the table: `All · Active · Draft · Coming soon · Archived · Low stock` with counts — replaces the `?low=1` link-in-a-sentence. URL-driven (`?status=`, keep `?low=1` working).
- **Live search**: debounced input updating `?q=` via `router.replace` — no Search button. Filters name/SKU/compound.
- **Sortable headers**: name, stock, price (client-side; dataset is small).
- **Stat strip** at top: total products, total vials on hand, low-stock count, inventory value at cost (data already available via `unit_cost_cents`).
- Remove the explanatory footer paragraph — the UI should no longer need it.

## Phase 2 — Stock drawer (replace injected row + bulk bar)

- Click the stock number (or a per-row "Adjust" action) → **right-side drawer**: current pool, qty ± with reason/note/cost-per-vial (reuse `adjustStock` action), "these vials can fill: N×1, N×3, N×6" preview, and movement history — all in one place, same component reused by the editor.
- **Kill the variant-checkbox bulk bar.** Replace with product-level selection supporting the two real jobs:
  - *Receive stock* across selected products (steps through each pool, or a compact multi-product form in the drawer).
  - *Bulk reprice %* on selected products (all tiers), with a proper `ConfirmModal` instead of `confirm()` (existing component; also fixes the browser-testing blocker).
- Undo-toast pattern is good — keep it.

## Phase 3 — Product editor reorganisation

- **Sticky page header**: back link, name, status pill + inline status switcher (Active/Draft/Archived/Coming soon as a segmented control, not a sidebar select), stock-at-a-glance, actions menu (View on store · Duplicate · Archive), and **prev/next product** navigation.
- **Section nav** (sticky in-page anchor tabs: Details · Media · Pricing · Inventory · SEO) so the scroll has wayfinding. Keep single-page scroll — real tabs would fight the one dirty-save model.
- **One cost home.** Cost per vial lives only in the Inventory section (weighted-average display + edit + receipt costing). Pricing table keeps its read-only Cost/Margin columns, sourced from it. Delete the sidebar cost card.
- **Save-model clarity**: keep the dirty save bar for form fields; visually mark the Inventory section as "applies immediately · ledger" with a distinct treatment (it already says this in prose — make it structural: different card accent + section header chip).
- Waitlist card, storefront link, summary card stay in the sidebar; sidebar slims to Status/Storefront/Waitlist/Summary.
- Movement history moves into the shared stock drawer component from Phase 2.

## Phase 4 — New product flow + polish

- `NewProductForm`: add live **margin preview** next to prices (cost field optional at creation), initial-stock field grouped under an "Inventory" header, clearer "packs auto-price from 1-vial (15%/25% off) until overridden" affordance (badge on auto fields that clears on override — currently invisible).
- Empty/edge states: coming-soon products get a proper single row (already handled, restyle to match new row design).
- Mobile: product rows collapse to card layout (name/thumb/stock/status); drawer becomes bottom sheet.
- Keyboard: `/` focuses search; CommandPalette already exists — register "Go to product…" entries.

## Verification (per phase)

- `bun run build` (redirect to log file, never pipe to head — known artifact-corruption rule).
- Interceptor on `/admin/products`: filter tabs, live search, expand row, drawer adjust (+ledger row appears in history), bulk reprice via ConfirmModal.
- Confirm pool math unchanged: 30 vials ⇒ 30×1 / 10×3 / 5×6 shown correctly (regression for the known "packs show 0" failure).
- Server actions untouched in Phase 1 (pure presentation); Phases 2–3 reuse existing `adjustStock`/`bulkPriceChange`/`saveProductAll` actions.

## Sequencing & effort

| Phase | Scope | Est. |
|---|---|---|
| 1 | List rewrite (product rows, tabs, live search, stats) | ~1 session |
| 2 | Stock drawer + bulk redesign | ~1 session |
| 3 | Editor header/nav/save-model cleanup | ~1 session |
| 4 | New-product polish + mobile + cmd-K | ~0.5 session |

Phase 1 alone removes most of the perceived clunk. Each phase ships independently.
