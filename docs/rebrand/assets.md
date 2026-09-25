# Rebrand image provenance

The images were created with the built-in image-generation tool and converted to WebP assets with Sharp. Existing originals were preserved. Product labels remain illustrative photography; current specifications come from the catalogue. No image is used as laboratory evidence.

## Vial catalogue — 25 September 2026

All three rebrand directions have 41 individual vial illustrations: 20 current product/size combinations and 21 coming-soon products. The original blue ECL monogram is retained throughout. Route `/1` uses sage/ivory, `/2` navy/porcelain and `/3` plum/blush. The friendly editorial portraits remain in place.

Assets: `storefront/public/images/rebrand/vials/{v1,v2,v3}/*.webp` (123 images, 1000px square). The navy hero is `storefront/public/images/rebrand/research-collection-v2.webp`.

The [complete prompt and asset manifest](./vial-image-prompts.json) records each delivered file, generation source, exact prompt and SHA-256. Images were edited with the built-in `image_gen.imagegen` tool; Sharp was used only for proportional resizing and WebP conversion.

The owner explicitly confirmed **“99% Pure · Third Party Lab Tested”** for all current peptide batches, with current reports “on the way”. This label wording follows that confirmation; those new reports have not been independently checked or published here. Coming-soon vials and bacteriostatic water do not carry the claim. Historical report images and their qualifications are untouched.

The query parameter `rebrand=v1`, `rebrand=v2` or `rebrand=v3` carries the selected imagery through shop, product, size, shared navigation and cart links. The original homepage and untagged shop/product URLs retain their existing imagery. Correctly labelled 50/100 mg GHK-CU and 10/20 mg Retatrutide images follow the selected size. Prices, stock and catalogue identities are unchanged.

Validation: all 123 asset URLs return the expected WebP file; OCR checks confirm product names, strengths and claim presence/absence across the complete set. Individual vials are 43–67 KB. Mobile collection and size-switching views were inspected, and navigation/size/stock isolation has regression coverage. Typecheck, full lint and 724 tests passed before release.

## Coastal portrait

Restored to the rendered routes on 25 September 2026 at the owner’s request for a more welcoming, friendly design. It appears in the sage and plum heroes and the navy contact section. It is editorial brand imagery, not a customer or team photograph.

### Original generation

Saved asset: `storefront/public/images/rebrand/coastal-women.webp`

Prompt:

> Create a premium editorial brand photograph, landscape 3:2, for an Australian research company seeking a more welcoming, mature, trustworthy identity. Two everyday women, one approximately 36 with dark brown shoulder-length hair and one approximately 58 with silver-blonde bob, standing beside each other on a quiet Australian coastal path. Waist-up candid portrait, relaxed confident expressions looking slightly off-camera, natural skin texture, normal diverse body shapes, understated linen shirts in cream and muted sage, no athletic attire. Coastal grasses, hazy pale blue sea in background, soft overcast morning sunlight, restrained olive/sage/ivory colour palette, refined contemporary magazine photography, 50mm lens, realistic and beautifully art-directed, gentle movement, ample soft natural background around subjects. Image only, no words, no logos, no vials, no medicine, no medical imagery, no laboratory coats, no implied results or testimonials. This is conceptual brand imagery, not a patient or customer photograph.

## Research collection

Saved asset: `storefront/public/images/rebrand/research-collection.webp`

Reference: existing `storefront/public/images/editorial/five-vial-campaign-blue.webp`, inspected before editing.

Prompt:

> Restage this existing East Coast Labs product photograph as a calm trustworthy premium scientific still life for a female-majority mature audience. Preserve the five identifiable clear-glass silver-capped vials, exact product labels and ECL blue logos: BPC-157 10mg, GHK-CU 100mg, RETA 10mg, TESAMORELIN 10mg, KLOW 80mg, all with RESEARCH USE ONLY labels. Preserve white powder in BPC, RETA and TESAMORELIN and blue powder in GHK-CU and KLOW. Change the entire set and lighting: luminous high-key cool ivory studio backdrop, very pale mist blue matte smooth rounded cylindrical plinths, restrained subtle shadows, no dark areas, no black rocks, no floating particles, no holographic neon glow, no dramatic smoke, no sparkle. More space between vials and generous empty pale background above them. Straight-on elegant magazine product photography. Keep labels legible but natural, no new marketing text, no badges. Landscape 3:2. The finished look should feel precise, clean, professional and serene.
