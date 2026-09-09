# Creator page editorial refresh — 9 September 2026

The owner asked for an overhaul of formulaic copy, repeated headline structures, polished synthetic people and rectangular image frames, with creative discretion. This refresh supersedes earlier page-layout and copy directions while keeping the confirmed commercial offer.

## Direction

A direct invitation: “Show us what you’re making.” A single sentence in a serif headline replaces the paired slogan and italic subline. Left-aligned copy sits beside a sculpted candid group scene. Staggered portraits use an arch, pebble and asymmetric cutout. A quieter mint and charcoal palette belongs to ECL while the cream offer section gives the page a change of pace.

The former opportunity strip, rewards grid and process grid are consolidated into one explanation. Product value, the three-post commitment, completion reward, conditional referral invitation and content ownership remain explicit. All FAQs and awkward form prompts are rewritten in plain Australian English. No commercial rates, selection guarantees or testimonials have been added.

## Images

Mode: built-in imagegen. All people are fictional adults. The page includes a concise disclosure; no scene represents an actual ECL partnership or product use. Masters live in `docs/creator-program/assets/editorial-refresh/`; delivery WebPs live in `storefront/public/images/creators/` under the `candid-` filenames.

| Scene | Master | Delivery asset | Dimensions | Bytes |
| --- | --- | --- | --- | ---: |
| Studio | `assets/editorial-refresh/cover.png` | `storefront/public/images/creators/candid-cover-1200.webp` | 1200 × 800 | 80,626 |
| Fitness | `assets/editorial-refresh/fitness.png` | `storefront/public/images/creators/candid-fitness-800.webp` | 800 × 1200 | 76,794 |
| Everyday health | `assets/editorial-refresh/health.png` | `storefront/public/images/creators/candid-health-800.webp` | 800 × 1200 | 67,266 |
| Biohacking | `assets/editorial-refresh/biohacker.png` | `storefront/public/images/creators/candid-biohacker-800.webp` | 800 × 1200 | 84,796 |

Master paths in the table are relative to this document; delivery paths are relative to the repository. Combined delivery size: 309,482 bytes (302.2 KiB). Decorative crops use CSS so the source photography stays intact.

## Verification

- Production build, TypeScript check and targeted ESLint check passed.
- Creator unit suite: 46 tests passed across nine files.
- Creator browser suite: 29 tests passed; four viewport-specific cases intentionally skipped. Covers 320px, 390px and desktop layouts, image decoding, links, FAQ keyboard interaction, form validation, review/submission, retry states, radio keyboard interaction, mobile sticky CTA and reduced motion.
- Axe found no WCAG A/AA violations in the rendered production page's main content at 390px and 1440px, after revealing every section. Removed form-step opacity animation to preserve readable text throughout transitions and underlined the FAQ email link.
- Actual Next.js page checked at 320, 390, 768, 1024 and 1440px: all four images loaded, intended Newsreader font present, no horizontal overflow. Separate review also checked 820 and 1023px.
- Independent code/offer review: no actionable findings. Form submission was exercised only against the isolated test fixture; no real application was sent.

Screenshots of the reviewed design are in `evidence/2026-09-09-editorial-refresh/`. They were captured locally before release integration.

## Production release

The owner subsequently requested: “commit live to production”. The release integrates the refresh with `9f1c783`, preserving the newly required phone number, exact audience count, custom Other topic, privacy notice version and submission contract. The optional audience-range wording from the initial visual draft is superseded by that required-count question. This refresh introduces no database migration or production configuration change.

The combined source passed all 490 unit tests across 93 files, all 32 applicable creator browser checks (four intentional viewport skips), and the production build. The form diff against the current production source contains only the requested wording changes.

The combined source goes through the normal required GitHub `verify` check before fast-forwarding `main` and using the existing Vercel production deployment. The release task records the final commit and verifies the canonical creator page and four image assets after deployment. No live application submission is needed to publish these presentation changes.

## Generation prompts

Exact generation prompts follow.

### cover

Use case: photorealistic-natural. Asset for an Australian independent creator program website, East Coast Labs. Documentary editorial photography, believable unretouched adult people with distinctive individual faces, asymmetric features, visible skin texture, everyday physiques, worn-in clothes. Cool charcoal and muted teal with warm natural skin tones. Shot on 35mm film, gentle organic grain, candid timing and available light. No glossy influencer aesthetic, beauty retouch, airbrushed skin, identical perfect teeth, hyper-sharp HDR, cinematic teal-orange grade, posed direct-to-camera smile, plastic 3D look, decorative graphics, typography, watermarks, logos, product vials, medical activity, needles or implied product results. Fictional people, not actual brand partners. Create ONE landscape photograph, 1536x1024 composition. An informal evening break during a small content shoot in a converted Melbourne warehouse studio, five adult creators aged 28 to 48 around a scruffy work table. Off-centre loose composition with their heads in the central 70% for an organic crop. Foreground left a short-haired woman with a prominent nose in a faded dark green shirt leans against the table listening, at centre a laughing stocky brown-skinned man with close-cropped hair and uneven stubble looks toward his colleague, a freckled red-haired woman has her back three-quarter to camera, another woman with square glasses looks down at a camera, a tall man partly obscured farther back. Everyday real personalities, subtle expressions and incidental gestures, nobody performing to the camera. Medium-wide view, unposed and intimate, not a group lineup. Silver studio lamp, black camera and coiled cable on the table, grey painted brick, one teal studio curtain, warm side daylight. Natural imperfect framing, faces optically clear without excessive contrast; foreground table slightly soft. Scene feels like being invited into a working creative studio.

