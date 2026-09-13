# East Coast Labs Conversion and Profit Plan

East Coast Labs should optimize for **contribution profit per visitor and profitable repeat purchasing**. The immediate opportunity is to make the offer easier to understand, establish verifiable trust, reduce the effort required to pay, and correct the numbers used to judge success. A new visual theme or a Shopify migration should follow evidence that it solves a material problem.

The recommended sequence is: correct product and profit information; establish the business and product evidence; verify paid-order measurement; simplify mobile purchasing; then test pricing, retention, and acquisition. The existing storefront already contains useful pack pricing, inventory-aware purchase controls, guest checkout, recovery, and lifecycle infrastructure. Extend those capabilities selectively.

This assessment covers the public Australian storefront on 13 September 2026 and the local repository at commit `061e76a`. Desktop and 390 x 844 mobile views, two product journeys, the catalogue, cart, checkout, certificate library, About page, and creator offer were inspected. Checkout was reviewed up to the unsubmitted form. No order, payment, subscription, or customer message was created. Financial records, analytics accounts, actual delivery performance, and paid cohort data were not available for validation.

## 1. Commercial priorities

| Priority | Decision | Commercial purpose |
| --- | --- | --- |
| Immediate | Correct size, price, description, and profit-report inconsistencies | Prevent mistaken purchases and decisions based on inflated margin |
| Immediate | Resolve certificate availability and substantiate product claims | Make the site's central trust proposition useful |
| Immediate | Establish a reconciled paid-order and cost baseline | Distinguish sales intent from cash-generating conversions |
| Next | Bring mobile selection and purchase controls together | Reduce effort and price surprise |
| Next | Clarify payment, delivery, returns, and company identity | Answer the questions that prevent a first purchase |
| Then | Test offers and existing lifecycle flows | Increase contribution and second purchases without excessive discounting |
| Conditional | Expand channels, creator activity, or payment providers | Grow only where the catalogue, channel, and economics support it |

Baymard's current statistics page reports that extra costs, slow delivery, trust, account creation, and checkout complexity are common abandonment reasons. Its survey reports 40%, 20%, 19%, 18%, and 17% respectively. These are reported reasons among US shoppers, with overlapping responses; they are not East Coast Labs' funnel losses or a recoverable-revenue forecast.[^1]

Shopify's widely cited 15% average checkout advantage and up-to-50% Shop Pay lift come from commissioned research, with the headline platform comparison based on an April 2023 study. They support investigating checkout friction; they do not predict the return from migrating this business.[^2]

<!-- PAGEBREAK -->

## 2. Verified storefront findings

**L = observed live; C = confirmed in current code; H = hypothesis requiring measurement.** Priority reflects likely commercial importance and certainty, not a calculated revenue impact. E references identify the reproducible evidence in the appendix.

| ID | Finding and evidence | Recommended action |
| --- | --- | --- |
| F01 | **L/C, high:** GHK-Cu is $79.99 in `/shop`; the homepage exposes a $59.99 starting price and the PDP offers the cheaper size. Shop card mapping omits `sizes`. [E1] | Carry the same size-aware prices and availability into every listing, collection, search result, and recommendation. |
| F02 | **L/C, high:** GHK-Cu size buttons say `100` and `50` without units. Selecting `50` changes prices but leaves the product details stating 100 mg. [E2] | Explicitly label 50 mg / 100 mg and synchronize specifications, relevant imagery, SKU, stock, and certificate context with selection. |
| F03 | **L/C, high:** BPC-157 displays a $59.99 single-vial price but preselects a $161 three-pack. Its mobile primary CTA starts at about y=1,179 px. [E3] | Compact the buying area; test single-vial versus three-pack default. Show the selected pack total beside the selection. |
| F04 | **L, high:** Homepage and PDPs direct buyers to certificates; the live library has no verified documents. PDP text still asserts HPLC testing and analytical purity. [E4] | Obtain and verify authentic documents; reconcile claims across copy, labels, images, and bundles. Absence online does not establish absence of testing. |
| F05 | **L/C, medium:** BPC-157 product details are flattened into a long paragraph, with literal `&#8211;` and lost document links. [E5] | Render safe structured content with headings, specifications, paragraphs, and working references. |
| F06 | **L, high:** About contains brief shipping/returns information, but the inspected footer lacks dedicated shipping, returns, general privacy, terms, and contact links; company identity is sparse. [E6] | Publish factual policy and identity information and link it at purchase decisions. This is an expansion of existing information. |
| F07 | **L/C, medium:** Checkout inserts a lengthy cart-recovery consent module between email and name. [E7] | Move recovery into an optional disclosure with clear consent retained; prioritize completion of the purchase form. |
| F08 | **L/C, medium:** The PDP offers paid water, while the sampled three-pack cart receives free water. The cart also promotes a kit containing water. [E8] | Explain included items before adding; suppress redundant suggestions while allowing deliberate extra quantities. |

These are individual observations, not an exhaustive defect count. Test changes against the active catalogue and current admin settings; static seed files and historical WooCommerce modules are not production truth.

