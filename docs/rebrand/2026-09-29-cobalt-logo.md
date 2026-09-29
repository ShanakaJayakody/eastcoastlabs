# Navy accent logo refinement

The navy review page (`/2`) uses the ECL navy accent (`#275B88`) for the ECL monogram, paired with a dark-navy horizontal Manrope wordmark. The footer reverses the full lockup to white. The wordmark retains the existing name and research-peptides descriptor. The original homepage remains unchanged.

## Assets

- `storefront/public/brand/ecl-cobalt-master.png`: original transparent image-generation output, 1254 × 1254.
- `storefront/public/brand/ecl-cobalt-symbol.png`: trimmed, resized transparent symbol, 512 × 512. Used as a CSS alpha mask so the displayed lockup has one uniform ink colour.
- `storefront/app/(variant)/2/icon.png`: symbol-only 96 × 96 favicon in the ECL navy accent, scoped to the review route.
- `storefront/public/fonts/manrope-latin.woff2`: unchanged Google Fonts Latin variable subset; OFL license beside the font. The Manrope family is used only in the wordmark.

The reference was the user's blue interlocking ECL monogram image, `Codex Image Sep 28, 2026, 12_01_26 PM.png`. The built-in image-generation tool produced the transparent symbol. Sharp was used for trimming, resizing, the navy favicon export and PNG output. The website applies the ECL navy accent through the source image's alpha mask, so the original cobalt source image is retained only as source artwork. The website wordmark is live, selectable text rather than generated lettering.

## Generation prompt

```text
Use case: logo-brand / identity-preserve.
Asset type: a production-ready symbol-only East Coast Labs logo, transparent PNG.
Reference image: the attached existing blue interlocking ECL monogram. Use ONLY the large geometric monogram as the reference; do not include its bottom wording.
Create a meticulous clean professional redraw of this SAME recognizable interlocking ECL symbol. Preserve the visual structure: the near-square outer frame, the nested angular E at left, the upright inner L in the middle, and the C-shaped channel at right. Preserve its overall balance and architectural, orthogonal geometry. Regularize all strokes and negative-space channels so they are optically even and remain distinct at favicon sizes. Avoid tiny hairline gaps or ragged edges. The shape must feel precise, scientific, established, confident and welcoming.
ONE perfectly uniform flat solid ink colour only: vivid cobalt blue, HEX #245CFF. Absolutely no gradients, texture, lighting, shadows, 3D effects or extra colours. Transparent background with real alpha, not a black or white rectangle. Crisp horizontal and vertical edges, subtly optically corrected intersections, squared corners. No invented flourishes.
Composition: the symbol only, no wordmark, no tagline, no letters outside the monogram, no frame around the artwork beyond the logo's own geometry, no mockup or presentation board. Square canvas. The full mark occupies roughly 90% of the canvas, centred with equal transparent clear space on all sides. Its silhouette is close to square. Output at high resolution so it can be cleanly reduced for a website header and 32px favicon.
```

## Validation

- Navy browser checks: 12 passed, 3 viewport-specific skips, including mobile 320/390 px, desktop, tablet hero layout, keyboard navigation and accessibility scans.
- TypeScript and ESLint passed.
- Visually reviewed the header, mobile menu, footer and symbol-only favicon; verified the route-specific favicon metadata.
