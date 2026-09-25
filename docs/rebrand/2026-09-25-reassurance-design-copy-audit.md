# East Coast Labs: reassurance, design and copy audit

Reviewed 25 September 2026 against production commit `9c4dbaa471a15da187eef8d340ddeded1b9a62ce`.

## Recommendation

Keep the welcoming images, restrained colours and readable typography. Rebuild the opening message around a clear fact: East Coast Labs is an Australian supplier of research peptides. Explain the practical reasons to buy from the business, place relevant evidence beside products, and make ordering easier to understand.

The previous copy cleanup overcorrected toward caution. The pages now spend too much time telling visitors to check, ask and investigate. That is accurate in places, but repetition makes the buying process sound difficult. Stronger reassurance requires both clearer writing and consistent, product-specific information.

My preferred starting point is `/1`: its sage palette and coastal imagery feel welcoming, and products appear earlier than on the other routes. Retain `/2` and `/3` as distinct alternatives, with a common product identity and comparable shopping paths. This is a design recommendation, not a measured conversion result.

This document records the audit and proposed copy direction at the production commit above. Following the owner's request to publish a preview, the landing-page copy, hierarchy, report links and practical ordering information have been implemented on `codex/rebrand-reassurance-preview`. The broader evidence reconciliation, shipping-settings reconciliation and downstream visual rollout remain follow-ups. The preceding image-restoration change is already live in production.

## Scope and method

- Reviewed all shared rebrand copy and CSS, including navigation, hero, product section, reports, contact, resources, FAQs and footer.
- Inspected the live `/1`, `/2` and `/3` pages at phone and desktop sizes; measured the phone layout at 390 × 844. Used the preceding release checks at 320, 390, 768 and 1440 pixels as additional responsive evidence.
- Followed the shared customer journey through the original homepage, GHK-Cu product page, lab-results library, About page, shipping, returns, checkout and the COA guide. GHK-Cu is a representative product review, not an inspection of every SKU or every article.
- Inspected checkout wording without entering details, changing products or submitting an order. Shipping observations below concern the published messages; they do not establish the charge for a completed order.
- Reviewed Verified Vials' public homepage, testing explanation, certificate library and founder page. Browser inspection included visible styling and computed typography. Its initial session showed an age gate, discount popup and chat panel; the age gate was not completed.
- Used Hormozi's value equation to assess clarity, credible evidence, waiting and customer effort. No conversion lift, scientific quality or detector score is claimed by this audit.

## What to learn from the reference

