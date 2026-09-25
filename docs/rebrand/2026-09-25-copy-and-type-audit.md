# Copy and typography audit — 25 September 2026

## Scope and decision

Audit of all three rebrand routes, their shared navigation, heroes, catalogue copy, evidence section, contact copy, resource links, FAQs, footer, page titles and responsive typography. Related About, product, lab-results and learning-page source/content was also checked for inconsistencies in the customer journey. The original homepage, shared product pages and checkout retain their existing design, as requested in the original brief.

The audience is predominantly women, including women after breastfeeding and around menopause. The brief calls for confidence in the supplier, quality and authenticity. The site's catalogue is explicitly for laboratory research only. The revised pages address a visitor's questions without implying that these products are suitable for personal health use.

AI-detector scores are not the acceptance criterion. This work does not claim a human author or a guaranteed detector result. The editorial criteria are specificity, natural spoken phrasing, factual support, useful next steps and consistency with what the business can actually provide.

## Findings and changes

| Finding | Example in the preceding version | Change |
| --- | --- | --- |
| Abstract assurances replaced useful information | “Clarity comes first. Confidence follows.” | “You should know what you’re buying,” followed by specific ways to check product details and reports. |
| Repeated symmetrical slogans made the voice feel manufactured | “Thoughtful by nature. Transparent by choice.” | Straight sentences about the documents, samples and dates a reader can inspect. |
| The brand claimed warmth instead of demonstrating it | “A distinctly human approach”; “A real conversation.” | Direct email access, what to include in an enquiry, actual configured contact hours, and an invitation to ask before ordering. |
| Decorative navigation obscured destinations | “The reading room”; “Meet your next discovery.” | “Before you order”; “Email your question”; “View the products.” |
| Life-stage language implied a relationship and expertise the page had not established | “Every chapter brings new questions.” | Specific acknowledgement in the contact-led variant, with product questions and personal-health questions clearly distinguished. |
| Generated people could be mistaken for customers or team members | Repeated coastal portraits beside reassurance copy | Portraits removed from the rendered routes. The first variant shows an original report; the third shows a contact panel. No invented founder story, staff identity or testimonial. |
| Several display fonts competed for attention | Inter, Georgia, Newsreader italic and Tenor Sans | One existing, self-hosted family: Commissioner, with upright headings and weight used for hierarchy. No new font download or dependency. |
| Styling exaggerated ordinary sentences | Very large italic second lines, tightly compressed headings, tiny tracked capitals | Smaller heading scale, natural letter spacing, sentence-case labels and 16–18px reading text. |
| Decorative components lengthened the page without adding substance | Numbered image panels and large resource-card icons | Plain resource rows; decorative captions, fake catalogue indices and portrait frames removed. |
| The empty state invented an operational explanation | “The collection is being updated.” | “There are no products to show here.” An empty result does not establish that the catalogue is being updated or that a request failed. |
| Testing claims needed to stay tied to their evidence | Historical supplier reports featured alongside current products | Sample, report date and historical status remain visible. Current batch coverage must be confirmed; a historical report is not represented as a current-batch guarantee. |

## Three distinct approaches

- `/1`: buyer reassurance. “You should know what you’re buying.” Sage palette, original supplier report beside the introduction, products before the longer testing explanation.
- `/2`: document-led evaluation. “What did the lab actually find?” Navy palette, laboratory reports before products, precise instructions for checking a result.
- `/3`: accessible contact. “You can ask us before you order.” Plum palette, direct email panel and contact hours, a more conversational introduction.

All three retain the same factual standard. Their differences are emphasis and page order, not different promises about product quality.

## Findings outside the rebrand routes

These are recorded for the original storefront review; this change does not silently rewrite the existing site.

1. `app/(store)/about/page.tsx` still uses “Grounded in curiosity. Guided by clarity.” and the older display styling. Its underlying About copy contains more useful concrete information on dispatch, packaging and enquiries. A later original-site revision should lead with those facts and a verified account of the people behind the business.
2. Multiple files in `content/guides/` make blanket claims that every batch is independently tested and published before listing. Examples include `understanding-a-certificate-of-analysis.md` and `ghk-cu-research-overview.md`. The rebrand implementation has historical reports plus a service for published batch documents; those alone do not substantiate a blanket claim about every current batch. Reconcile the wording against an actual batch-to-report inventory before relying on it as a trust promise. The rebrand resource links go directly to reports and its own explanatory FAQs.
3. `content/KLAVIYO_COPY_DECK.md` and parts of `content/HOMEPAGE_PDP_COPY.md` contain stronger guarantees and fulfilment promises. These are content-deck findings, not a claim that every line is currently rendered or sent. Check the active messaging configuration before a wider rollout.
4. Product imagery still uses existing catalogue/campaign assets. The blue collection image is an illustrative generated product arrangement, not documentary evidence. No image is labelled as a real customer or used to prove quality.

## Authentic details still needed from the owner

The implementation uses the contact details and hours already configured in the site. It does not invent a founder name, personal origin story, clinical credentials, years trading, number of customers, response-time promise or testing procedure.

A short account from the owner about who handles enquiries, why the business started and what happens when a batch is checked would add more distinctive character than another adjective. Actual staff and product photography would also do more for authenticity than generated portraits. These details can be added once supplied and confirmed.

## Editorial rules for future changes

- Say what a customer can check, receive or ask. Replace an adjective with the fact that supports it.
- Use “we” for the business and “you” where it sounds natural. Use contractions, but do not force slang or add deliberate errors.
- Avoid promises about a visitor's body, weight, menopause or recovery. Do not make readers feel inadequate to sell a product.
- Use an ordinary sentence when a heading does not need to be a slogan.
- Label historical reports, sample results and current batch documents accurately.
- Give links the name of their destination or action.
- Keep body text readable, use upright headings and preserve 44px touch targets.
- Read the copy aloud. If it sounds like something no one at the business would say, revise it.

## Verification of this revision

- Browser checks at 320, 390, 768 and 1440 pixels across all three routes: no horizontal overflow, one H1, Commissioner loaded, no italic display headings. All visible links, buttons and FAQ controls in the phone/tablet checks met the 44px target size.
- Mobile navigation, its section links and FAQ opening were checked. Direct contact links use the configured support address. Original report links and human-readable dates were checked.
- The About label contrast issue identified during review was corrected by using the light section background with dark text. The empty catalogue state was made neutral.
- All 717 regression tests passed in 134 files. TypeScript and focused ESLint passed. A production build without service credentials completed successfully; rendered catalogue content was checked separately against the local configured preview.
- No original-homepage, product-page, checkout, pricing, inventory or measurement behaviour was changed.
