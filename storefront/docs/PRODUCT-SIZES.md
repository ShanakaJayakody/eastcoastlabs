# Product sizes

In **Admin → Products → select a product → Sizes & pricing**, choose **Add size**. On an existing unlabelled product, enter its current size (for example, `10 mg`), then the new size, single-vial price and opening stock. Optional 3-vial and 6-vial pack prices are suggested at the existing 10% / 20% savings and can be edited or omitted.

Each size row has its own **Save size**, **Manage** stock button and expandable **Cost per vial** setting. Size prices and labels save together. Stock receipts and cost changes save immediately. Save or discard unsaved product details before adding or editing sizes. Hide an unavailable size using **Show this size on the store**; hiding it preserves its stock, orders and previously disabled pack offers. An enabled size with no stock remains visible to customers and has a **Notify me** form.

New products can label the first size during creation and add more in the product editor. Duplicating a sized product copies the whole size group as a draft with zero stock, preserving hidden sizes and retired packs.

Customers see one product in listings and choose size buttons on its product page. Selecting a size updates its single-vial price and available pack offers. Different sizes remain distinct in cart, checkout, orders, refunds and physical lot selection. Each size has independent inventory and cost. Product copy, images and publication status are shared.

## Release

The production size migration was applied on 9 September 2026 after the prerequisite audit release. All 34 recorded migration checksums verify, with no pending migrations. Existing products, prices and inventory were retained; no example sizes were added to the live catalogue.

A fresh private backup of the application and migration-history schemas restored successfully, with all 37 table row digests matching. The size migration and size creation/price editing were exercised against that restored copy, including verification that the original size's inventory remains independent. Synthetic size edits were rolled back.

Apply `20260909090000_product_sizes.sql` after the existing migration chain using the [tracked migration procedure](MIGRATIONS.md), then deploy the matching app. The migration adds grouping metadata and guarded RPCs; it does not create example sizes, change current prices or move existing inventory. The original SKU and existing cart identities remain intact. Additional sizes use stable internal slugs; public links redirect to the parent product with the selected size.

Verify on staging with operator-approved labels/prices: add a size, save custom prices, receive stock, add two sizes to cart, and confirm the order and physical stock pool. Sample data and screenshots in local preview are synthetic. Once child sizes have been created, retain this app version or later; older app versions do not group child SKU records.

Existing product-specific stack definitions continue to use the original size. An available alternative size does not substitute for that promised bundle component. Bulk pricing includes all sizes; stock adjustments for sized products are made on the specific size to prevent applying a quantity to the wrong strength.

## Verified preview

[Customer size selector](product-sizes/storefront-mobile.png) · [Admin size editor](product-sizes/admin-desktop.png). Both screenshots use synthetic data.

Feature validation: 406 tests, 28 browser checks (2 intentional skips), 22 native PostgreSQL checks, TypeScript, lint, production build and route bundle budgets passed. After integrating the live release's packing and monitoring fixes, 422 tests, TypeScript and lint passed.