<!-- PAGEBREAK -->

## 3. Measurement, economics, and operating findings

| ID | Finding and evidence | Recommended action |
| --- | --- | --- |
| F09 | **C, high:** `profitForOrders` and product performance use line totals without subtracting allocated order discounts. Missing costs leave revenue in the calculation. [E9] | Reconcile discount allocation, refunds, cost recognition, and tax treatment before using profit figures for offers or acquisition. |
| F10 | **C, high:** Browser product events use numeric product IDs; paid events use SKU/slug identifiers. The inspected checkout/paid-event path does not persist experiment assignment or campaign dimensions. [E10] | Establish canonical analytics product/variant identifiers and a first-party attribution record joined to paid orders. |
| F11 | **C + historical release evidence, high:** `BASELINE.md` remains placeholders; the release record says optional GA4 delivery was disabled. Current provider ingestion is unverified. [E10] | Verify current configuration and ingestion rather than assuming zero analytics or assuming the integration is complete. |
| F12 | **L/C, medium:** The sampled live checkout offered Bank Transfer only. Code also supports PayID, but availability is configuration-dependent. [E7] | Improve the active transfer journey now; assess approved payment alternatives separately. |
| F13 | **C, medium:** Lifecycle sequences already exist. Replenishment uses fixed 21/70/154-day delays by largest pack. [E11] | Verify delivery, then replace unvalidated timing with observed reorder intervals or buyer-selected reminders. |
| F14 | **L/C, medium:** “Most popular” pack badges follow pack position, not a paid-sales calculation. An out-of-stock item appears in the featured homepage set. [E3/E12] | Substantiate popularity labels; blend demand, stock, and contribution in merchandising. |
| F15 | **L, investigate:** The in-app checkout remained in its quote-loading state during observation. A separate Chrome checkout resolved a valid total and payment option. [E7] | Measure quote latency and error rate by browser. Add bounded recovery if a hang is reproduced. Do not describe this as a proven sitewide outage. |

Several historical findings have already changed. Sample review data is retired from the active review layer; recurring purchase promises have been removed; shop search, sorting, and stock filtering exist; paid-event outbox and email workers exist. Treat their remaining gaps as configuration, attribution, content, and operational verification work. Rebuilding those features would waste effort.

The visual foundation is usable: strong contrast between the teal purchase action and dark background, recognizable branding, explicit pack totals, and visible stock status. The highest-value design work is hierarchy, readability, and consistency. There is no measured evidence that changing the entire site from dark to light would itself increase profit.

<!-- PAGEBREAK -->

## 4. Profit model and decision rules

Use a consistent reporting basis. Public prices should remain clear to shoppers; internal revenue and recoverable input costs should be compared on a consistent tax basis. Confirm the applicable GST treatment with the business's accountant. “Revenue minus product cost” is a gross-profit view, not contribution after fulfilment and acquisition.

**Net merchandise revenue** = paid merchandise sales - discounts - merchandise refunds, excluding applicable collected tax. **Order contribution before acquisition** = net merchandise revenue + net shipping revenue - landed product costs - consumed gift costs - carrier charges - packaging and pick/pack - payment fees - unrecovered replacement/refund costs - variable service costs.

**Contribution after acquisition** subtracts acquisition expense once. If creator commissions are included in acquisition cost, do not subtract them again as fulfilment costs. Inventory returned in sellable condition can recover value; a refund alone does not restore the economic value of damaged or retained goods. Missing cost data should be shown as unknown and excluded from confident margin claims.

| Decision metric | Definition and use |
| --- | --- |
| Paid conversion | Paid orders attributed to an eligible session cohort / eligible sessions; allow the transfer-payment lag to mature |
| Contribution per session | Contribution from those orders / eligible sessions; use alongside conversion |
| Created-to-paid rate | Orders paid within a declared window / orders created in that cohort |
| 90/180/365-day contribution LTV | Cumulative contribution before acquisition / all customers acquired in a mature cohort, including one-time buyers |
| CAC and payback | Channel acquisition cost / new paid customers; days until cohort contribution covers CAC |
| Second-purchase rate | First-time paid buyers placing a second paid order by day 60/90 / all first-time buyers old enough to reach that window |

**Illustration only, not an ECL forecast.** At 10,000 sessions, 1.5% paid conversion, $150 net AOV, and $55 contribution per order, there are 150 orders, $22,500 revenue, and $8,250 contribution before acquisition. At the same traffic, 2.0% conversion, $160 AOV, and $58 contribution produce 200 orders, $32,000 revenue, and $11,600 contribution. The contribution difference is $3,350 before any extra implementation or acquisition costs.

Discounts can reverse the result. With $150 revenue and $95 variable cost, contribution is $55. A 10% discount reduces it to $40 if costs stay constant. Orders must rise **37.5%** merely to preserve contribution. Higher conversion alone would not justify that offer.

Use realized contribution LTV to set an allowable CAC with a cash reserve and payback horizon. Do not finance present acquisition from an assumed indefinite subscription lifetime. Recurring purchasing is not currently offered.

