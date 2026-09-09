# ECL Creator Collective — program and page design

> **Commercial copy superseded, 9 September 2026:** The owner has confirmed a product-reward program with no upfront cash fee. Use [OFFER-AND-MESSAGING.md](../../creator-program/OFFER-AND-MESSAGING.md) for all commercial terms, selection criteria and page copy. The paid-brief packages, previous follower-count messaging and proposed referral percentages below are historical and must not be implemented. Existing visual and technical decisions continue where compatible.

**Prepared:** 9 September 2026\
**Status:** Approved for implementation with the [user's visual update](2026-09-09-creator-visual-update.md), which takes precedence over earlier visual assumptions. Commercial terms remain proposed pending public launch.\
**Primary destination:** `/creators`\
**Primary CTA:** Apply to the collective\
**Companion:** [Implementation plan](../plans/2026-09-09-creator-collective.md) · [Creative assets and prompts](../../creator-program/README.md)

## 1. The recommendation

Build **ECL Creator Collective**, a premium, application-based creative partnership program. The page should feel like an independent fashion publication meeting a precise research brand: expressive people photography, generous space, oversized type and clearly stated compensation.

The first release recruits creators for paid, individually approved creative briefs. Proposed fees begin at **A$300 per commissioned brief**. Applying is free; selection and paid work are not guaranteed. A second, conditional commercial track can introduce referral commissions for products and channels that have been specifically cleared for promotion. These are proposed business terms, not existing ECL offers or researched market rates.

The immediate conversion is a qualified, successfully saved application. It is not a product purchase or an email-list signup. Every major page decision should make that application easier and more attractive.

### Three approaches considered

| Approach | Strength | Trade-off | Decision |
|---|---|---|---|
| Paid creative collective | Strong design proposition; rewards craft without requiring a large audience; simple pilot operations | ECL funds content before measuring commercial return; public use still needs review | Recommended first release |
| Affiliate rewards program | Clear commercial incentive and measurable referral revenue | Product advertising eligibility, attribution, refund accounting and discount economics all need resolution | Separate second phase |
| Invitation-only ambassador club | Strong exclusivity and relationship depth | Harder to communicate value without established partners and demonstrated benefits | Use later for recurring collaborators |

### What success looks like

Within seconds, a visitor understands who ECL wants, what the opportunity pays, and how to apply. Within one scroll, they see the creative standard. The application can be completed on a phone without a media-kit upload, account creation or product purchase.

## 2. Existing website context

The repository has a Next.js 15 / React 19 / TypeScript storefront, Tailwind 4, Supabase, a protected admin area, optional Resend delivery and GA4. It also contains legacy WordPress/WooCommerce code; the creator work belongs in `storefront/`.

The main store uses near-black navy, turquoise and system sans typography. The `/1` experiment has a warm paper theme with Newsreader, Inter and IBM Plex Mono. The proposed creator page uses the established dark store shell, then introduces warm editorial photography and an ivory reward section within the page. It does not re-theme the rest of the store or create another experiment arm.

Specific integration findings:

- `app/(store)/layout.tsx` already provides header, footer, cart and analytics.
- `components/Header.tsx` supplies desktop and mobile links from one array.
- `/1` has separate `DossierHeader` and `DossierFooter` navigation.
- Newsletter capture and exit-intent currently appear on general content routes. `/creators` needs to be excluded so they do not compete with applications.
- `lib/analytics.ts` explicitly allows public paths. A new path will not be tracked until added there.
- `app/sitemap.ts` maintains a list of static routes.
- There is no creator application, creator account, commission ledger or payout system to reuse.
- Checkout reserves an order before an administrator confirms payment. A future commission must never vest merely because checkout returned success.
- Database writes and admin access already have important transactional and privacy protections. Extend those patterns.

## 3. Program offer

### First release: paid creative briefs

Public benefit language: **“Paid briefs from A$300. Creative freedom within a clear brief. Room to build something ongoing.”**

| Proposed brief | Fee, AUD excluding GST where applicable | Deliverables | Intended use |
|---|---:|---|---|
| First collaboration | A$300 | One edited 15–30 second vertical video and three edited still photographs | Trial an approved concept and working relationship |
| Campaign collection | A$750 | Three edited 15–30 second vertical videos and eight edited stills | A coordinated campaign with two agreed creative concepts |
| Ongoing collaboration | Individually quoted after a successful brief | A defined monthly scope, scheduled together | Recurring creative work; no guaranteed monthly income |

The landing page needs only the starting fee and three benefits. Keep the detailed production packages in the creator brief and agreement, rather than making the page resemble a pricing comparison tool.

**Commercial defaults for the pilot:**

- Australia-based adults, 18 or older. No minimum follower count for content production. Judge work, audience relevance and reliability.
- No fee to join; no purchase, self-experimentation, positive review or personal endorsement required.
- ECL agrees the scope, fee, approved subjects, deadline and rights in writing before work begins.
- 50% of the agreed fee is payable on booking after the agreement and invoice; the remainder is payable within 14 calendar days of accepted delivery and a valid invoice. Agreement must address cancellation and work already completed.
- ECL gives consolidated feedback within five business days. One reasonable revision round is included; a new concept or changed brief is additional paid scope. Creators retain applicable rights for work that is cancelled or cannot be published; the agreement must not allow indefinite acceptance delays.
- Default content licence: 90 days, non-exclusive, for ECL-owned website and organic social channels in the agreed territory. Licence starts on the agreed first publication date, no later than 30 days after final payment unless both parties agree otherwise.
- Paid media, account whitelisting, raw files, AI training, synthetic likeness use and broad exclusivity are outside this default licence. Negotiate any additional use explicitly.
- Posting on a creator's own account is a separate, optional deliverable with its own fee and review. Producing a video does not silently include posting it.
- Any supplied product or prop is specified in the brief. Do not automatically promise free peptide products or send a kit on application acceptance. Prop provision and any actual product supply need separate eligibility decisions.
- No automatic newsletter enrolment. Application correspondence is separate from marketing.

**Initial operations:** One owner reviews applications twice weekly, selects briefs within a capped budget, and tracks delivery, licence expiry and invoices. The first page release does not need a creator dashboard or automatic bank payouts.

### Conditional later track: referral rewards

This is a commercial design to evaluate, not an offer to put on the public page at first release.

| Element | Proposed rule |
|---|---|
| Base commission | 15% of eligible net merchandise revenue |
| Partner commission | 20% by written invitation after two profitable months; prospective only |
| Audience code | 10% off explicitly eligible products; no code stacking |
| Attribution | Explicit valid creator code at checkout wins; otherwise last valid creator referral within 30 days |
| Qualifying orders | Payment confirmed, eligible line items, no self-referral, fraud or cancelled sale |
| Vesting | 30 calendar days after payment confirmation, provided the sale remains eligible |
| Payout | Monthly by the 15th, on vested balances of at least A$50; smaller balances roll forward |
| Termination | Pay valid remaining vested balances in the next cycle, including amounts below A$50 |
| Returns | Reverse only the commission attributable to returned/refunded eligible amounts; preserve an adjustment ledger |

Commission basis excludes GST actually included in the sale, shipping, gifts, ineligible items and refunded merchandise. Use actual order tax accounting; do not assume every order includes GST or infer it by blindly dividing by 1.1. Lock the applicable rate and eligibility against the paid sale. A subsequent tier change must not change earlier earnings.

For a purely illustrative order with **A$100 of eligible merchandise excluding GST before discounts**, a 10% code leaves A$90. A 15% commission is A$13.50, leaving A$76.50 before product cost, fulfilment, payment cost and other expenses. At 20%, commission is A$18 and the remainder is A$72. On this basis, discount plus commission consumes 23.5% or 28% of the original merchandise price. Confirm contribution margin on every eligible product and pack before selecting a rate.

The current discount path operates at order-subtotal level. SKU eligibility requires coordinated quote, order, discount and refund changes; it cannot be implemented by simply adding a creator code in the admin screen. Give this track its own commerce spec and tests after eligibility and unit economics are established.

## 4. Product promotion and truthful representation

This affects the proposed business model and creative usage, rather than merely adding footer wording.

The TGA's 13 April 2026 advisory explicitly identifies promotion of unapproved peptides through influencers as likely to breach Australian therapeutic goods advertising laws. It also explains that research-use disclaimers do not change a product's regulatory status or remove supply and advertising obligations. The examples include GHK-Cu, which appears in the supplied artwork. Accordingly, these vial-in-hand images are **private campaign concepts pending product-specific review**, not publication-ready approval. Switching from affiliate commission to a flat creative fee does not itself make promotional content lawful. [TGA advisory](https://www.tga.gov.au/safety/safety-monitoring-and-information/safety-alerts/understanding-your-responsibilities-when-importing-compounding-and-supplying-unapproved-peptide-products)

Before any public launch, establish the lawful scope of the recruitment page, named products, images, linked destinations and creator channels. If product promotion is not permitted, the public recruitment creative needs a genuinely suitable non-product brief and corresponding artwork; removing a claim or shrinking a disclaimer is not the solution. This document does not establish the legal classification or advertising eligibility of ECL's catalogue.

Social advertising and incentivised posts must be truthful. Real paid partnerships should be disclosed clearly; stock models and synthetic people must not be presented as actual ECL partners, reviewers or customers. [ACCC social media promotions](https://www.accc.gov.au/business/advertising-and-promotions/social-media-promotions)

Creative rules for this project: fictional adult models; no names, handles, invented follower numbers or quotes; no claims that a model uses the product; no transformation, physique, dosing, administration, recovery, weight-loss or therapeutic story. Do not suggest scientific credentials through white coats or invented researcher identities. The images demonstrate a visual direction. A holding pose alone does not establish that a public campaign is permissible.

## 5. Art direction: “The creator issue”

### The feeling

An exceptionally well art-directed magazine cover. Human, tactile and confident. The vial's silver holographic label provides a restrained technical note; creator portraits provide warmth and character. Let photography and typography do most of the work.

### Palette and type

| Role | Value | Use |
|---|---|---|
| Midnight | `#080B10` | Page ground and shared store shell |
| Soft ink | `#121821` | Application surface and quiet separations |
| Warm paper | `#F4F2ED` | Rewards feature section and light supporting surfaces |
| Chalk | `#E7EBF2` | Primary text on dark |
| Turquoise | `#2FD4C8` | Primary CTA, focus and very limited rules |
| Cobalt | `#2155D9` | Occasional art-direction accent echoing the vial; not general body text |
| Slate | `#A4AFBE` | Supporting text on dark, subject to measured contrast |

Use Inter for headings, paragraphs and controls. Use Newsreader italic for one expressive phrase in the hero and one later heading. IBM Plex Mono belongs only on brief numbers, small section labels and creative captions. Reuse the fonts already configured in `lib/fonts.ts`, scoped to the page.

Desktop hero heading: `clamp(3rem, 6.1vw, 6rem)`, line-height `0.98`, tracking `-0.045em`. Desktop section headings: 44–56px. Mobile hero: 44–54px at 390px, no smaller than 38px at 320px. Body: 17–18px with 1.55 line-height. Form controls: 16px minimum. Caption text: 12–13px.

### Composition

- 1200px content maximum, 32px desktop side padding and 20px mobile padding.
- 12-column desktop grid; four-column mobile grid. Hero copy occupies five columns, photo seven.
- 104–128px between major desktop sections; 64–80px on mobile.
- Square or 4px-radius photography; up to 12px on the form only. Avoid framing every sentence in a rounded card.
- Hairline rules, numbered sections and aligned baselines. One large image is more valuable than a collection of tiny portraits.
- No decorative molecules, neon blobs, glass cards, floating money badges, animated earnings counters or artificial scarcity.

### Desktop first screen

Keep the existing ECL header. Beneath it, a small “ECL / CREATOR COLLECTIVE” kicker precedes a generous split hero. The headline is on a dark, uninterrupted surface at left; the hero photograph is large at right. Use the wide source photograph in an approximately 1.25:1 frame with `object-position: 68% 50%`, checked visually so both the hand and face survive. Do not crop the original master destructively.

The primary CTA has a generous rectangular silhouette and an arrow at its right edge. Secondary CTA is a text link. Below both, a short practical note anchors the proposition. A small caption under the image identifies the AI concept while concept imagery is used.

### Mobile first screen

Use this order: program kicker, headline, two short lines of supporting copy, full-width primary CTA, practical note, hero image. Do not put a tall portrait above the opportunity. Use a 4:3 image crop with the face and product inside the centre-right safe region. The first CTA should be visible without requiring a full-screen image scroll at typical phone heights.

After the hero CTA scrolls out, show a simple sticky bottom “Apply to the collective” button. Hide it while the application is in view, while a form field has focus, and when the cart or navigation modal is open. Include safe-area padding and space so the control does not cover content. It must not appear on other routes.

### Motion

One 350ms opacity/12px reveal for secondary sections, preferably using the existing `Reveal` component after checking its interface. Keep hero and CTA visible immediately. Buttons transition colour over 160ms; the arrow can shift 3px. Respect reduced motion. No scroll hijacking, looping ticker, background video or parallax.

## 6. Full page narrative and copy

This is proposed public copy after the offer, imagery and permitted scope have been confirmed. Build the preview with an explicit concept label. Do not publish a claim about availability, staffing or compensation until ECL can honour it.

### 01 — Hero

**Kicker:** ECL / CREATOR COLLECTIVE\
**H1:** Your perspective.\
**Second line, italic:** Our next chapter.

**Body:** Bring your eye for storytelling to East Coast Labs. Apply for paid creative briefs, build your portfolio and help shape what comes next.

**Primary CTA:** Apply to the collective →\
**Secondary CTA:** Explore the rewards ↓\
**Microcopy:** Australia · 18+ · No minimum follower count

**Photo caption during concept use:** AI-generated campaign concept. Fictional model.

### 02 — The opportunity, in one line

Three quiet, equally weighted items separated by rules:

**Paid creative briefs** / **Your individual perspective** / **Ongoing opportunities**

This is a statement of program structure, not testimonials or performance statistics.

### 03 — A standard worth creating for

**Heading:** An eye for detail. A point of view.

**Body:** We’re looking for creators who notice the details and know how to make a story feel considered. Photographers, filmmakers and visual storytellers: show us the work that feels most like you.

Two offset editorial images with a wide gutter: warm hero detail or additional authorised crop at left; cool portrait at right. Caption them “01 / Natural light” and “02 / Studio perspective”, never invented creator names. Preserve the original packaging label; do not add pseudo-scientific claims in captions.

**Text link:** Show us your work → (same application anchor)

### 04 — Rewards, clearly stated

Ivory section, dark text, strong numeral, generous spacing. Heading: **Good work deserves a clear offer.**

**A$300**\
**Paid briefs from**\
For selected creators. We agree the scope, fee and usage rights before you start.

Two adjacent text columns:

**Create in your own voice**\
A clear brief and space for your perspective. We agree what you’ll make and how it will be used.

**Build something ongoing**\
A first project can become a longer creative relationship, with each collaboration agreed together.

Small note: **Fees are in AUD, excluding GST where applicable. Applying does not guarantee selection or paid work.**

Do not show the conditional 15–20% affiliate offer, referral codes, an earnings calculator, a countdown or unverified partner count here.

### 05 — How it works

Numbered steps on one horizontal rule, stacked naturally on mobile:

1. **Send your perspective.** Share your profile, portfolio and the kind of work you love making.
2. **Find the right brief.** If there’s a fit, we’ll agree a concept, deliverables, fee and usage rights.
3. **Create. Get paid.** Deliver the agreed work, collaborate on feedback and receive payment under your brief.

### 06 — Who should apply

**Heading:** A strong point of view goes further than a follower count.

Three compact rows: **Photographers** — composition, light and product detail; **Filmmakers** — considered short-form stories; **Content creators** — original ideas and a clear visual identity.

**Body:** You don’t need a huge audience. You do need original work, reliable communication and an understanding of the brief. Initial applications are open to Australia-based creators aged 18 or over.

### 07 — Application

**Heading:** Let’s make something considered.\
**Intro:** Tell us a little about yourself and share your best work. We review applications individually and contact creators when there’s a suitable opportunity.

**Form submit CTA:** Send my application →\
**Submission pending:** Sending application…\
**Success heading:** Your application is in.\
**Success body:** Thanks for sharing your work. We’ll review your application and contact you by email if there’s a suitable opportunity.\
**Failure:** We couldn’t confirm your application was saved. Your details are still here. Please try again.\
**Unavailable:** Applications are temporarily unavailable. Please try again later or contact ECL.

Offer the actual configured support email as a contact link. Do not link to a new, unbuilt `/contact` page. Do not claim an email was sent merely because the database write succeeded.

### 08 — FAQ

**Do I need a large following?** No. For creative briefs, we assess the quality and relevance of your work, rather than setting a minimum follower count.

**How are creators paid?** Selected briefs start at A$300. Deliverables, fees, usage rights and payment dates are agreed before work begins. The fee shown is in AUD, excluding GST where applicable.

**Does applying guarantee a paid brief?** No. We review applications and contact creators when there is a suitable opportunity.

**Do I have to post on my own account?** Only if posting is explicitly included in a separate agreed scope. A content-production brief does not automatically require a public endorsement.

**Do I have to buy or use a product?** No purchase or personal product use is required. The brief specifies any props and what can be shown.

**Who owns the content?** You retain ownership unless a separate agreement says otherwise. Each brief sets out ECL’s agreed usage licence. Additional paid advertising or extended use is negotiated separately.

**Is this an affiliate program?** The initial program focuses on paid creative briefs. There is no sales commission offer in this launch.

**Can I apply from outside Australia?** The initial program is for Australia-based creators aged 18 or over.

End with a restrained repeated application link and the existing research disclaimer. Do not insert a competing newsletter signup into this journey.

## 7. Application specification

Use a single-page inline form with visible labels and two short field groups. Avoid a modal, multi-step wizard or required media-kit upload.

| Field | Rule |
|---|---|
| Full name | Required; trimmed; 2–80 characters |
| Email | Required; trimmed; case-normalised; maximum 254 characters; server validation |
| Primary social profile | Required HTTPS URL; Instagram, TikTok or YouTube, including their approved subdomains only |
| Portfolio URL | Optional HTTPS URL, maximum 500 characters; no server-side fetching |
| Main discipline | Required: photography, video, content creation |
| Australian state/territory | Required; ACT, NSW, NT, QLD, SA, TAS, VIC or WA |
| What would you like to create? | Required; 30–1000 characters; plain text |
| Audience size | Optional range: under 1k, 1–10k, 10–50k, 50k+; no eligibility decision based solely on this |
| Age/location confirmation | Required checkbox: “I am 18 or over and based in Australia.” |
| Application consent | Required, unchecked: “I agree that ECL may review my application and contact me about it, as described in the Creator Privacy Notice.” |
| Website field | Hidden honeypot; excluded from accessibility tree and keyboard sequence |

Link a dedicated `/creators/privacy` notice beside the consent field. Explain purpose, stored fields, access by ECL reviewers and service providers, contact route, deletion requests and retention. Proposed retention: delete unselected application data after 180 days; move accepted creators into a separately agreed contractor record. Verify the notice against the actual operator and services before launch. Collect neither bank details nor identity documents at this stage.

Maintain fields in component memory on recoverable errors; never put application text or email in URLs, analytics, localStorage or sessionStorage. A random idempotency key may be held in sessionStorage for uncertain-response retries, but it must contain no application data. Change the key if the validated payload changes. Server errors must not echo raw database messages or disclose another applicant’s record.

Use server validation, a database-backed submission throttle and honeypot. A capped body, exact Origin check against configured site origins and trusted-proxy handling belong in the endpoint. Throttle design and duplicate behaviour are specified in the implementation plan. Success means a durable record exists. There is no success-only mock action on a public route.

### Review workflow

Private `/admin/creators` list: newest first; status filters; 50-row pagination; no automatic external profile previews. Private detail: application, links, submitted date, status, assigned reviewer and internal notes.

States: `new → shortlisted → accepted` or `declined`; either `new` or `shortlisted` may be declined. Acceptance is an internal decision, not automatic contract creation, outreach, product dispatch or payment. Status changes and their audit record commit atomically using a revision check. Every read and action calls the existing admin gate.

Initial outreach is handled manually by the owner. Automated applicant email, agreements and creator accounts are separate enhancements, which keeps the first release smaller and avoids adding a partially integrated notification path to the existing outbox.

## 8. Creative production and asset slots

Two initial AI concepts have been generated and visually inspected using the actual `product images/GHK-CU 100mg.PNG` artwork as a product reference. Use them to assess lighting, composition and creator presentation. They are not product accuracy proofs, actual partners or cleared advertisements.

| Asset | Composition | Placement | Delivery |
|---|---|---|---|
| `hero-editorial.png` | Fictional female creator, black tailoring, warm plaster studio, vial and face visible, 3:2 master | Hero and optional careful editorial crop | Generated PNG master; create responsive WebP/AVIF derivatives during implementation |
| `portrait-studio.png` | Fictional male creator, off-white T-shirt, charcoal/cool studio, vial held at chest | Secondary 4:5 editorial panel | Generated portrait master |
| `prompts.json` | Exact generation prompts and reference provenance | Handoff and future regeneration | Text manifest |

Image QA: believable fingers; sealed vial; correct relative vial size; silver cap; blue ECL monogram; GHK-CU and 100mg legibility; no brand substitution; plausible powder fill; no source-art aura; no synthetic text outside the label. Fine print and exact commercial packaging still need verification against approved artwork. Do not trust AI to establish purity or product specifications.

During implementation, retain masters outside `public/`; generate delivery assets in `public/images/creators/`. Aim for hero derivatives of 960px and 1600px, portrait derivatives of 640px and 960px, with initial visible image bytes below roughly 300KB where visual quality permits. Actual encoded bytes and crops, not the extension alone, decide acceptance. Set dimensions and `sizes`; prioritise only the hero, lazy-load later images.

If generated photography cannot be published, use appropriately licensed non-product stock portraits temporarily. Keep product photography separate: do not composite a real stock model holding a regulated product unless their licence/model release permits the context and endorsement implications are resolved. Record photographer, source URL, licence and retrieval date. No stock assets have been selected or downloaded in this delivery because custom concepts are available.

## 9. Measurement and rollout

### Events

`creator_cta_click` with placement `hero | editorial | sticky | footer`; `creator_application_start` once on first meaningful input; `creator_application_submit` only after a confirmed successful save; `creator_application_error` with an enumerated non-personal error code. Do not send names, emails, profile URLs, free text, arbitrary referrer URLs or private application IDs to GA4. Exclude the privacy page and every admin route from creator conversion tracking.

Database application counts are the operational authority. GA4 is optional, lossy funnel context. Track application quality, shortlist rate, accepted briefs, cost per accepted creator, delivery acceptance, usable assets per brief and repeat collaboration. Later referral reporting needs paid/refunded revenue and contribution margin, not clicks alone.

### Pilot plan and indicative effort

| Stage | Deliverable | Planning estimate |
|---|---|---|
| Offer and creative decisions | Confirm scope, budget, rights, permitted public creative and page copy | 1–2 owner working days plus external review lead time |
| Page build | Responsive page, assets, navigation, FAQ and form layout | 2–3 developer days |
| Intake and review | Private storage, validation, throttling, idempotency and admin workflow | 2–3 developer days |
| Staging and release | Browser, permissions and submission checks; release runbook | 1–2 developer days |
| Pilot operations | Review applications, commission initial work, evaluate assets and costs | 30 calendar days after launch |

These are planning estimates, not a delivery commitment or measured productivity claim. A capped pilot of six first briefs would allocate A$1,800 in creative fees before GST where applicable, external review, props, shipping or production expenses. Set the cap before accepting work. Review after the first three delivered briefs before commissioning the remaining three.

### Release acceptance

- The permitted recruitment/advertising scope and each final image are resolved before publication.
- All reward copy matches actual funded terms; no fake partners, testimonials or availability claims.
- Desktop at 1440px and mobile at 320px/390px have no overflow, missing faces/vials, clipped headlines or covered inputs.
- Keyboard navigation, focus, labels, validation, reduced motion and measured text contrast pass.
- A successful submission creates exactly one private application; failure retains recoverable input.
- Public/anonymous clients cannot list or read applications; unapproved admin users cannot read or mutate them.
- A selected reviewer can find the application, change status and see a durable audit record.
- Newsletter/exit-intent overlays are absent from this journey; both store navigation variants can reach it.
- Analytics is non-personal and distinguishes attempted from confirmed submissions.
- Production assets are optimised; existing store and checkout regression checks pass.
- A named owner, review cadence, fee budget, content agreement and retention process exist.

## 10. Scope boundary for implementation

Build the page, private application intake and minimal review workflow first. Creator logins, public profiles, automatic payouts, affiliate tracking, generated contracts, messaging automation and a full campaign management system are separate releases. Their omission must be reflected in public copy: promise the funded first program, not an imagined platform.