### fitness

Use case: photorealistic-natural. Asset for an Australian independent creator program website, East Coast Labs. Documentary editorial photography, believable unretouched adult people with distinctive individual faces, asymmetric features, visible skin texture, everyday physiques, worn-in clothes. Cool charcoal and muted teal with warm natural skin tones. Shot on 35mm film, gentle organic grain, candid timing and available light. No glossy influencer aesthetic, beauty retouch, airbrushed skin, identical perfect teeth, hyper-sharp HDR, cinematic teal-orange grade, posed direct-to-camera smile, plastic 3D look, decorative graphics, typography, watermarks, logos, product vials, medical activity, needles or implied product results. Fictional people, not actual brand partners. Create ONE portrait-oriented photograph, 1024x1536 composition. A 34-year-old woman with a strong slightly crooked nose, uneven freckles, auburn hair loosely tied back and flyaways, athletic but ordinary build in a worn forest-green oversized T-shirt, after filming a training video in a modest old boxing gym. Three-quarter waist-up candid view. She is looking down and sideways with a relaxed half-smile while checking the playback screen on a black mirrorless camera resting on a low bench, both hands mostly outside the frame. Her face is in the upper-central third, surrounded by generous space for an arch-shaped crop. Warm window light, faded grey plaster, out-of-focus heavy bag at the back. Skin subtly flushed with natural texture and light perspiration, little makeup. A real quiet moment between takes, no product endorsement or performance display.

### health

Use case: photorealistic-natural. Asset for an Australian independent creator program website, East Coast Labs. Documentary editorial photography, believable unretouched adult people with distinctive individual faces, asymmetric features, visible skin texture, everyday physiques, worn-in clothes. Cool charcoal and muted teal with warm natural skin tones. Shot on 35mm film, gentle organic grain, candid timing and available light. No glossy influencer aesthetic, beauty retouch, airbrushed skin, identical perfect teeth, hyper-sharp HDR, cinematic teal-orange grade, posed direct-to-camera smile, plastic 3D look, decorative graphics, typography, watermarks, logos, product vials, medical activity, needles or implied product results. Fictional people, not actual brand partners. Create ONE portrait-oriented photograph, 1024x1536 composition. A 43-year-old woman with medium olive skin, shoulder-length dark curly hair with a few greys, round face, small mole on cheek, a fuller everyday body type, wearing a faded blue overshirt, at a real apartment kitchen table in overcast daylight. She is talking to a friend who is outside the frame, eyes looking off camera, caught with a small lopsided smile, one forearm resting on the table. Loose waist-up framing with head in upper middle and ample space for sculpted rounded crop. A small compact camera, plain ceramic mug and open notebook are visible on table. Lived-in kitchen with timber, subdued teal cupboard and plant in background. Quiet, relatable, a person with years of life in her face, not a lifestyle stock model. Available side light, no beauty lighting.

### biohacker

Use case: photorealistic-natural. Asset for an Australian independent creator program website, East Coast Labs. Documentary editorial photography, believable unretouched adult people with distinctive individual faces, asymmetric features, visible skin texture, everyday physiques, worn-in clothes. Cool charcoal and muted teal with warm natural skin tones. Shot on 35mm film, gentle organic grain, candid timing and available light. No glossy influencer aesthetic, beauty retouch, airbrushed skin, identical perfect teeth, hyper-sharp HDR, cinematic teal-orange grade, posed direct-to-camera smile, plastic 3D look, decorative graphics, typography, watermarks, logos, product vials, medical activity, needles or implied product results. Fictional people, not actual brand partners. Create ONE portrait-oriented photograph, 1024x1536 composition. A 39-year-old South Asian man with a long face, receding wavy hair, thin wire-frame glasses, slight under-eye circles and patchy short beard, average physique, wearing a creased faded black cotton shirt at a home desk. He is in three-quarter profile, thoughtfully listening to audio through one ear of over-ear headphones while looking down at a notebook, with a laptop and small recorder partly seen near frame bottom. Natural editorial candid medium portrait from chest upwards, face in upper central third with room around it for a rounded asymmetric crop. Shelves with books and old camera equipment, cool window daylight and a small warm desk lamp, charcoal and muted blue palette. An independent researcher making a podcast; ordinary and thoughtful. No lab coat, medical equipment or futuristic holographic interfaces.

### Cleanup pass (cover and biohacker)

Edit this photograph only to remove ALL readable text and lettering from the scene: blank the wall posters, signs, book spines, camera brand marks, clothing printing and headphone labels. Replace any slogan or typography with plain unmarked paper, solid book binding, unmarked fabric or the existing wall surface as appropriate. Preserve every person, facial feature, pose, skin texture, lighting, composition, colour, photo grain, objects and dimensions exactly. No additional objects, no replacement slogans, no new words or logos. We need a clean candid editorial photo, not a message-bearing image.