<!-- PAGEBREAK -->

## 5. Product page and mobile design

Make the product page answer five questions in one coherent buying area: what is supplied, which size and pack is selected, what it costs in total, what evidence exists, and how payment and delivery work. Baymard's product-page research supports visible variant choices, unit pricing, and total-cost information near the purchase controls.[^3]

**Recommended mobile order:** compact product identity and actual product image; size and specification; evidence status; pack choices with total and per-vial price; primary CTA; payment and delivery summary; then detailed evidence, specifications, returns, reviews, and related items. Keep the legal use restriction legible without duplicating it between every piece of purchase information.

For the sampled BPC-157 page, shorten the intro, remove the large gap between introductory information and pack options, reduce the gallery's vertical footprint, and place optional accessories after the primary purchase decision. Existing sticky purchase functionality only appears after the main control has scrolled past; it does not solve the initial distance to purchase. Test an early “Choose pack” anchor before a valid selection, then a sticky selected-total CTA. Never silently add an unchosen variant.

Use this information hierarchy for the buy box:

| Element | Required content |
| --- | --- |
| Product identity | Correct compound, explicitly stated mass per vial, format, selected SKU |
| Size selector | Full unit labels; visible unavailable state; selected-size deep link |
| Pack selector | Vial count, total charged, price per vial, exact comparison basis |
| Evidence | Authentic certificate link and batch scope, or explicit unavailable status |
| Main action | Add selected pack to cart, with selected total |
| Delivery/payment | Available method, dispatch trigger, shipping charge and transit estimate |

Keep the three-pack as a testable value option. Compare it with a single-vial default among new visitors. Returning buyers can use a saved previous selection or explicit reorder action. Judge the result by paid contribution per eligible visitor, with wrong-size contacts, cancellations, and refunds as guardrails.

Replace paragraph-dense descriptions with a scannable specification table and concise explanatory sections. Decode entities safely and retain source links through a vetted renderer. Fixing this does not require expanding scientific claims. Match product images to the selected supply: a generic or rendered vial is not evidence of the actual batch or its purity.

Use readable text sizes, visible keyboard focus, generous touch targets, meaningful form labels, and layouts that survive 320-pixel width and 200% zoom. A lighter specification panel is a reasonable readability experiment; a complete color-system redesign is lower priority.

<!-- PAGEBREAK -->

## 6. Homepage, catalogue, and navigation

The homepage currently repeats the batch-documentation theme across several sections despite the library's empty state. Consolidate that space into a short explanation with a functioning next step. Once evidence is available, surface a small set of specific, verified records rather than repeated generic trust statements. Preserve the site's recognizable visual identity while reducing scroll and duplicate copy.

**Recommended homepage sequence:** concise factual proposition; searchable in-stock catalogue preview; evidence and fulfilment explanation; relevant pack offers; authentic service/product evidence; practical FAQs; restock signup. Prioritize the pathway a buyer needs today. Put creator recruitment and the long sourcing pipeline lower in the commercial navigation hierarchy unless traffic data shows a different need.

The current mobile shop consumes much of the first viewport with introduction, category chips, search, and sorting before product details become visible. Compact the introduction, put search closer to the heading, and collapse category controls into a clearly labeled filter on small screens. Maintain active-filter indicators and a one-tap reset. Existing search/sort controls should be improved, not rebuilt as missing features.

Merchandise with eligibility and contribution constraints. Start with products that can be fulfilled and whose claims can be supported. Within that pool, rank using paid demand and contribution, with a small exploration allowance for new items. The current sales-popularity ordering is useful, but it should not make an unavailable product a primary conversion destination.

Fix catalogue consistency before visual experiments:

- The same product should show the same starting-price basis across homepage, shop, collections, cross-sells, and search.
- Variant products should expose their available sizes and a starting price tied to a purchasable option, with any sold-out minimum explained.
- Search should recognize product names, established aliases, and SKUs; log zero-result queries without collecting personal query content.
- Product cards should show mass/format, current stock, unambiguous price, and actual ratings only when available.
- Change “every compound” pack-availability promises when a product or size has fewer current options.

Baymard's listing research finds that omitting variation information can cause shoppers to reject a product that actually meets their needs. ECL's GHK-Cu inconsistency is a concrete example of why variant visibility matters.[^4]

For a small catalogue, a full comparison engine or recommendation model is unnecessary initially. A consistent two-column mobile grid with readable product facts and effective search is the first target. Later, test a compact list view for repeat procurement, where exact identification and speed may matter more than large imagery.

For organic discovery, audit Search Console coverage, sitemap entries, canonical URLs, legacy redirects, and links to merged size pages. Preserve useful product URLs during restructuring. Validate size-specific links, price/availability markup, and genuine review data against the rendered page. Google's product-variant guidance supports explicit product grouping and distinguishable variant URLs; assess that model for merged sizes rather than assuming the current aggregate offer is sufficient.[^18] Keep private payment/recovery pages out of search results. Publish original, eligible documentation and procurement information that answers real search/support questions, with named sources and review dates. Avoid mass-producing near-duplicate compound pages or implying therapeutic outcomes to attract unsuitable traffic.

