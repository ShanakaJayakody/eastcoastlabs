# Navy homepage parity — 30 September 2026

The `/2` homepage now follows the established homepage's full customer journey in the selected navy design. This change prepares the page for a gradual transition; it does not promote `/2` to `/`.

## Page flow

1. Existing navy hero and reassurance strip.
2. Product finder, popular products and research-area filtering.
3. Research-area explorer with catalogue-backed previews and collection links.
4. Original supplier reports and documentation guidance.
5. Australian brand story and local support details.
6. Research library introduction.
7. Ordering and delivery guidance.
8. FAQs loaded from the same content source as the main homepage.
9. Newsletter signup, full navigation, research collections, customer care and business details.

The desktop and mobile navigation expose Shop, Stacks, Lab reports, Learn, Creators and About. Product, shop, stack and collection journeys retain the existing navy image variant. Destination pages keep their established layouts.

## Accessibility and loading

- Explicit keyboard-operable preview buttons announce the selected collection; separate named links open each collection.
- Product filtering announces a concise result count instead of rereading the entire grid.
- Existing skip navigation, mobile-menu focus handling, FAQ disclosures, focus outlines and reduced-motion behavior remain available.
- Newsletter errors support retry, and success announces the email-confirmation step. Tests intercept requests; no subscription was created during verification.
- The footer is composed on the server and passed into the interactive homepage. Both homepage footers reuse `NewsletterForm`, a client boundary that loads the existing subscription form in a shared chunk while retaining server rendering. This avoids duplicate form code in the shop bundle.

## Verification

- 1,031 tests across 163 files passed, plus the newsletter test passed independently from a cold module load.
- 34 browser checks passed at 320 px, 390 px and desktop, with five intentional device-specific skips.
- Automated WCAG 2 A/AA and 2.1 AA checks found no violations in the tested page and newsletter error/success states.
- Typecheck, lint, production build and all existing route budgets passed. Shop JavaScript measured 139.4 kB gzip against its unchanged 140 kB limit.
- Manually reviewed the actual Next.js build with catalogue data at desktop and mobile widths. Shared FAQs, navigation, research previews and the signup form rendered correctly without horizontal overflow.
- Independent source review found no remaining production issues; its cold-load newsletter-test concern was fixed and verified.

Implementation is on `codex/navy-homepage-parity`. The local production-build preview uses `/2`; publishing or making it the main homepage is a separate step.
