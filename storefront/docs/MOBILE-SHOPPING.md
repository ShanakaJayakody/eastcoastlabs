# Mobile shopping improvements

Implemented on `codex/mobile-shopping`, based on the approved first pass. Local changes only; no deployment or store-setting changes.

## Shopper experience

- The mobile product opening shows the image, selected size and per-vial price together. Stock, vial size and documentation links follow, with long descriptions below the purchase controls.
- Before the main purchase button is visible, the bottom action says **Choose options** and focuses the size/pack controls. After scrolling past the button, it adds the selected size, pack and quantity. It disappears while the main button is visible or the cart is open.
- The announcement bar, product purchase information, cart and shipping page use the same normalized shipping rules as checkout. Included shipping, disabled express service and thresholds after discounts are handled consistently.
- Configured payment labels and the **Order → Transfer → Payment confirmed** sequence appear before checkout. Payment credentials remain on the existing payment flow.
- Product facts distinguish a product-level certificate, historical supplier evidence and unavailable documentation. No customer reviews or certifications were invented.
- The known GHK-Cu image labelled 10 mg is replaced with correctly labelled 50 mg and 100 mg illustrations. New catalogue photography is preserved.
- Product descriptions and documentation render on the server. Size selection, pack selection and cart actions remain interactive.

## Local preview

From this worktree's `storefront` directory:

```sh
PREVIEW_PORT=4198 npm run preview:audit
```

Open `http://127.0.0.1:4198/mobile-shopping.html`. This preview uses synthetic prices and stock, clearly labelled at the top, with actual storefront components and styles. It includes two available sizes and a sold-out size. Production purchases are not made from this fixture.

## Verification

- Unit suite: 747 tests across 140 files.
- Browser regression suite: 80 passed, 7 expected skips. After the server-rendering change, the 12 mobile-shopping and product-size cases passed again at 320 px, 390 px and desktop widths.
- Production build, TypeScript check and all route JavaScript budgets pass. Product page: 141.6 kB gzip, against the unchanged 142 kB limit.
- Browser checks cover direct documentation jumps, a button covered by the fixed header, selected pack/size pricing, sold-out variants, cart visibility, horizontal overflow and serious/critical accessibility findings.

Conversion impact needs measurement after release. Compare mobile product-view → add-to-cart, add-to-cart → checkout, and checkout → payment-confirmed rates by device and traffic source. The existing analytics consent rules remain in effect.

## Illustration provenance

Created with the built-in ImageGen tool, then resized to 800 px square and encoded as WebP. Both outputs were visually inspected. Sources were the existing v1 GHK-Cu illustrations; the unsupported printed purity/testing line was removed.

- `public/images/products/ghk-cu-100mg-labelled.webp` — 100 mg.
- `public/images/products/ghk-cu-50mg-labelled.webp` — 50 mg.

Exact prompt template, run once with `SIZE=100` and once with `SIZE=50`:

> Use case: precise-object-edit. Asset type: clearly labelled illustrative product image for existing research supply storefront. Edit target: the single attached GHK-CU SIZE mg product illustration. Change ONLY the small line of text reading '99% PURE · THIRD PARTY LAB TESTED': remove that entire text line completely and reconstruct the clean white paper label underneath. Preserve the ECL logo, exact 'GHK-CU' name, exact 'SIZE mg' vial content, 'RESEARCH USE ONLY' green band, vial shape, lighting, texture, colours, blue material and off-white background unchanged. Keep same square framing. Do not add purity, certification, testing or health claims. Output one edited image.

## Follow-up experiments

Use post-release funnel data to choose the next change: size/pack comparison clarity, image zoom with verified photography, clearer delivery estimates, or shorter checkout forms. Express wallets require an actual supported payment integration and have not been represented as available.