<!-- PAGEBREAK -->

## 7. Cart, checkout, and payment completion

Simplify the cart around selected items, included gifts, confirmed charges, and the next action. The current drawer devotes space to multiple accessories and a zero-dollar free-shipping progress state. When standard shipping is universally free, a concise “Standard shipping included” message is clearer than a progress bar that cannot progress. Keep a milestone only when a meaningful, current threshold exists.

Show that a qualifying order includes water before presenting a paid-water checkbox. When a kit or stack already includes an item, suppress redundant suggestions or explain why an additional quantity would be useful. Avoid automatic escalation into more cross-sells at checkout. Test one relevant, contribution-positive accessory against the existing multiple suggestions.

Also check empty-cart eligibility: after the paid item was removed, gift water remained with a $0 subtotal and a checkout button. The client condition compares subtotal with the gift threshold without requiring a paid line. Confirm the intended zero-threshold behavior and server-side validation; no gift-only order was submitted.

On mobile checkout, show a compact order summary and total near the top with an expandable item list. Preserve guest checkout, autocomplete, optional phone/unit fields, explicit inline errors, server-side repricing, and protection against duplicate submissions. Collapse optional discount entry into a labeled disclosure; keep a straightforward route for buyers with a valid code.

Move the “email my cart” module below the core contact details or into an optional disclosure. Retain accurate consent and confirmation information. A visitor ready to buy should not need to read a long recovery workflow before entering their name. Do not silently enroll checkout email addresses into marketing.[^5]

For the active bank-transfer path, make the sequence explicit before submission: **place order; receive transfer instructions; send payment; receive payment confirmation; dispatch.** On the existing private payment page, prioritize amount, recipient, reference, copy controls, payment status, and support. Distinguish a buyer saying they transferred funds from verified receipt of funds. Display hold expiry and late-payment handling using actual settings.

Measure quote requested-to-ready time, failed quotes, abandoned payment pages, and created-to-paid conversion. The two-browser observation did not establish a permanent outage. If hanging requests recur, introduce a bounded timeout, retry, and clear assistance route while preserving idempotency. Investigate endpoint/database timing before prescribing a cache or infrastructure change.

An approved embedded or accelerated payment option may remove a substantial step, but merchant acceptance must precede implementation. Shopify's Princess Polly case reports a 4.1% conversion increase for buyers with an existing Shop Pay session and a 1% increase in Australian store orders. That narrower result is more informative than applying a headline uplift to every visitor.[^6]

For any new provider, evaluate approval for the precise catalogue, total fees, reserves, settlement delay, dispute costs, refund support, wallet availability, and developer effort. Keep the existing method as a tested fallback only where permitted. Do not assume PayID, cards, Shop Pay, or BNPL are automatically available.

<!-- PAGEBREAK -->

## 8. Trust, evidence, and category constraints

The highest-value trust asset is an authentic, relevant certificate connected to the product being supplied. Implement a clear chain from compound and size to batch, source document, verification date, and applicable inventory. Show document limitations. If allocation to the shipped lot is not implemented, do not imply that a generic certificate proves the customer's exact parcel. The September release record explicitly identified this boundary.[E4/E13]

The unavailable certificate state is honest, but it clashes with unqualified testing language elsewhere. Inventory the current claims across product descriptions, labels, images, stacks, email templates, and creator material. Substantiate them or narrow them. “Most popular,” purity, and dispatch promises should each have a documented basis; the ACCC says advertised claims must be supportable.[^7]

Publish the real trading entity, ABN where applicable, contact arrangements, response hours, and relevant business address/service details. Add clear shipping, returns, privacy, terms, and contact pages. The About page currently asks buyers to report problems within seven days; explain that an operational reporting request does not remove applicable consumer guarantees. Define remedies for damage, incorrect items, lost parcels, and the purity guarantee without inventing eligibility restrictions.[^8]

Use genuine buyer feedback about documented product quality, fulfilment, packaging, and service. Publish a neutral review policy, request reviews consistently, and disclose incentives. Do not create ratings where none exist, filter requests by expected sentiment, or turn customer claims into unsupported therapeutic marketing. The current active review layer already excludes the old sample dataset.

**Category-specific growth dependency:** the TGA's 13 April 2026 advisory addresses unapproved peptide supply and promotion, including influencer activity, and states that research-use disclaimers do not by themselves make supply lawful. Obtain an Australian assessment of the actual SKUs, customer eligibility, intended supply model, and content before expanding consumer promotion. This audit does not determine the legal status of individual products.[^9]

The current creator page targets fitness, everyday health, and biohacking audiences. That creates a specific audience/positioning question for a research supplier. Resolve it before expanding gifting or referral commissions. A lab procurement pathway may be appropriate if the lawful supply model supports it; a business-email field or disclaimer alone is not proof of eligibility.

This is a commercial dependency: acquisition that cannot be sustained by the payment provider, channel, or applicable rules is not a profitable growth channel. It should influence positioning, spend, and partnership selection at the start.