[Verified Vials](https://www.verifiedvials.com/) identifies the product category immediately and makes documentation easy to find from its main navigation. That is the useful model: visitors can quickly understand the business and where its supporting information lives.

Its [testing explanation](https://www.verifiedvials.com/pages/purity-testing) describes the tests it says it uses, while its [certificate library](https://www.verifiedvials.com/pages/certificates-testing) organises documents by product and document type. Its [founder page](https://www.verifiedvials.com/pages/about-the-founder-page) also gives a named person a visible role in the business. These are claims and presentation choices on that website, not independent validation of its operations.

Use this structure with East Coast Labs' own evidence. Do not borrow its testing scope, founder story, delivery promise or wording. Its layered arrival popups are also a distraction we should avoid reproducing. Computed typography used conventional Open Sans and Lato; nothing in the reference establishes that East Coast Labs needs another font change.

## Priority findings

| Priority | Finding and observed evidence | Recommended correction |
| --- | --- | --- |
| 1 | None of the three H1s includes “peptides.” `/2` uses “research supply” in its eyebrow and discusses reports in its introduction. `/3` also uses a broad supplier label. | Put “research peptides” in every H1 and say that East Coast Labs supplies them from Australia. Rename generic product links to “Research peptides” or “View research peptides.” |
| 1 | The live GHK-Cu page claims HPLC batch verification and an analytical purity specification, but also says no verified certificate is published for the selected 100 mg supply. Its displayed historical supplier report describes a 50 mg sample. | Reconcile the product description, selected size, label imagery and applicable documents. Publish a substantiated current-batch relationship where available. Do not treat the historical 50 mg report as verification of the selected 100 mg supply. |
| 1 | The live COA learning guide promises a published independent COA for every batch before listing. The rebrand and report library explicitly qualify their evidence as historical. | Create one verified record of coverage and align live guides, catalogue descriptions and reassurance copy to it. The observed inconsistency is not proof that testing never occurred; it is a gap in what the customer can verify. |
| 1 | Clicking through to a shared product page changes the light, welcoming brand to a dark layout with different display fonts and dramatic blue product imagery. About and lab-results pages also retain older headline styling. | Carry a consistent visual system through the experimental shopping journey before using it to judge a complete rebrand. Keep the original homepage intact as requested; use an isolated experimental route or presentation layer for downstream pages. |
| 1 | Mobile category identification and the primary action sit low on the page. On `/2`, the primary action starts below the 844px test viewport. | Put category, headline and the main shopping action before the large mobile image. Keep the image prominent directly below that opening block. This preserves warmth while answering what the business sells first. |
| 2 | The hero, trust strip, report instructions, About section, resources, FAQ and footer repeat variations of “check” and “ask us.” | Give each section one distinct purpose. Replace repeated reassurance with product information, relevant evidence, delivery/payment facts or useful order support. |
| 2 | `/3` makes email its primary action and adds a large contact panel before the catalogue. `/2` puts a lengthy report section before products. | Give all variants a prominent shopping path. Keep the proof-led route's short evidence summary above products, with the full report section below. Keep contact accessible without making it feel like a prerequisite to browse. |
| 2 | The same historical GHK-Cu report is featured regardless of which products a visitor is considering. No published-current-batch section rendered in the inspected variants. | Add product-specific report access and document status near selection. Distinguish a current applicable document, a historical supplier report and unavailable documentation. The absence of a rendered section alone does not explain the underlying operational cause. |
| 2 | “Australian contact details” says little about service. Useful information exists on the shared shipping, payment and returns pages. | Summarise shipping from Australia, payment-confirmation steps and the actual process for order problems. Link to details. Do not add response-time or dispatch guarantees without confirmed operations. |
| 2 | The shared header advertises free-shipping thresholds, while the live shipping page describes both services as included at no charge. | Reconcile the settings and wording used by the header, shipping page and checkout. Generate promotional shipping copy from the same current values used for quoting. Do not choose an attractive promise by guesswork. |
| 2 | The site invites a personal connection but does not provide a verified founder account or a named support contact in the reviewed copy. | Add a short account in the owner's own words, plus actual team or operational photography when available. Keep the welcoming editorial portraits now; do not present them as staff or customers. |
| 3 | The typography is now readable, but the repeated eyebrow → two-line headline → paragraph → arrow-link pattern still feels templated. Product names are relatively small compared with promotional headings. | Retain Commissioner. Vary section composition according to purpose, allow natural heading wrapping and give product names and prices stronger hierarchy. |

## Mobile findings

Measurements are document positions near the top of a freshly loaded page at 390 × 844, rounded to pixels. They describe visibility and scrolling effort, not user behaviour or conversion.

| Route | H1 begins | Primary action begins | Catalogue section begins | Interpretation |
| --- | ---: | ---: | ---: | --- |
| `/1` | 482px | 719px | 1,245px | Strongest balance of the three, but the large image precedes category and proposition. |
| `/2` | 601px | 867px | 3,019px | Product imagery establishes the category visually, but the main action and catalogue are delayed. |
| `/3` | 478px | 749px | 1,731px | The first main action is email; the extra contact panel further delays products. |

All three measured pages fit the 390px viewport without horizontal overflow. Main headings measured 35px and introductory text 17px. These are useful foundations to retain. The deployment's earlier checks also covered image loading, touch targets and responsive behaviour; the current issue is information order rather than a broken grid.

## Design and typography direction

Keep all three palettes. Sage is the strongest candidate for the main warm brand direction; navy communicates technical precision; plum provides a warmer conversational alternative. Do not treat a predominantly female audience as a reason to use smaller text, delicate contrast or stereotyped decorative styling.

Keep the coastal portraits and scenery. Pair them with recognisable product photography so visitors can understand the category at a glance. For a later brand shoot, prioritise actual packaged vials, packing an order, the person answering enquiries and a natural portrait of the owner. These are more distinctive than adding another decorative laboratory scene. The existing generated editorial assets can remain during this work; they are not evidence of customer outcomes or company staff.

Use Commissioner throughout the experimental journey. Suggested hierarchy: 40–56px desktop H1, 34–38px phone H1, 28–36px section headings, 18–20px product names, 17–18px main body text and at least 14px for important supporting information. Preserve adequate line spacing, visible keyboard focus and 44px interactive targets. Remove forced hero line breaks when they create awkward phrasing on smaller screens.

Reduce the amount of space dedicated to repeating an invitation to ask a question. Give product cards, document status and prices room to be understood. Use photographs for welcome, clear grouping for navigation, and actual documents for proof.

The dark, glowing product photography on the shared GHK-Cu page does not match the light coastal direction. Standardise lighting, background, scale and label accuracy across catalogue images in the experimental journey. Keep products identifiable; decorative styling must not alter a specification on a vial.

## Proposed copy

These are original drafts based on currently visible information. They require normal editorial review against the business records before stronger operational claims are added.

### Recommended `/1`: clear and welcoming

**Headline:** An Australian supplier of research peptides.

**Introduction:** Browse our peptide range, compare vial sizes and prices, and read the supplier lab reports we publish. If you have a question about a product or an order, you’re welcome to get in touch.

**Primary action:** View research peptides

**Secondary action:** Read lab reports

**Supporting line:** Australian owned. Shipping from Australia.

Keep the research-use notice visible beside this content. Explain the historical status and batch applicability beside the reports themselves.

### `/2`: documentation emphasis

**Headline:** See the reports behind our research peptides.

**Introduction:** We’re an Australian peptide supplier. Our report library includes the original supplier documents, test dates and links to verify them with the laboratory. Each report identifies the sample tested; its date and details are shown alongside it.

**Primary action:** View research peptides

**Secondary action:** Browse lab reports

Use a compact, legible report preview near this introduction. Put a clearly labelled historical report below the product preview, with its full explanation.

### `/3`: approachable service

**Headline:** We supply research peptides across Australia.

**Introduction:** You can browse the range, compare sizes and read the available reports here. If you’re unsure about a product detail, send us a question. You’re welcome to contact us before placing an order.

**Primary action:** View research peptides

**Secondary action:** Ask a product question

Keep the portrait and a concise contact panel further down the page. Use the configured email address and hours. Do not promise that a named person answers unless that is confirmed.

### Shared section rewrites

| Current copy | Proposed copy or treatment |
| --- | --- |
| Products / View products | Research peptides / View research peptides |
| Find the product you came for | Browse research peptides |
| Here’s what you can check | Product reports and test details |
| A few things worth checking | Remove the repeated resource block; combine its useful explanation with the reports and FAQ. |
| It’s worth asking before you buy | Have a question about a product? |
| Australian contact details | Shipping from Australia, with a link to current delivery information. |
| Still have a question? | Contact East Coast Labs, followed by the email address and actual support hours. |
| Grounded in curiosity. Guided by clarity. | About East Coast Labs, followed by a specific, verified account of the business. |
| The details behind the compound. | Peptide lab reports, followed by a plain explanation of the available documents. |

For GHK-Cu, a clearer introductory structure would be: “GHK-Cu, supplied as a freeze-dried powder. Choose from the available vial sizes below. Product specifications and supplier reports are listed on this page.” Populate size and specification details from the selected catalogue record, and retain accurate documentation status next to the buying controls.

The voice should sound like someone helping a customer choose: ordinary words, concrete details, contractions where natural and answers near the relevant decision. Avoid repeated miniature slogans, exaggerated adjectives, defensive language and claims to be “human” or “authentic.” Demonstrate those qualities with information and behaviour. Automated AI-detector scores are not a reliable acceptance target or a result this work promises.

## Applying Hormozi's principles

[Hormozi's value-equation material](https://www.acquisition.com/training/offers4) provides a useful framework for the offer. The application below is an editorial recommendation for this site, not a quotation or endorsement.

| Principle | Application to East Coast Labs |
| --- | --- |
| Make the desired outcome clear | A buyer understands what they are ordering, the cost, the available evidence and what happens next. Keep this promise within the site's research-supply purpose. |
| Increase confidence that the offer will be delivered | Show the relevant product, selected size, applicable report, original laboratory link and verifiable business details together. |
| Reduce delay | Make reports available without an email request wherever they exist. Explain payment confirmation and dispatch stages before checkout. Use actual timings only when supported. |
| Reduce customer effort | Clear peptide navigation, a short route to products, readable documents, consistent design and fewer repeated instructions. Prefill a product name in an enquiry link where contact is necessary. |
| Address the downside of purchasing | Explain the existing process for damaged, incorrect or missing orders and link to the policy. Do not invent a money-back, purity or delivery guarantee. |

For this audience, respectful reassurance matters more than pressure. Warm language and mature, relatable imagery can welcome visitors without implying that research-use-only products are suitable for postpartum, weight-loss or menopause treatment. The current `/3` paragraph naming those health stages should become a general product-support invitation; its health framing conflicts with the stated product purpose.

## Proposed page order

1. Clear peptide-provider headline, short introduction and shopping action.
2. Welcoming portrait or recognisable product image, beside the copy on desktop and directly after the opening block on mobile.
3. A short row of substantiated facts with useful links.
4. Peptide range with size, price and availability; product-specific evidence access where supported.
5. How to read the available reports, with an original example and accurate scope.
6. The business and its people: verified details, contact and imagery.
7. Practical questions covering documentation, payment, dispatch and order problems.
8. Contact and policy footer.

The navy route can place a brief proof summary before products. Avoid moving the entire long report explanation ahead of shopping. The plum route can give service more emphasis without inserting a second large hero-sized contact section.

## Implementation sequence and acceptance criteria

**First:** reconcile product, guide and shipping claims; establish which documents apply to current products. Record the operational source for each claim. A new headline cannot resolve inconsistent evidence.

**Second:** update category wording, actions, mobile order and repeated sections across the three variants. Retain the welcoming imagery and existing font. Check that a new visitor can answer what is sold, where it ships from and how to see the products within the first screen.

**Third:** extend the chosen experimental presentation through product pages, documentation and checkout while preserving the original homepage. Product descriptions must come from their actual active catalogue source; editing only a fallback Markdown deck will not necessarily change what customers see.

**Fourth:** add the owner's verified story, real operational photographs and an agreed testing explanation. Needed facts include who handles enquiries, the actual batch-testing workflow, current inventory-to-report mapping and realistic service timings. No placeholder biography, certification or testimonial should be published.

**Measure:** compare settled purchases and product-selection behaviour across comparable traffic, with report opens and contact clicks as supporting signals. Use one consistent primary shopping action if the aim is to compare messaging and palette. Different page bundles can be tested, but a result cannot isolate the effect of colour or wording alone. The existing rebrand experiment remains inactive until its traffic and measurement settings are deliberately enabled.

Accept a revision when every hero names the product category, the shopping action is visible early on phone layouts, each major section adds new information, document scope is consistent across the journey, and the experimental visual system persists through the purchase path. Read the final copy aloud to someone outside the project and ask them what the business supplies, what evidence they can inspect and what happens after ordering.

## Source files for follow-up

- Rebrand copy: `storefront/components/rebrand/content.ts`
- Shared rebrand sections: `storefront/components/rebrand/RebrandExperience.tsx`
- Type, colours and responsive layout: `storefront/components/rebrand/rebrand.css`
- Featured report selection: `storefront/components/rebrand/RebrandPage.tsx`
- Verified document filtering: `storefront/lib/coa.ts`
- Product catalogue copy precedence: `storefront/app/(store)/product/[slug]/page.tsx`
- Shared report links: `storefront/components/SupplierReportLinks.tsx`
- Conflicting guide claims: `storefront/content/guides/understanding-a-certificate-of-analysis.md`, `how-peptide-purity-is-tested.md`, and linked compound guides
- Shipping information and announcement: `storefront/app/(store)/shipping/page.tsx`, `storefront/components/AnnouncementBar.tsx`
- Shared presentation: `storefront/app/(store)/about/page.tsx`, `lab-results/page.tsx`, `storefront/components/CheckoutForm.tsx`

Independent read-only review confirmed the main findings: category clarity, proof relevance, repeated contact requests, weak service specifics and contradictory downstream claims.
