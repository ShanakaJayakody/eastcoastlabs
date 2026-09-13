# Hero refinement and original supplier report restoration

Local review only. No live database rows, storage objects, customer records or deployments changed.

## Hero

Headline: “Premium peptides. Buy with confidence.”

Five products follow the existing 90-day paid-order merchandising ranking in storefront/lib/catalog.ts: Retatrutide, GHK-Cu, Tesamorelin, KLOW, BPC-157. This is a campaign selection, not a real-time availability claim; product pages remain authoritative for stock and size.

Built-in image-generation tool used. The five existing branded packshots were supplied as packaging references. No original packshot or report was edited.

Generated source: /Users/shanakajayakody/.codex/generated_images/01a0981e-1b1d-79f0-a032-88017e95a9f2/exec-962bff77-cdf1-447e-999d-2df822ed0360.png

Final website asset: storefront/public/images/editorial/five-vial-campaign.webp (1536 × 1024, 259,974 bytes).

### Final generation prompt

Use case: compositing / product-mockup.
Asset type: premium East Coast Labs website hero photograph, landscape 1536x1024.
Primary request: Create a stunning photorealistic five-vial campaign composition, using the five supplied product photographs as packaging identity references. Exactly FIVE vials: RETA 10mg, GHK-CU 100mg, TESAMORELIN 10mg, KLOW 80mg, BPC-157 10mg. One of each.
Scene: refined cinematic studio still life on low sculptural translucent sea-glass plinths and deep forest-green stone. Near-black forest green background #07110e, soft ivory and muted sea-glass mint rim light, beautiful realistic glass reflections. Expensive editorial fragrance-campaign lighting, restrained, elegant, tactile.
Composition: image will fill the right half of a website, separate from text. Arrange all FIVE vials as a tightly composed staggered shallow arc across the central 80% width; RETA is the large foreground centerpiece, GHK-CU left-middle, TESAMORELIN right-middle, BPC-157 far left, KLOW far right. All five labels visible and readable, no vial cropped, no heavy occlusion. Vial cluster occupies about 75% height; only modest breathing room above and around. Subtle height and depth variation, physically plausible identical vial design. Do not include headline or page UI.
Preserve brand invariants: original blue square interlocking ECL monogram, prismatic holographic silver label, black bold uppercase product name, blue size text, brushed silver caps, realistic clear glass and powdered contents; blue powder for GHK-CU and KLOW, white for others.
Label text exactly: "RETA" "10mg"; "GHK-CU" "100mg"; "TESAMORELIN" "10mg"; "KLOW" "80mg"; "BPC-157" "10mg". Bottom line on ALL labels "RESEARCH USE ONLY". Do NOT include the original 99% purity line, any purity numbers, lab verification marks, medical claims, certificates, or batch numbers.
Avoid starfields, sparks, galaxies, neon green halos, sci-fi effects, needles, humans, extra vials, duplicate vials, competitor branding. Smooth subtle coastal light in background. Render five distinct, beautifully lit branded vials, not a flat collage.

## Reports

14 original owner-supplied PNG/JPEG report images copied without modification from /Users/shanakajayakody/eastcoastlabs/JanoShik Tests/ to storefront/public/lab-reports/. Byte-for-byte comparison passed for every file. All reports visually read in full; QR verification URLs independently decoded with Apple Vision and checked against printed task numbers and keys. Metadata is in storefront/lib/lab-reports.ts.

These are historical supplier reports, not current-stock or ECL-lot confirmations. Client/manufacturer and sample names preserved. The original files are served as images, not represented as lab-issued PDFs. GLOW and KLOW have content measurements but no stated purity; no percentage invented. Multi-sample purities preserve every value at three decimal places; no averaging. MOTS-C, Selank, and Semax have unknown batches. GHK-Cu report is for 50mg, not 100mg. IGF report is for 1mg. Supplier reports are separate from getAllCoa and never feed current-lot claims or packing slips.

Online verification: Janoshik rejected automated requests (HTTP 403); independent lab authenticity was not confirmed. The public UI offers the actual QR-code verification URL and printed key, without lab-verified/current-batch badges.

### Source mapping

| Source file | Janoshik task | Website file |
| --- | --- | --- |
| BPC 10mg, Aug25_.png | 74164 | bpc-157-74164.png |
| GHK50mg 2024.png | 51162 | ghk-cu-51162.png |
| GLOW70mg Dec25_.png | 94947 | glow-94947.png |
| IGF 1mg March25_ .png | 60548 | igf-60548.png |
| KLOW80mg Dec25_.png | 92380 | klow-92380.png |
| MOTS-C 10mg Nov 25.jpg | 91237 | mots-c-91237.jpg |
| MT-2 Jan25_.png | 56427 | mt2-56427.png |
| Reta10mg Dec25_.png | 94556 | retatrutide-94556.png |
| Selank 10mg Nov 25_.jpg | 91217 | selank-91217.jpg |
| Semaglutide10mg May25_.png | 66282 | semaglutide-66282.png |
| Semax 10mg Nov 25.jpg | 91216 | semax-91216.jpg |
| TB500 10mg Nov25_.png | 89714 | tb-500-89714.png |
| Tesa10mg Nov25_.png | 89939 | tesamorelin-89939.png |
| Tirz 10mg May25_.png | 65360 | tirzepatide-65360.png |

## Verification

New tests cover report search by compound, task and batch; no-results recovery; unchanged original links; exact individual purity values; missing purity and unknown batch handling; and homepage original-report availability without current-stock claims. Existing verified-certificate tests remain unchanged.

Final lint, typecheck, full suite (100 files / 509 tests), and optimized production build passed. All 14 originals also served successfully via HTTP on localhost and matched the source files byte-for-byte. Browser checks confirmed report search, expandable results, source-size context on the GHK-Cu product page, and responsive hero/report layouts. No deployment performed.