<!-- PAGEBREAK -->

## 9. Measurement architecture and performance

Build a reconciled first-party order view and a behavioral funnel. The order ledger is authoritative for payments and refunds. Analytics explains visits and interactions; its coverage will differ because of consent, blocking, and payment delay. Show that coverage instead of forcing analytics revenue to equal every paid order.[E10]

| Stage | Required measurement | Diagnostic use |
| --- | --- | --- |
| Arrival/discovery | Eligible session, landing page, channel, experiment exposure, listing selection | Separate poor traffic fit from poor page conversion |
| Product | Product/size/pack view and selection; evidence interaction | Identify difficult choices or trust questions |
| Cart/checkout | Add/remove, begin checkout, quote duration/error, method selection | Locate interaction and cost friction |
| Order/payment | Order created, instructions viewed, payment confirmed, expiry/cancellation | Quantify the transfer-payment gap |
| Retention | Shipment/delivery status, refunds, second paid order, attributable flow exposure | Measure experience and cohort contribution |

Use canonical product and variant identifiers throughout. Currently, numeric browser IDs and paid SKU/slug IDs do not form a consistent item funnel. Persist a consent-appropriate acquisition/experiment record with the order; the inspected paid snapshot carries a GA client ID but not the assignment or campaign fields needed for a robust first-party experiment analysis. Do not restore raw referrers, sensitive URLs, or personal data to analytics.[E10]

Google's ecommerce events and Measurement Protocol provide the event structure, but a successful HTTP delivery does not prove correct reporting or attribution. Validate actual purchase/refund ingestion, deduplication, item totals, currency, and applicable session-association behavior. Keep true payment timestamps and reconcile delayed bank transfers against their originating acquisition cohort.[^10][^11]

Add a weekly dashboard: paid conversion by device and new/returning status; quote success and latency; created-to-paid rate; net AOV; contribution per order/session; discounts and shipping subsidy; stockout demand; 60/90-day second purchase; CAC and cohort payback. Separate unpaid orders from revenue. Use paid-date reporting for cash conversion and acquisition cohorts for growth analysis.

Measure mobile and desktop field performance at the 75th percentile: LCP at most 2.5 seconds, INP at most 200 ms, CLS at most 0.1. These are Google's current “good” thresholds, not measured ECL scores.[^12] Inspect responsive image delivery, script weight, third-party tags, and quote endpoint timing. The earlier PageSpeed file is a quota error, not a performance baseline.

A Vodafone A/B test reported 8% more sales with a 31% LCP improvement. It is evidence that speed can matter, not a forecast for ECL.[^13] Prioritize fixes supported by field problems. Adding popups, tracking tags, or heavy apps should carry an explicit performance budget.

<!-- PAGEBREAK -->

## 10. Retention and lifetime value

The current code already supports welcome, cart recovery, payment reminders, arrival check-ins, reviews, replenishment, second-purchase nudges, and winback. First verify each flow's eligibility, delivery, suppression, and paid-order attribution. Existing templates and scheduled functions do not establish that customers receive them or that they create incremental sales.[E11]

| Flow | Recommended treatment | Success measure |
| --- | --- | --- |
| Unpaid order | Clear payment help and finite reminders consistent with the hold; stop on payment, expiry, or resolution | Additional paid orders, fewer payment contacts |
| Consented cart recovery | Start with service/evidence reassurance; test an incentive only if incremental margin supports it | Incremental contribution per eligible cart |
| Welcome | Explain supply, evidence, payment, and support; personalize only with consented interests | First paid purchase, complaints, unsubscribe |
| Delivery/support | Accurate tracking and problem resolution; trigger from delivery when possible, otherwise label an estimate | Delivery issue rate, time to resolution |
| Review | Neutral request after receipt with simple verified-order access | Authentic review coverage and useful feedback |
| Second purchase | Convenient exact-product reorder; recognize prior purchases and current availability | Mature 60/90-day second-purchase rate |
| Restock/new batch | Send only for relevant consented product interest and real availability/documentation | Paid contribution, low complaint rate |
| Reorder / winback | Buyer-selected timing or measured reorder intervals; suppress after repeat purchase or unresolved problems | Incremental 90/180-day contribution |

Replace the fixed 21/70/154-day replenishment assumptions when data supports better timing. Pack size is not proof of consumption rate, and research orders should not receive implied human dosing schedules. A six-pack can move revenue forward while delaying the next order; track cumulative cohort contribution so that this is not mistaken for lost retention.

Klaviyo's 2026 benchmark page reports that flows account for approximately 41% of attributed email revenue from 5.3% of sends. This observational vendor benchmark favors relevant triggers, but it does not establish that those sales would disappear without email. Do not set a target that email must represent a particular share of store revenue.[^14]

Use holdouts for optional marketing flows where volumes permit, and compare paid contribution over the same mature window. Maintain transactional communications for everyone who needs them. Evaluate deliverability, sender authentication, complaints, bounces, and overlap between flows before increasing frequency. Respect consent and unsubscribe across every sending system.[^5]

