# Product size options

**Goal:** Let an operator add sizes and prices under one product, and let shoppers select a size using simple pill buttons.

**Design:** Keep the existing product as the default size and its existing checkout identity. Additional sizes are child SKU records with their own existing pack variants, inventory, cost and order history. A nullable parent reference groups these records into one public product and one admin listing. This preserves the tested per-product stock pools, reservation, refund and packing workflows without rewriting financial operations.

**Constraints:** No production data changes or deployment. Existing carts and orders keep their identities. Size labels and prices are operator supplied; no sample prices or strengths are seeded. PostgreSQL changes are additive. Child sizes inherit parent publication status and shared content; individual sizes can be hidden without deleting historical orders.

- [x] Database: add parent/size metadata and guarded atomic size creation/edit RPCs. Reject duplicate/blank labels, invalid amounts, stale edits, cross-product IDs and nested groups. New size stock uses the existing receipt ledger. Test independent reservations, paid stock and refunds with disposable PostgreSQL.
- [x] Admin: add an inline Sizes & pricing editor, automatic editable pack prices, opening stock and per-size stock drawers. Keep the product list grouped and include every size in stock totals and bulk pricing. New products can label their first size.
- [x] Catalog: load size records with the parent, display one card/page, resolve child links to the parent, and retain each size's actual price, stock and checkout slug. Test hidden sizes and a sold-out default with an available alternative.
- [x] Storefront: add accessible size pills and changing prices above pack options. Reset pack/quantity when changing size and keep size-specific cart lines. Test adding two sizes and price reconciliation after reload.
- [x] Verification: run unit/database suites, typecheck, lint, production build and synthetic browser checks on desktop/mobile. Document migration/release steps and admin usage.

## Verification

406 tests passed in 82 files; typecheck and lint passed. All 28 applicable browser checks passed across 320 px, 390 px and desktop; two desktop-only mobile menu cases were skipped by design. The complete migration chain applied to disposable native PostgreSQL; 22 concurrency, privilege and restore checks passed. Production build and route bundle budgets passed without service credentials. Independent review found no remaining blocking issues. No hosted database was changed.
