# Editorial assets and provenance

Generated with the built-in imagegen tool on 13 September 2026, then encoded as WebP using sharp. Source outputs remain in the original Codex generated_images directory. Assets are aesthetic campaign imagery, not product testing evidence or photographs of an owned facility.

## Product campaign

Saved to `storefront/public/images/editorial/vial-campaign.webp` (1536 × 1024, approximately 134 KB).

Reference: existing `product images/BPC-157 10mg.PNG` supplied in this project, preserving product identity.

Prompt: “Use case: product-mockup. Create a stunning photorealistic luxury editorial product campaign still life for East Coast Labs website hero. Input image is a product identity reference: preserve the ECL blue monogram, iridescent silver label, clear glass vial, brushed silver cap, white powder and the exact primary label text BPC-157 and 10mg. Label smaller line should read RESEARCH USE ONLY (no purity claim). This is a NEW campaign photograph, not a website mockup. Wide landscape 3:2 composition: a single heroic vial standing on a thick transparent glass rectangular plinth on the right-hand 60% of the image, vial centered at 67% from left, beautifully lighted in soft mint teal and warm white reflections. Behind and to the right, one offset tall translucent ribbed glass slab, architectural and sculptural. Deep nearly black green studio backdrop #0b1513; very subtle atmospheric sea-glass green illumination and soft shadows; left-hand 35% mostly very dark negative space. Vial fills 65% of image height. Fine tactile materials, realistic powder, restrained refracted caustic light on floor, editorial luxury perfume campaign meets scientific precision. Slightly low camera angle, medium-format photography. No galaxy, no sparkles, no stars, no floating particles, no other words outside the vial, no marketing headings, no certificates, no people. Sophisticated quiet cinematic beauty. Landscape image.”

## Coastal study

Saved to `storefront/public/images/editorial/coastal-study.webp` (1536 × 1024, approximately 309 KB).

Prompt: “Use case: photorealistic-natural. Asset: atmospheric brand editorial landscape photograph for East Coast Labs, an Australian research supplies company. Create a breathtaking authentic-looking aerial photograph of the eastern Australian coastline: deep forest-green and dark teal ocean, curving white surf washing against charcoal rock shelves and a pale sandy inlet. Tight abstract composition cropped into the edge of the coastline, sculptural natural textures, elegant and minimal. Early morning soft misty light, rich organic muted colours, almost monochrome sea-glass green with warm ivory surf. Luxury editorial photography, medium-format detail, no buildings, no people, no wildlife, no boats, no text, no logos, no diagrams. Landscape 3:2 composition. This is an atmospheric brand image, not a specific named geographic location.”

## Typography

Inter Latin variable 400–600 and Newsreader Latin italic 400, hosted locally in `storefront/public/fonts`. Downloaded from Google Fonts' official fonts.gstatic.com distribution. SIL Open Font License copies are included next to each font. The existing `/1` variant's font module is unchanged.

## Local preview

Branch: `codex/storefront-redesign`.

Directory: `/Users/shanakajayakody/eastcoastlabs/.worktrees/storefront-redesign/storefront`.

Run `npm run dev -- --hostname 127.0.0.1 --port 3010` from this directory. The local environment reads the existing catalog; no database migrations or production writes are part of this redesign. Do not submit real orders or subscriptions during visual review.