Delay a points program or subscription platform until repeat behavior and the supply/payment model justify the complexity. Start with dependable fulfilment, useful documentation, simple reorder, and responsive support. If VIP benefits are tested, favor operational value over an automatic permanent discount, and cost every benefit.

<!-- PAGEBREAK -->

## 11. Offers, merchandising, and acquisition

Cost every single, pack, stack, gift, and coupon combination using current paid prices and landed costs. Include gift consumption, shipping, packaging, payment fees, replacements, and acquisition. Choose minimum contribution floors in dollars and percentage. Cap incompatible promotions server-side and explain the rules near the offer.

Test free-shipping and gift policies against contribution across all exposed visitors. For example, at a 60% incremental merchandise margin, a $12 extra subsidy requires $20 additional merchandise revenue just to cover that subsidy on an affected order. It does not cover subsidizing buyers who would have ordered anyway. Use the actual basket distribution and carrier zones; there is no universally optimal threshold.

Bundles should solve a legitimate purchasing need and clearly disclose every component, size, quantity, evidence status, and saving basis. Compare incremental contribution with cannibalized full-price sales. Keep unavailable components from being promoted as purchasable. An accessory's low purchase cost does not make it “near 100% margin” after fulfilment and service.

Treat stock availability as part of conversion. Track lost demand by SKU, waitlist conversion after restock, supplier lead times, batch verification lead time, and replacement rates. Set replenishment decisions against demand during lead time plus a chosen safety-stock buffer. Expiry, storage requirements, tied-up cash, and uncertain demand limit the value of buying in bulk.

| Channel | Initial approach | Condition for scaling |
| --- | --- | --- |
| Existing/direct traffic | Fix the journey and measure paid cohorts | Positive contribution and reliable fulfilment |
| Consented email | Verify existing relevant flows and reorder convenience | Incremental cohort contribution with healthy deliverability |
| Organic search | Accurate product facts, useful eligible research/procurement information, consistent indexing | Lawful content, qualified visits, paid outcomes |
| Creator/referral | Review current audience fit and brief; use a small approved pilot | Eligible promotion and acceptable incremental CAC |
| Paid search/social | Assess exact product and destination eligibility first | Written/verified eligibility and channel-level contribution |

Google Ads restricts prescription-drug terms and promotion of unapproved substances; search ads cannot be assumed available for this catalogue.[^15] Shopify Payments has product/business restrictions, and Stripe distinguishes prohibited from restricted categories requiring further review. Neither a Shopify migration nor an automatically opened processor account proves acceptance.[^16][^17]

For the current creator offer, record landed cost of both product rewards, shipping, staff review, usage rights, and later commission. Divide by incremental new paid customers, not views or code uses alone. Code leakage and customers who would have purchased anyway inflate attributed performance. The first product's advertised retail value of up to A$300 is not the business's CAC.[E14]

Keep the present platform while these fundamentals are resolved. Compare staying, adding an approved checkout provider, and migrating using 12-month total cost, achievable payment options, operating effort, and migration risk. Replatform only when a material advantage is established.

<!-- PAGEBREAK -->

## 12. Experiment programme and 90-day delivery plan

Correct misleading facts, broken formatting, and accounting inconsistencies without A/B testing their accuracy. Test choices where both experiences are valid. Use persistent randomized assignment among eligible visitors; merely sending different campaigns to `/` and `/1` does not establish a causal test. Store assignment through payment and analyze the original assigned groups.

| Order | Hypothesis | Primary outcome | Guardrails |
| --- | --- | --- | --- |
| 1 | Compact mobile buying area improves completion | Paid contribution per eligible visitor | Wrong-size contacts, errors, paid CVR |
| 2 | Single-vial default helps first-time buyers | Paid contribution per new visitor | Pack mix, AOV, refunds, repeat cohort value |
| 3 | Evidence and delivery summary near CTA reduces uncertainty | Paid contribution per PDP visitor | Unsupported-claim checks, support workload |
| 4 | Optional recovery disclosure simplifies checkout | Paid checkout conversion | Recovery contribution, informed opt-in |
| 5 | One relevant accessory beats multiple suggestions | Contribution per checkout visitor | Abandonment, duplicate items, returns |
| 6 | A revised gift/shipping policy creates incremental value | Contribution per eligible visitor | Conversion, complaints, fulfilment cost |
| 7 | Better-timed reorder messaging improves retention | 90/180-day contribution per eligible buyer | Unsubscribe, complaints, discount dependence |

Predeclare one primary metric, the minimum worthwhile effect, sample-size method, duration/decision rule, and refund/payment maturation period. Check sample-ratio mismatch and exclude internal tests. Avoid simultaneous offer and layout changes that make attribution uninterpretable. Record an inconclusive outcome as inconclusive.

For scale context, a conventional two-sided 5% significance / 80% power calculation for paid conversion increasing from 1.5% to 1.8% needs approximately **28,300 independent observations per arm**. At 10,000 eligible observations a month, the total is about 5.7 months. This is illustrative binary-outcome math; repeat sessions require visitor-level treatment, and contribution variance needs a separate power calculation. Small stores should prioritize verified repairs and moderated usability work rather than declare weekly statistical winners.

