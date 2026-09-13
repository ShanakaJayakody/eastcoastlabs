# Local redesign review

Preview: http://localhost:3010/

Branch: codex/storefront-redesign. No push, merge, deployment or production database change has been performed for this redesign.

## Delivered

- A new cinematic homepage, two generated campaign assets, local Inter and Newsreader fonts, editorial sections, accessible collection previews and featured product filters.
- Shared header, mobile navigation, footer and product-card presentation. Matching shop, collection, product, About, Lab Results, research library and stacks styling.
- Live catalog pricing and stock preserved. Size options now passed through the shop's card projection, matching the existing homepage/PDP starting-price behaviour.
- Batch documentation is rendered from verified records; the present unavailable state is explicit. No fabricated certificates, testimonials or purity figures were added.
- An existing zero-threshold gift edge case discovered during testing is fixed locally: gifts require a positive paid subtotal, and are removed when the last paid item is removed. Three regression tests cover empty, persisted gift-only, and eligible paid carts. Gift thresholds and prices were not changed.

## Verification

- All 99 test files passed, 505 tests.
- ESLint passed without warnings. Type checking passed.
- Optimized build passed: all 41 static pages generated; homepage First Load JS 118 KB.
- Browser checks at 1280px desktop, 900px tablet, 390px and 320px mobile. No horizontal overflow at those widths.
- Verified product images load, hero composition, scroll reveals, interactive collection preview, featured filtering, shop search, mobile menu navigation, FAQ state, product pack selection, and adding/removing a local cart item.
- Empty-bag regression verified with the previously persisted gift-only local cart.
- Animation enhancement respects reduced-motion preferences in CSS and the reveal observer. Content is rendered on the server and visible before JavaScript.
- No order, payment or subscription was submitted. The loopback dev server remains running for review.

## Review route

Start at the hero, scroll to Featured, try a research-area filter, explore the ivory collection selector, then the documentation and coastal brand sections. Open Shop and a product to see the shared visual system. Try the mobile menu at a narrow window width.

Asset paths and full prompts: `2026-09-13-editorial-assets.md` in this directory.
