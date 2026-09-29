# Navy design review — 29 September 2026

The owner selected version 2. This update refines the `/2` review page and redirects retired `/1` and `/3` bookmarks to it. The official `/` homepage is unchanged. Publishing this as the main site requires the owner's approval after reviewing the finished design.

## Design

- Original `storefront/public/logo.png` ECL symbol, paired with the same name and research-peptide descriptor as the established storefront, in header, mobile navigation and footer.
- Full-width navy product hero with a continuous background, calm photography and the previously approved headline. On phones the photograph follows the actions; all five vials remain visible.
- Porcelain product sections, original navy vial artwork, clear size/price controls and useful report links. Product availability, prices and ranking come from the existing catalogue.
- A more compact laboratory-document section, the welcoming coastal editorial portrait, ordering steps, accessible native FAQ disclosures and a consistent navy footer.
- Scoped typography and colour styling; the bag retains the shared storefront purchase controls. Payment options and shipping context use current settings.
- Rebrand experiment allocation is frozen. Historical attribution identities and old product-image queries remain readable; the retired landing designs no longer render.

## Image provenance

Asset: `storefront/public/images/rebrand/navy-hero-2026.webp` (1774 × 887, 109,700 bytes). Generated with the built-in `image_gen.imagegen` tool and converted to WebP using Sharp, without compositing or retouching. Original generated file: `exec-9d6784de-8996-4d86-a99d-414dbcd9adcb.png`.

Edit target: `storefront/public/images/rebrand/research-collection-v2.webp`. The original monogram is used directly in the website header and footer; it was not regenerated.

Prompt:

> Use case: style-transfer / product-mockup. Asset type: premium East Coast Labs website hero photograph.
> Edit target: supplied existing five-vial East Coast Labs product image. Preserve the exact five identifiable vials, blue ECL geometric monogram, legible navy-on-white label typography and silver caps. Preserve these labels exactly: BPC-157 10 mg, GHK-CU 100 mg, RETATRUTIDE 10 mg, TESAMORELIN 10 mg, KLOW 80 mg. Preserve each line "99% PURE · THIRD PARTY LAB TESTED" and "RESEARCH USE ONLY". Keep white material for BPC, RETATRUTIDE and TESAMORELIN, blue material for GHK-CU and KLOW.
> Change the setting and composition into a wide 2:1 horizontal photograph suitable for a seamless full-width website hero. Deep ink navy background, approximately #10283f, smoothly shading into a soft desaturated blue light behind the vials at right. The leftmost 43 percent must be mostly empty, very dark uniform navy for white website text added later; no text in this space. Place the five vials together in the rightmost 55 percent, with their complete silver caps and bases fully visible and breathing room at all edges. Centre Retatrutide slightly forward, the others in a balanced staggered arrangement. Elegant pale slate and subtle translucent blue glass plinths, gently reflective matte surface. Professional scientific still-life photography, crisp authentic label detail, soft daylight and silver highlights, approachable and polished. Light the products well so they feel welcoming and clear against the navy. Minimal, tactile, expensive editorial art direction.
> No extra headline, no UI, no badges, no watermark, no people, no neon, no smoke, no black rocks, no sparkle, no molecules, no invented certifications. Preserve ECL logo and label wording. Keep the outermost left edge and top-left perfectly plain navy so the photograph can blend seamlessly into the page.

## Review coverage

Automated acceptance checks cover 320 px, 390 px and desktop layouts, category filtering, image/brand links, serious accessibility violations, readable bag actions, keyboard focus containment and mobile-menu dismissal. Unit checks cover retired-route redirects and existing imagery/navigation/measurement behaviour. The production homepage and purchasing source files are unchanged.

The first local baseline run showed timing failures under heavy machine load. Once the machine recovered, the full final suite passed: 913 tests across 153 files. Typecheck, lint and the production build passed. New responsive browser checks passed at 320 px, 390 px and desktop: 8 checks, plus one intentionally skipped desktop-only mobile-menu case. An independent source review found no remaining blockers after correcting shared cart colour scope and menu-logo dismissal. CI verifies the compressed route budgets on the release platform.