| Window | Deliverables and owner | Exit criterion |
| --- | --- | --- |
| Days 1-7 | Owner/operations: product evidence and policy facts. Engineering: size/price/description fixes and margin reconciliation. Analytics: baseline design. | Correct product information; reconciled synthetic discount/refund examples; clear evidence status |
| Days 8-21 | Design/engineering: compact PDP, checkout disclosures, gift clarity. Analytics: canonical IDs, paid attribution, quote/performance monitoring. | Mobile/desktop purchase journeys validated; paid events reconciled in controlled environment |
| Days 22-45 | CRM/operations: verify flows, delivery handling, cohort reports. Growth: one meaningful test or moderated evaluation. | No duplicate/ineligible sends; credible baseline and test readout |
| Days 46-90 | Growth/finance: offer and retention experiments, eligible channel pilot, provider/platform business case if justified. | Decisions based on mature contribution, cash payback, and operational capacity |

Allow roughly **10-20 focused engineering/design days** across the first two phases, plus owner content and data work. This is a planning range, not a quote; regulatory advice, certificate lead times, provider underwriting, and statistical accumulation can extend calendar duration. Keep one accountable commercial owner and a weekly decision log.

<!-- PAGEBREAK -->

## 13. Evidence and acceptance appendix

Repository evidence refers to commit `061e76a`; component/lib paths are relative to `storefront/`. Live observations date from 13 September 2026. Code inspection does not prove deployment. The September release record provides historical context.

| Ref | Evidence | Acceptance check |
| --- | --- | --- |
| E1 | Live homepage, `/shop`, and GHK-Cu PDP; `storefront/app/(store)/shop/page.tsx` card mapping; `components/ProductCard.tsx` | Same purchasable starting price and full size information across all listing surfaces |
| E2 | GHK-Cu `50` selection changes single price to $59.99 and default pack to $162, while details retain 100 mg; `components/ProductPurchase.tsx`; product page | Size switch updates the actual purchasable identity and all relevant visible specifications |
| E3 | BPC-157 at 390 x 844: pack fieldset y=783, primary CTA y=1,179; 3-pack $161 versus single $59.99; `components/BuyBox.tsx`; `lib/catalog.ts` | Correct size/pack/price apparent without excessive scrolling; instrument selection and paid result |
| E4 | Live `/lab-results` empty; sampled PDP certificate modules unavailable; `lib/coa.ts`; September release record | Document is authentic, opens correctly, and has explicitly matching scope; no historical fallback portrayed as current |
| E5 | Live BPC-157 details and product page's `stripHtml` conversion | Paragraphs, entities, lists, and approved links render clearly without introducing unsafe HTML |
| E6 | Live `/about`, footer, and route inventory | Factual entity and policies accessible near cart/checkout; no fabricated address, ABN, or guarantee |
| E7 | Live unsubmitted checkout in in-app browser and Chrome; `components/CheckoutForm.tsx:79`; `lib/payments.ts`; `lib/shipping.ts` | Quote latency/error monitored; valid method and total appear; no order duplicated on retry; payment controls tested in staging |
| E8 | Live gift/paid-water overlap and gift-only cart; `components/CartContents.tsx:38`, `CartUpsell.tsx`, `CheckoutBump.tsx`; BuyBox | Quantities clear; no redundant suggestions; gift eligibility handles empty carts and discounts |
| E9 | `lib/admin/costs.ts:134`; `lib/admin/reports.ts:171`; discount allocation in commerce migrations | Full price, coupon, partial refund, no-restock refund, gift, and missing-cost cases reconcile to a signed-off ledger example |
| E10 | `lib/analytics.ts`; `lib/paid-analytics.ts`; checkout actions; paid analytics migrations; `BASELINE.md`; release record | Canonical IDs, assignment-to-paid join, purchase/refund ingestion and coverage verified; no PII in analytics |
| E11 | `lib/admin/sequences.ts`; `lib/email/templates.ts`; lifecycle/outbox cron routes | Controlled delivery, eligibility, suppression, no duplicate sends, and paid outcomes verified |
| E12 | Homepage's featured Tesamorelin out of stock; `lib/catalog.ts` positional pack badges | Availability-aware ordering and a real basis for every popularity claim |
| E13 | `docs/audits/2026-09-09-PRODUCTION-RELEASE.md` | Reconcile current capabilities; distinguish generic certificate from allocated shipment lot |
| E14 | Live `/creators`; `lib/creators/content.ts` | Audience/offer eligibility assessed; both gifts and all other acquisition costs included |

The next baseline should include 90-180 days of paid orders, line discounts/refunds, landed costs, shipping costs, first/returning customer identity resolved internally, channel spend, and a reliable session period. No private customer data needs to appear in the shared audit. Until those inputs exist, specific revenue-loss estimates, current LTV, channel rankings, and promised uplift remain unquantified.

<!-- PAGEBREAK -->

## Sources

External sources were accessed on 13 September 2026. Research findings are directional and have different populations, dates, and commercial incentives. Baymard pages currently show slightly different aggregate abandonment rates and survey percentages across articles; this report uses its statistics page for the quoted reasons and does not rely on a precise global abandonment rate.

[^1]: Baymard Institute. [Ecommerce UX Statistics](https://baymard.com/learn/ux-statistics). Current page; publication date not stated. Used for reported abandonment reasons and context, not an ECL benchmark.
[^2]: Shopify. [Shopify Checkout](https://www.shopify.com/checkout?swcfpc=1). Current product page; underlying comparison identified as April 2023 commissioned research. Used for checkout claims and their limitations.
[^3]: Baymard Institute. [Product Page UX Best Practices](https://baymard.com/blog/current-state-ecommerce-product-page-ux). Current 2026 page. Used for variant controls, unit prices, and total cost near purchase.
[^4]: Baymard Institute. [Product Listing UX: What Information to Display in Product Listings](https://baymard.com/blog/product-listing-information). Current page. Used for variant visibility in listings.
[^5]: Australian Communications and Media Authority. [Avoid sending spam](https://www.acma.gov.au/avoid-sending-spam). Current guidance. Used for consent, sender identity, and unsubscribe requirements.
[^6]: Shopify. [How Princess Polly Increased Sales by 4% Using Shop Pay Authenticated Checkout](https://www.shopify.com/case-studies/princess-polly-shop-pay). Publication date not stated. Vendor case study; used for the eligible-session and Australian order results, not a general forecast.
[^7]: Australian Competition and Consumer Commission. [False or misleading claims](https://www.accc.gov.au/consumers/advertising-and-promotions/false-or-misleading-claims). Current guidance. Used for substantiation of price, product, image, and fulfilment claims.
[^8]: Australian Competition and Consumer Commission. [Repair, replace, refund, cancel](https://www.accc.gov.au/consumers/problem-with-a-product-or-service-you-bought/repair-replace-refund-cancel). Current guidance. Used for consumer guarantees and distinction from discretionary policies.
[^9]: Therapeutic Goods Administration. [Understanding your responsibilities when importing, compounding and supplying unapproved peptide products](https://www.tga.gov.au/safety/safety-monitoring-and-information/safety-alerts/understanding-your-responsibilities-when-importing-compounding-and-supplying-unapproved-peptide-products). 13 April 2026. Used for the category-specific supply and advertising dependency.
[^10]: Google Analytics. [Measure ecommerce](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce). Current documentation. Used for product identifiers, purchase, refund, and event structure.
[^11]: Google Analytics. [Send Measurement Protocol events to Google Analytics](https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events). Current documentation. Used for server events and session parameters; reporting must be verified separately.
[^12]: Philip Walton / Google web.dev. [Web Vitals](https://web.dev/articles/vitals). Updated 31 October 2024; current guidance. Used for LCP, INP, CLS and 75th-percentile measurement.
[^13]: Google web.dev / Vodafone. [Vodafone: A 31% improvement in LCP increased sales by 8%](https://web.dev/case-studies/vodafone). 17 March 2021. Older controlled case study, included as mechanism evidence rather than a current-sector benchmark.
[^14]: Klaviyo. [2026 email marketing benchmarks by industry](https://www.klaviyo.com/products/email-marketing/benchmarks). 2026. Vendor observational data across more than 183,000 customers as stated on this page; used for flow relevance, not incrementality.
[^15]: Google Ads. [Healthcare and medicines](https://support.google.com/adspolicy/answer/176031). Current policy. Used for restrictions on terms and unapproved substances; exact campaign eligibility remains unassessed.
[^16]: Shopify Help Center. [Shopify Payments eligibility](https://help.shopify.com/en/manual/payments/shopify-payments/onboarding/eligibility). Current guidance. Used for business/product restrictions and provider eligibility.
[^17]: Stripe. [Prohibited and Restricted Businesses](https://stripe.com/legal/restricted-businesses). Updated 13 May 2026. Used for underwriting distinctions and limits; no acceptance for ECL is assumed.
[^18]: Google Search Central. [Product Variant Structured Data](https://developers.google.com/search/docs/appearance/structured-data/product-variants). Current documentation. Used for variant grouping and distinguishable variant URLs; rich-result eligibility is not guaranteed.

Public site evidence: [Homepage](https://www.eastcoastlabs.com.au/), [Shop](https://www.eastcoastlabs.com.au/shop), [BPC-157](https://www.eastcoastlabs.com.au/product/bpc-157), [GHK-Cu](https://www.eastcoastlabs.com.au/product/ghk-cu), [Lab Results](https://www.eastcoastlabs.com.au/lab-results), [About](https://www.eastcoastlabs.com.au/about), [Creators](https://www.eastcoastlabs.com.au/creators), and the unsubmitted [Checkout](https://www.eastcoastlabs.com.au/checkout). Browser observations and repository evidence take precedence over older cached search extracts.
