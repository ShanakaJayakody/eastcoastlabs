# East Coast Labs — Ecommerce Upgrade Plan

> **Site:** https://eastcoastlabs.com.au · **Stack:** WordPress 7.0.2 + WooCommerce + Elementor 4.1.4 (Hello Elementor theme) + CartFlows + Bankful gateway + Rank Math + MonsterInsights/GA4
> **Reference model:** au.respire.com (Shopify + Recharge + Loox + Klaviyo + AfterSell + VWO) — torn down live on 2026-07-21
> **Executor:** GLM 5.2 (LLM coding agent) + you for admin/click tasks
> **Prepared:** 2026-07-21 · Grounded in live audits of both sites (all prices/copy below quoted from the live pages)

---

## 0. Executive Summary — The 5 Biggest Levers

1. **Offer architecture (biggest revenue lever).** All 15 SKUs are single-vial only. Peptide vials are consumables with perfect repeat-purchase economics, yet there are no multi-vial packs, no bundles, no subscriptions. Respire's engine — 3 tiers, middle tier pre-selected, per-unit price framing, bulk discount anchored to N× single price — transfers directly. **One critical translation: Respire sells "1/3/6 Month Supply"; you cannot.** "Month supply" implies a human dosing schedule, which contradicts your "research use only" positioning and creates TGA exposure. Sell **1 vial / 3-pack / 6-pack** instead. Same psychology, compliant framing.
2. **Kill the credibility leaks (biggest trust lever).** The homepage shows 6 testimonials from stock-sounding names ("Sarah Johnson", "Michael Chen"…) while the store has **2 real WooCommerce reviews total**. One testimonial ("Nagging rotator cuff injury seemed to disappear almost immediately after KLOW!") **implies human use — a legal liability, not just a trust problem.** Every SKU shows a permanent fake "was/now" discount. Scam-wary peptide buyers detect all of this instantly. Remove, replace with real verified reviews.
3. **Weaponize the COA page.** Your single best asset — JanoShik independent testing, batch IDs, 99.18–99.88% purity — is buried on `/coa/`. Respire puts "Test Results 🔬" in main nav and its rating badge above the H1. Surface batch-level proof **on every product page** as a verification module.
4. **Fix the identity vacuum.** `/about/` returns 404. Support email is `eclpeptides@gmail.com` (free Gmail). No ABN, no address, no phone. For a high-scrutiny category, this reads as a fly-by-night operation. About page + ABN + branded email are cheap and high-yield.
5. **Retention infrastructure.** No Klaviyo, no abandoned-cart flow, no post-purchase sequence, no restock reminders — for a product people re-buy on a predictable cycle. This is the LTV lever that makes tiers and subscriptions compound.

**Expected impact order:** Phase 2 (offers) > Phase 1 (trust) > Phase 5 (retention) > Phase 3 (subscriptions) > Phase 4 (PDP/home rebuild) > Phase 6 (measurement). Sequenced below by dependency, not impact — trust fixes come first because tiers convert better on a site people believe.

---

## 1. How to Execute This Plan with GLM 5.2

### Operating model

- **Task ownership.** Every task below is tagged:
  - **[GLM]** — code, content, and data work GLM 5.2 does well: child-theme/custom-plugin PHP, CSS, WooCommerce REST API / WP-CLI product operations, copywriting, template overrides, email drafts.
  - **[HUMAN]** — clicks GLM can't or shouldn't do: plugin purchases/installs, payment-gateway settings, Elementor drag-and-drop edits, DNS/email setup, account signups.
  - **[GLM+HUMAN]** — GLM produces the artifact (copy, config, code), you paste/apply it.
- **Why the split matters:** Elementor page layouts are stored as JSON in the database, not as theme files. GLM cannot reliably hand-edit Elementor layouts as code. So all custom conversion components (tier cards, sticky add-to-cart, COA badges, cart notices) are built as a **single custom plugin** (`ecl-conversion`) using WooCommerce hooks — code GLM fully owns — rather than Elementor edits.
- **Environment.** Before ANY change: **[HUMAN]** create a staging copy (host staging feature, or WP Staging plugin) and a full backup (UpdraftPlus or host snapshot). GLM works on staging; you review; then push/replay to production. Give GLM access via WP-CLI over SSH or the WordPress/WooCommerce REST API with an application password — never the live DB directly.
- **Verification loop.** Every GLM prompt below ends with acceptance criteria. After each task, verify on staging in a real browser (load the page, add to cart, screenshot) before moving on. GLM must state what it verified, not "should work".
- **Prompts are self-contained.** GLM 5.2 has no memory of this document's research. Each phase's prompt block embeds the needed context. Paste one block per session/task.

### Compliance guardrails (apply to every phase — non-negotiable)

Several catalog compounds (semaglutide, tirzepatide, retatrutide) are prescription-scheduled in Australia. The "research use only" positioning is your legal shield. Every piece of copy, review, email, and offer must preserve it:

- **Never** use: "month supply", dosage/dosing language, "take", "results", weight-loss/healing/anti-aging benefit claims, before/after imagery, or any implication of human consumption.
- **Always** frame quantities as vial counts and purchases as lab restocking ("restock", "keep your research supplied").
- Reviews: moderate out any published review describing human use or effects (see Phase 1.3). Remove the existing "rotator cuff" testimonial immediately.
- Emails: replenishment reminders reference supply levels, never usage effects.
- Keep the existing "research use only" disclaimers and acknowledgment checkboxes; extend them to new surfaces (subscription signup, review submission).
- **This is why Respire's framing is adapted, not copied.** Respire sells a consumer wellness product and can say "Transform Your Sleep" and "3 Month Supply". You sell research chemicals; your version of the same psychology is purity proof, vial-count packs, per-vial pricing, and logistics/service claims (dispatch speed, testing standard, discretion).

---

## 2. Current-State Audit (live, 2026-07-21)

### What's already good
- **COA program is genuinely strong:** 14 compounds, independent lab (JanoShik), batch IDs (e.g. #89714), purity 99.18–99.88%, verification dates. This is rare and under-used.
- Real per-batch product photography (batch-stamped filenames like `Reta10mg-Dec25_.png`) — not AI renders. Just too few (2 images/product).
- Clean hero promise ("Lab-grade peptides, made simple."), 15%-off welcome offer, sensible nav, structured PDP descriptions with specs tables and literature links.
- CartFlows already installed (checkout funnel + order-bump capability ready).

### The problems, page by page

| # | Problem | Where | Evidence (live) |
|---|---------|-------|-----------------|
| 1 | Single-vial-only catalog; zero packs/bundles/subscriptions | All 15 PDPs | Only a quantity stepper; no variants |
| 2 | Permanent fake "was/now" anchors on every SKU | Catalog + PDPs | e.g. KLOW "$179.99 → $149.99" year-round, all 15 products "on sale" |
| 3 | Stock-named testimonials vs 2 real reviews | Homepage | "Sarah Johnson", "Emma Williams", "Olivia Brown"… none match the 2 WooCommerce reviews |
| 4 | Testimonial implying human use | Homepage | "Nagging rotator cuff injury seemed to disappear almost immediately after KLOW!" |
| 5 | Contradictory stock claims | PDPs | Hardcoded "In stock — ships today" directly under red "ON BACK ORDER… JUNE 20" banner (stale, dated) |
| 6 | Purity number conflict | PDPs vs policy | Trust icon "≥99% purity" vs spec table & refund policy "≥98%" |
| 7 | Dispatch claim conflict | Home vs policy | "24h Ships from Australia" vs shipping policy "1–2 business days" |
| 8 | No About page / business identity | `/about/` = 404 | No ABN, no address, no phone anywhere |
| 9 | Free Gmail support address | Contact + policies | `eclpeptides@gmail.com` |
| 10 | No review infrastructure | All PDPs | Native Woo comments; 13/15 products have zero reviews; no verified-buyer badges, no aggregate widget |
| 11 | COA proof not on PDPs | PDPs | Only a generic "COA included" icon; no batch/purity data where the buy decision happens |
| 12 | No guarantee at point of sale | PDPs | Refund policy = no returns; purity refund requires the customer to pay for their own third-party test |
| 13 | No payment reassurance | Checkout | Bankful hosted gateway only; no gateway explanation, no statement-descriptor disclosure, no security messaging |
| 14 | Thin product media | PDPs | 2 images (bac water: 1); no scale/reconstitution/COA-in-context shots |
| 15 | No email/SMS platform | Sitewide | Basic WP form only; no Klaviyo, no flows; welcome code is "WELCOME!" (trailing `!` invites typos) |
| 16 | No pixels beyond GA4/Pinterest | Sitewide | No Meta pixel, no server-side events (note: peptide ads are restricted anyway — see Phase 6) |
| 17 | Templated AI-flavored copy | PDPs + home | Same skeleton across products: "…has gained significant attention within scientific research communities…" |
| 18 | Cross-sell is default "related products" | PDPs + cart | No bac-water attach (the natural accessory for every peptide order), no order bump |

### Respire's playbook (what we're adapting)

From the live teardown of au.respire.com (Shopify/Recharge/Loox/Klaviyo/AfterSell/VWO):

- **Buy box:** "Choose Your PACK" — 3 radio cards. 1/3/6 tiers at $39 / $94 (~~$117~~) / $163 (~~$234~~). Compare-at = N× single price (honest bulk anchor). Middle tier **pre-selected** + "MOST POPULAR"; top tier "BEST DEAL". Per-unit framing ("from $0.72 per night"). Every tier lists its free gift ("FREE Shipping & Container").
- **Subscription:** pre-checked "Save more with Automatic Refills! Zero commitment, Cancel Anytime". Cadence coupled to pack size (3-pack ships every 3 months — no separate frequency picker). Marketed "saves 40%/50%" is anchored to N× single price; the real subscription adjustment is 10/25/28% off the one-time pack price. Perks branded as "Membership": never run out, up to 45% off, free shipping, free gift, 30-night guarantee. "Skip, pause or cancel easily" everywhere.
- **Dual lane:** a Bundles page for subscription-averse buyers — "crafted for those who don't like subscriptions but want to buy in bulk/save" (one-time ladder: 20/30/40/50% off for 2/3/6/12-pack).
- **Trust:** "Rated 4.9/5 from 3223 Reviews" badge **above the H1** sitewide; dedicated nav-level "Test Results 🔬" page (ISO 17025 lab, "down to less than one part per billion", "No other brand tests to this standard"); 30-night no-questions refund quoted under every CTA.
- **Cart drawer:** free-gift line item, "Upgrade to a subscription for FREE SHIPPING" bar ($79 threshold for one-time; subs ship free), cross-sell rows, $1.99 shipping-protection toggle, pre-checkout "Upgrade & SAVE 50%" bundle modal, AfterSell post-purchase one-click 2-packs.
- **Announcement bar** is itself a link to the money PDP ("SITEWIDE SALE — UP TO 50% OFF").
- **Testing culture:** dozens of hidden duplicate products per ad-funnel price test under VWO.

What we deliberately **don't** copy: "month supply" naming, health-benefit claims/timelines ("Month 2 & Beyond: Enhanced Facial Structure"), survey stats ("87% of members…"), evergreen fake "SITEWIDE SALE", and the aggressive marketed-discount inflation. The first three are compliance-fatal in your category; the last two are exactly the pattern your scam-wary audience distrusts.

---

## 3. The Phases

**Sequence:** 0 → 1 → 2 → 3 → 4 → 5 → 6. Phases 1 and 2 are independent after 0 and can run in parallel. Don't start 3 before 2 (subscriptions attach to the new tier variants).

---

### Phase 0 — Foundations & Integrity Fixes (Week 1 · effort: S)

Stop the self-inflicted damage before building anything.

| Task | Owner |
|------|-------|
| 0.1 Full backup + staging environment; give GLM WP-CLI/REST access with an application password | HUMAN |
| 0.2 Create child theme (of Hello Elementor) + empty `ecl-conversion` plugin scaffold — the code home for everything below | GLM |
| 0.3 Remove the stale red "ON BACK ORDER… JUNE 20" banner; replace with real per-product stock status driven by Woo inventory (in stock → "In stock — dispatched within 1 business day"; backorder → honest lead time). Kill the hardcoded "ships today" line | GLM |
| 0.4 Resolve purity claim to ONE number everywhere (recommend "≥99%" only if every current COA supports it — check `/coa/` data; else "≥98%"). Update trust icons, spec tables, refund policy | GLM+HUMAN (you confirm the number) |
| 0.5 Align dispatch claims: pick "dispatched within 1 business day" (or whatever is true) across homepage, PDPs, shipping policy | GLM |
| 0.6 Branded email: set up `eclpeptides@gmail.com` (host mailbox or Google Workspace), update Contact page, policies, WooCommerce sender | HUMAN, then GLM updates site copy |
| 0.7 Change welcome code from `WELCOME!` to `WELCOME15` (matches the "15% off" promise; no punctuation typos); update announcement bar + popup + policies | GLM |
| 0.8 Remove the 6 stock-named homepage testimonials — especially the "rotator cuff… KLOW" one (human-use implication = legal exposure). Leave the section empty or swap in the COA proof module from Phase 1.2 until real reviews exist | GLM+HUMAN (Elementor edit — GLM writes replacement copy) |

**Acceptance criteria:** staging live; child theme + plugin active; zero pages contain "ON BACK ORDER…JUNE 20", "ships today" hardcode, `eclpeptides@gmail.com`, "WELCOME!", or any of the 6 testimonial names; purity states one number sitewide; dispatch claim identical on all surfaces.

**GLM 5.2 prompt — Phase 0:**

```text
You are working on a WordPress 7 + WooCommerce site (eastcoastlabs.com.au) on a STAGING copy.
Stack: Hello Elementor theme + Elementor 4.1.4 page builder, CartFlows, Rank Math, MonsterInsights.
Access: WP-CLI via SSH and WooCommerce REST API (application password provided).
Constraint: Elementor page layouts are DB-stored JSON — do NOT attempt to edit Elementor layout JSON directly.
Build all custom code in (a) a child theme of hello-elementor and (b) a new plugin `ecl-conversion`.
Compliance: this store sells research-use-only peptides. Never write copy implying human use, dosing,
or health benefits. Quantities are "vials"/"packs", never "month supply".

Tasks:
1. Create child theme `hello-elementor-child` and activate it. Create plugin `ecl-conversion`
   (single main file + /includes, /assets) and activate it.
2. Find where the red backorder banner ("ON BACK ORDER. ORDERS PLACED AFTER 3:30PM JUNE 20...")
   is defined (Elementor global, theme hook, or plugin notice) — report where, then remove it.
   In `ecl-conversion`, add a stock-status line on single product pages via the
   `woocommerce_single_product_summary` hook: if in stock → "In stock — dispatched within 1 business day",
   if on backorder → "Made to order — allow 7–12 business days". Remove any hardcoded
   "In stock — ships today" text (search all post content and Elementor data via WP-CLI
   `wp db search 'ships today'` and report locations for anything you cannot safely edit).
3. Sitewide consistency sweep with `wp db search`: report and fix (where editable via
   post content/options) all instances of: "≥99%" vs "≥98%" purity (target: [OWNER TO CONFIRM]),
   "24h" dispatch claims (target: "dispatched within 1 business day"), "eclpeptides@gmail.com"
   (target: "eclpeptides@gmail.com"), coupon "WELCOME!" (create WooCommerce coupon
   WELCOME15, 15% off first order, then report old-code locations).
4. List every location (page ID + widget) containing the testimonial names Sarah Johnson,
   Michael Chen, Emma Williams, Daniel Lee, Olivia Brown, James Martinez so the owner can
   delete those Elementor widgets. Do not attempt the Elementor edit yourself.

Verify each change by loading the affected staging URL (curl or browser) and quoting the changed
output. Report anything you could not change with exact locations. Do not touch production.
```

---

### Phase 1 — Trust Overhaul (Weeks 1–2 · effort: M)

#### 1.1 Reviews that are real and look real — **[GLM+HUMAN]**
- Install **Judge.me for WooCommerce** (free tier is fine to start): verified-buyer badges, photo reviews, aggregate star widgets, automatic post-purchase review-request emails, moderation queue. (Alternative if you prefer: Stamped or ReviewX — Judge.me recommended for price + verified badges + Woo depth.)
- Import the 2 existing WooCommerce reviews.
- Review-request email timed **14 days after delivery**, asking specifically about: dispatch speed, packaging/discretion, COA verification experience, purity testing if they tested independently. This steers reviews toward compliant, high-credibility content (the Emma Williams-style "tested it myself, 99%+ purity" review is the ideal shape — but real this time).
- **Moderation rule (hard):** never publish reviews describing human use, effects, or results. Approve service/logistics/purity/testing reviews only. Document this in the plugin's moderation notes so it survives staff changes.
- Seed volume: email past customers (export from WooCommerce orders) a one-time review request with a small next-order coupon for **any honest review** (incentive for reviewing, never for positive reviews).
- Display: aggregate stars on shop cards + PDP title area; full review feed at PDP bottom (Respire's Loox placement).

#### 1.2 Elevate the COA program to Respire's "Test Results" standard — **[GLM]**
- Rename nav item to **"Lab Results 🔬"** (matches Respire's nav-level trust placement).
- Build a **per-product COA module** in `ecl-conversion`, rendered under the buy box on every PDP: current batch ID, JanoShik purity % for that compound, test date, link to the full COA PDF *and to JanoShik's own verification where available* (third-party verifiability beats self-hosted claims for this audience). Data source: a simple ACF/meta field set or a JSON option GLM maintains per product.
- Homepage: replace the removed fake-testimonial block with a **live proof strip**: "Latest batch results — BPC-157: 99.72% · Semaglutide: 99.88% · tested by JanoShik [date] → See all lab results".
- Copy angle to own (your version of "No other mouth tape brand tests to this standard."): **"Every batch tested by an independent lab. Every result published. If it doesn't pass, it doesn't ship."** — you already have the substance; make it the brand's spine.

#### 1.3 Risk reversal at the point of sale — **[GLM+HUMAN]**
Current refund policy is a trust killer ("no returns; pay for your own lab test to claim purity refund"). Compliant, affordable guarantee:
> **"Purity Guaranteed. Every vial ships with an independent COA. If any independent lab test shows your batch below [98/99]% purity, we refund or replace it — and we cover the cost of the test. Wrong, damaged, or missing items are replaced free within 30 days. One email: eclpeptides@gmail.com."**
- The "we cover the test" reversal flips the single worst clause in the current policy into a confidence signal — you already publish JanoShik results, so the actuarial risk is near zero.
- Render as a guarantee block on every PDP (under COA module) + a badge row site-wide. Update `/refund-policy/` to match. **You approve final legal wording.**

#### 1.4 Business identity — **[GLM+HUMAN]**
- Create `/about/`: who runs ECL, why it exists, the testing philosophy, photos of real packaging/lab bench if available, ABN, city of operation, support hours, response-time promise ("replies within one business day" — already true per your contact page, so say it everywhere).
- Footer: ABN + "Australian owned & operated · Ships from [state]" + support email + Lab Results link.
- GLM drafts all copy from your inputs (you provide: founder background, ABN, location, origin story bullet points).

#### 1.5 Payment trust — **[GLM+HUMAN]**
- You likely can't add Stripe/PayPal/Afterpay (mainstream processors prohibit peptide merchants — that's why Bankful is there). **Don't fake it; explain it.** Add a checkout FAQ + microcopy block: what the gateway is, that card details are processed on a secure PCI-compliant hosted page, and **what descriptor appears on the card statement** (discretion is a feature for this audience — say so).
- Add secure-checkout signals near the button: SSL/lock icon, "PCI-DSS compliant processing", accepted card logos. **[HUMAN]**: confirm with Bankful the exact statement descriptor + card brands, and ask whether they support tokenized recurring billing (needed for Phase 3 — ask now).

#### 1.6 De-AI the copy — **[GLM]**
Rules for every rewrite (apply across Phases 2/4 too):
- Replace vague claims with numbers you own: not "trusted by researchers" → "4,183 orders shipped since 2024" (use the real number from WooCommerce); not "premium quality" → "99.72% purity, batch #89714, tested 14 June".
- Kill the templated skeleton ("…has gained significant attention within scientific research communities…" appears on multiple PDPs) — each product description gets one distinct fact-led opening tied to its literature link.
- Shorter sentences. Specific nouns. No "unlock", "elevate", "seamless", "hassle-free", em-dash chains, or triple-adjective stacks.
- Before/after example (homepage stat row):
  - Before: "★★★★★ Trusted by researchers"
  - After: "★ 4.9 average from verified buyers" (only once real reviews exist — never fabricate the number)

**Acceptance criteria:** Judge.me live with request flow + documented moderation rule; COA module on all 15 PDPs with real batch data; guarantee block on PDPs + policy updated; `/about/` returns 200 with ABN; checkout shows gateway explanation + statement descriptor; zero pages contain the templated description skeleton.

**GLM 5.2 prompt — Phase 1 (code portions):**

```text
Same site/stack/access/compliance constraints as before (WooCommerce + Elementor staging;
build in `ecl-conversion` plugin; research-use-only copy rules; no Elementor JSON edits).

Tasks:
1. In `ecl-conversion`, build a COA module rendered via `woocommerce_single_product_summary`
   (priority after price) on all product pages. Data: per-product post meta
   `_ecl_coa` = {batch_id, purity_pct, lab, test_date, coa_url, lab_verify_url}.
   Create a WP-CLI-seedable importer (CSV → meta) and seed from the data on /coa/
   (fetch and parse the staging /coa/ page; map compounds to products by name).
   Render: "Batch #{batch_id} — {purity_pct}% purity · tested {test_date} by {lab}"
   with links "View COA" and "Verify with lab". Style minimal, matches site palette.
2. Build a guarantee block (template in the plugin, text filterable) rendered under the COA
   module, with this copy: [PASTE FINAL GUARANTEE WORDING FROM OWNER].
3. Create an /about/ page (WP page, classic block content — NOT Elementor) from this outline:
   [OWNER INPUTS: founder background, ABN, location, origin story]. Add ABN + "Australian
   owned & operated" + support email to the footer via hook or widget (report if the footer
   is Elementor-built and needs a HUMAN edit — provide exact copy to paste).
4. Rewrite all 15 product descriptions. Keep the existing structure (intro, research
   applications bullets, specifications table, storage, handling, external study link) but:
   distinct fact-led opening per product tied to its cited paper; no phrase reused across
   more than one product; no human-use or benefit language; keep "research use only" line.
   Apply via WooCommerce REST API. Output a diff summary (old opening → new opening per SKU).
5. Checkout trust block: add microcopy near the payment section (CartFlows checkout) —
   secure hosted processing, PCI-DSS, statement descriptor "[FROM BANKFUL]", card logos.

Verify: load 3 sample PDPs + checkout on staging, quote the rendered COA/guarantee text.
Judge.me installation and review-request configuration are HUMAN tasks — output the exact
settings to use (trigger: 14 days after order completed; template copy provided) instead.
```

---

### Phase 2 — Offer Architecture: Packs, Pricing, Bundles (Weeks 2–3 · effort: L)

The Respire engine, compliance-translated.

#### 2.1 Tier structure — **[GLM]**
Convert each peptide from a simple product to a **variable product** with attribute **Pack Size**: `1 vial`, `3 vials`, `6 vials`. (WooCommerce REST API / WP-CLI; keep existing SKU as the 1-vial variant SKU; new variant SKUs = `{SKU}-3PK`, `{SKU}-6PK`.)

**Pricing model (honest version of Respire's ladder):**
- **Kill every fake compare-at price.** Current "now" price becomes the true single-vial price. (Respire's anchor trick only works because the anchor is real: N× the single price.)
- 3-pack = 15% off 3× single. 6-pack = 25% off 6× single. Anchor shown = N× single (real, defensible: "vs buying singles").
- Show **per-vial price on every tier card** (Respire's "$0.72 per night" translated compliantly: "$44.83 per vial").

**Full price table (from live single prices):**

| Product | 1 vial | 3-pack (15% off) | per-vial | 6-pack (25% off) | per-vial | 6-pack saving shown |
|---|---|---|---|---|---|---|
| KLOW | $149.99 | $382 | $127.33 | $674 | $112.33 | "Save $225" |
| IGF-1 LR3 | $139.99 | $356 | $118.67 | $629 | $104.83 | "Save $210" |
| GLOW | $119.99 | $305 | $101.67 | $539 | $89.83 | "Save $180" |
| Tesamorelin | $104.99 | $267 | $89.00 | $472 | $78.67 | "Save $157" |
| Retatrutide | $99.99 | $254 | $84.67 | $449 | $74.83 | "Save $150" |
| Tirzepatide | $89.99 | $229 | $76.33 | $404 | $67.33 | "Save $135" |
| TB-500 | $89.99 | $229 | $76.33 | $404 | $67.33 | "Save $135" |
| Semaglutide | $84.99 | $216 | $72.00 | $382 | $63.67 | "Save $127" |
| GHK-Cu | $79.99 | $203 | $67.67 | $359 | $59.83 | "Save $120" |
| MOTS-C | $69.99 | $178 | $59.33 | $314 | $52.33 | "Save $105" |
| Selank | $64.99 | $165 | $55.00 | $292 | $48.67 | "Save $97" |
| Semax | $59.99 | $152 | $50.67 | $269 | $44.83 | "Save $90" |
| BPC-157 | $59.99 | $152 | $50.67 | $269 | $44.83 | "Save $90" |
| MT2 | $39.99 | $101 | $33.67 | $179 | $29.83 | "Save $60" |
| Bacteriostatic Water | $19.99 | — (stays simple; it's the attach item) | | 3-pack $49 optional | | |

(Rounding: down to whole dollars; GLM may normalize to a .99/.00 convention — keep it consistent.)

#### 2.2 Buy-box UI — **[GLM]**
Radio-card tier selector in `ecl-conversion` (replaces the default variation dropdown via `woocommerce_variable_add_to_cart` template override in the child theme):
- Card per tier: pack label, per-vial price, total price, real anchor strikethrough (3/6-packs only), badge.
- **3-pack pre-selected + "MOST POPULAR"**; 6-pack "BEST VALUE — save 25%". (Respire's defaults, proven.)
- 6-pack perk line: "**Includes free Bacteriostatic Water** + free Express Post" (their "FREE Shipping & Container" gift line, translated — the gift costs you ~$20 retail and is the exact accessory every order needs).
- Under selector: honest scarcity only — real stock status from Phase 0.3. **No countdown timers, no fake "sale ends today".** This audience has scam radar; Respire's evergreen "LIMITED TIME SALE" is the one pattern that would hurt you.

#### 2.3 Bac-water attach + cross-sells — **[GLM]**
- Checkbox on every peptide PDP under the buy box: "**Add Bacteriostatic Water (10mL) +$19.99** — required for reconstitution" (one-click attach; Woo cart item data).
- Replace default "related products" with curated pairings (e.g. BPC-157 ↔ TB-500 — the classic pairing; GHK-Cu ↔ GLOW; any peptide → bac water if not attached).
- CartFlows **order bump** at checkout: bac water $19.99 (if not in cart) or "Add a 2nd vial — 10% off". This is Respire's AfterSell/upgrade-modal pattern using the plugin you already own.

#### 2.4 Free-shipping threshold — **[GLM+HUMAN]**
- Current AOV band = single vial $40–150. Set **free standard shipping at $150** (reachable via 3-pack or peptide+bac water; protects margin on cheap singles). 6-packs: free Express Post.
- Cart notice with progress: "You're $23 away from free shipping" (Respire's `$X away` mechanic; Woo cart hook in `ecl-conversion`).

**Acceptance criteria:** all 14 peptides are variable products with 3 correctly-priced tiers; zero `sale_price`/compare-at fakery remains; tier cards render with 3-pack pre-selected and badges; per-vial prices correct (spot-check 3 SKUs against the table); bac-water checkbox adds to cart; order bump fires at checkout; free-shipping progress notice works at $150 threshold.

**GLM 5.2 prompt — Phase 2:**

```text
Same site/stack/access/compliance constraints (WooCommerce staging; `ecl-conversion` plugin +
hello-elementor child theme; research-use-only rules — packs are "vials", NEVER "month supply").

Context: 14 peptide products currently simple products with fake permanent sale prices
(e.g. BPC-157 regular $71.99 / sale $59.99). The sale price is the real price.

Tasks:
1. Via WooCommerce REST API/WP-CLI, for each of the 14 peptide products (all except
   Bacteriostatic Water): remove sale price; set regular price = current sale price; convert
   to variable product with attribute "Pack Size" = 1 vial | 3 vials | 6 vials; variant SKUs
   {SKU}, {SKU}-3PK, {SKU}-6PK; prices per this table: [PASTE PRICE TABLE FROM PLAN §2.1].
   Set each 3/6-pack variant's regular price to N× single and sale price to the pack price
   (this renders the honest strikethrough anchor). Manage stock at variant level
   (pack stock = floor(vial stock / N) if per-vial stock tracking is on — report current setup).
2. In the child theme, override the variable-product add-to-cart template to render radio
   CARDS instead of a dropdown: pack label, total price, anchor strikethrough (3/6 only),
   per-vial line ("$50.67 per vial"), badges: 3-pack "MOST POPULAR" (pre-selected on load),
   6-pack "BEST VALUE — SAVE 25%". 6-pack card adds perk line "Includes FREE Bacteriostatic
   Water + FREE Express Post". Mobile-first CSS in ecl-conversion assets.
3. Implement the 6-pack free-gift: when a -6PK variant is in cart, auto-add Bacteriostatic
   Water at $0 (locked qty, removed if pack removed), shipping class for free express.
4. Bac-water attach: checkbox under buy box on all peptide PDPs "Add Bacteriostatic Water
   (10mL) +$19.99 — required for reconstitution", implemented via cart item data + 
   woocommerce_add_to_cart hook.
5. Free shipping: configure shipping zone AU — free standard over $150; cart/mini-cart notice
   "You're $X away from free shipping" via woocommerce_before_cart + fragments for live update.
6. Replace related-products with curated cross-sells: BPC-157↔TB-500, GHK-Cu↔GLOW,
   default third slot = Bacteriostatic Water. Set via product cross-sell fields.
7. Configure a CartFlows order bump on the checkout flow: Bacteriostatic Water $19.99,
   headline "Don't forget reconstitution supplies". (If CartFlows bump config is UI-only,
   output the exact settings for the owner instead.)

Verify on staging: screenshot/HTML-quote the BPC-157 PDP tier cards; add 6-pack to cart and
show the free gift line; show cart at $120 displaying "away from free shipping" notice.
Acceptance: spot-check Retatrutide 3-pack = $254 ($84.67/vial), Semax 6-pack = $269 ($44.83/vial).
```

---

### Phase 3 — Subscriptions: "Lab Restock Program" (Weeks 3–4 · effort: M)

#### 3.0 Gateway pre-check — **[HUMAN, blocking]**
WooCommerce subscriptions require the gateway to support tokenized recurring charges. **Ask Bankful first** (you did this in Phase 1.5). If Bankful can't do recurring: skip to 3.5 fallback — don't build billing that can't charge.

#### 3.1 Naming & framing — the compliance translation
Respire brands it "Respire Membership" with "Automatic Refills". Yours is the **"Restock Program"**: "Never run out of lab supplies. Automatic restocks, priority dispatch, always from the latest tested batch." Restocking language only — no usage cadence implications beyond delivery frequency.

#### 3.2 Mechanics (Respire's, adapted) — **[GLM+HUMAN]**
- Plugin: **WooCommerce Subscriptions** (official, ~US$239/yr) + **All Products for WooCommerce Subscriptions** (adds subscribe-and-save toggle to existing products without duplicating SKUs). Budget alternative to start: **WP Swings "Subscriptions for WooCommerce"** (free core) — acceptable for v1, migrate later; GLM should implement against whichever you buy.
- **Subscribe & Save = extra 10% off the tier price**, every renewal. Combined 6-pack+sub saving vs singles ≈ 32% — market it as "Save up to 32%" (real math, unlike Respire's inflated "50%").
- **Cadence coupled to pack size** (Respire's pattern — one less decision): 1 vial → every 4 weeks; 3-pack → every 12 weeks; 6-pack → every 24 weeks. Frequency editable in the account portal.
- **Pre-checked?** No. Respire pre-checks the subscription; for a scam-wary audience buying scheduled research compounds, default OFF with a clearly-worded toggle converts trust into subscriptions the durable way: "☐ Restock automatically & save an extra 10% — pause, skip, or cancel anytime. No lock-in."
- Perks (the "membership" stack): extra 10% off, free shipping on **all** restock orders (Respire's strongest sub lever), priority dispatch, first access to new compounds/restocks, always-current-batch COA emailed with each shipment.
- Churn controls: skip/pause/swap-product from the My Account portal (native in Woo Subscriptions), pre-renewal reminder email 5 days before each charge (compliance + fewer chargebacks), cancel = one click, no interrogation.

#### 3.3 Merchandising — **[GLM]**
- Buy box: subscribe toggle under tier cards showing live math: "One-time $254 · Restock every 12 weeks: **$228** (save $26 every order)".
- PDP FAQ accordion (Respire's buy-box FAQ pattern): "How does the Restock Program work?", "Can I cancel?", "What if I have plenty of stock left?" (→ skip/pause).
- Cart bar: "Make it a Restock order — save 10% + free shipping" (their "Upgrade to a subscription for FREE SHIPPING" line).

#### 3.4 The dual lane — **[GLM]**
Respire runs a Bundles page for subscription-haters. Your equivalent: a **"Bulk Packs"** collection page listing all 3/6-packs with per-vial savings — "For labs that prefer to buy in bulk without a subscription." One-time bulk ladder already exists via the tiers; this page just merchandises it.

#### 3.5 Fallback if Bankful can't do recurring — **[GLM]**
Build the **reminder-based pseudo-subscription**: customer opts into restock reminders at purchase; automated email at their chosen interval with a one-click reorder link (pre-filled cart) + locked-in 10% restock coupon. 80% of the retention value, zero gateway dependency. (This also becomes the Phase 5 replenishment flow — build once, use either way.)

**Acceptance criteria:** gateway answer documented; if subscribing: toggle renders with correct math on all peptide PDPs, renewal discount applies, portal supports skip/pause/cancel, pre-renewal email fires; Bulk Packs page live; if fallback: reminder opt-in + coupon + reorder link flow works end-to-end on staging.

**GLM 5.2 prompt — Phase 3:** *(paste after gateway answer known)*

```text
Same site/stack/access/compliance constraints. Subscriptions = "Restock Program"; restocking
language only; never imply usage schedules ("delivery every 12 weeks", not "3 month supply").

Gateway status: [BANKFUL SUPPORTS RECURRING: YES/NO].

IF YES (plugin installed by owner: [WooCommerce Subscriptions + All Products for Woo Subscriptions
| WP Swings]): 
1. Configure subscribe-and-save on all 14 peptide variable products: extra 10% off any tier,
   cadence mapped 1 vial→4 weeks, 3 vials→12 weeks, 6 vials→24 weeks (customer-editable).
2. In the buy-box template (from Phase 2), add an UNCHECKED toggle under the tier cards:
   "Restock automatically & save an extra 10% — pause, skip, or cancel anytime. No lock-in."
   with live price math per selected tier ("One-time $254 · Restock every 12 weeks: $228").
3. Enable customer skip/pause/frequency-change/cancel in My Account; add a pre-renewal
   reminder email 5 days before each charge (subject: "Your ECL restock ships soon — skip or
   edit anytime").
4. Add 4 FAQ items to the PDP accordion (copy provided in plan §3.3) and a cart notice
   "Make it a Restock order — save 10% + free shipping on every restock".
5. Free shipping on all subscription renewal orders regardless of total.

IF NO (fallback): build reminder-based restock in `ecl-conversion`:
1. Post-purchase opt-in (checkout checkbox + thank-you page): "Remind me to restock" with
   interval select (4/8/12/24 weeks), stored per customer.
2. WP-Cron job emails at interval: one-click reorder link that rebuilds their last cart
   (URL-based add-to-cart with variant IDs) + auto-applied coupon RESTOCK10 (10%, recurring-
   eligible customers only). Unsubscribe link mandatory.
3. Create a "Bulk Packs" page listing all 3-pack and 6-pack variants with per-vial prices,
   headline "Buy in bulk. No subscription needed." (grid via shortcode/block in the plugin).

Verify end-to-end on staging with a test order (Woo test/COD gateway is fine for flow-testing):
show the toggle math, a created subscription (or reminder record), and the renewal/reminder
email content. Quote rendered output; no "should work" claims.
```

---

### Phase 4 — PDP & Homepage Rebuild (Weeks 4–5 · effort: M)

#### 4.1 PDP blueprint (Respire's 20-section page, adapted & compressed) — **[GLM builds modules; HUMAN assembles any Elementor sections]**

Order, top → bottom:
1. Announcement bar: "Free shipping over $150 · Every batch independently tested → See lab results" (link, like Respire's clickable bar — but pointing at proof, not a fake sale)
2. **Buy box:** gallery · aggregate stars (once ≥10 real reviews) · title · one-line fact-led descriptor · tier cards (Phase 2) · restock toggle (Phase 3) · bac-water attach · ATC · stock line · guarantee microcopy under button ("Purity guaranteed — we cover the test. 1-business-day dispatch.") — Respire repeats its guarantee under every CTA; do the same
3. Trust icon row: Independent COA every batch · ≥[98/99]% purity verified · 1-business-day dispatch · Discreet packaging
4. **COA verification module** (Phase 1.2 — batch, purity, lab link)
5. Description (rewritten Phase 1.6): overview → research applications → specifications table → storage/handling → cited literature ("Read the Research" — keep, it's good)
6. Guarantee block (Phase 1.3)
7. Buy-box FAQ accordion: shipping/dispatch cutoff, COA verification how-to, Restock Program, payments/statement descriptor
8. Curated cross-sells ("Commonly researched together")
9. Judge.me review feed
10. Final CTA strip: per-vial price from 6-pack + "Choose your pack"

Plus: **sticky add-to-cart bar** on scroll (mobile especially) — product name, selected tier price, ATC button. Respire lacks one; it's a free win. `ecl-conversion`, IntersectionObserver on the buy box.

#### 4.2 Homepage — **[GLM copy + HUMAN Elementor assembly]**
Order: hero → live batch-proof strip (Phase 1.2) → bestsellers (with pack pricing "from $44.83/vial") → how testing works (keep 4-step strip, tighten copy) → real reviews carousel (once ≥10) → Restock Program promo → FAQ → email capture.
- Hero rewrite (keep the good bones, add proof + specificity):
  - H1: **"Lab-grade peptides. Independently tested. Proof published."**
  - Sub: "Every vial tested by JanoShik with the COA published before it ships. Australian owned, dispatched in 1 business day."
  - CTAs: "Shop bestsellers" · "See latest batch results"
- All homepage CTAs funnel to shop/bestsellers (Respire points 7+ CTAs at one PDP; your equivalent: bestsellers grid).

#### 4.3 Media upgrade — **[HUMAN shoots, GLM processes/uploads]**
Per product, add: vial-in-hand scale shot, COA-next-to-vial shot, packaging/unboxing shot (sells discretion), optional 15-sec reconstitution-setup clip (bac water + vial, no administration imagery — lab context only). 4–6 images per PDP. Real photos are your single strongest "not AI-generated" signal — you already shoot per-batch; extend the habit.

**Acceptance criteria:** PDP renders all 10 sections in order on staging for 3 spot-checked products; sticky ATC appears on scroll with correct tier price; homepage hero copy replaced; every PDP has ≥4 images.

**GLM 5.2 prompt — Phase 4:**

```text
Same site/stack/access/compliance constraints (WooCommerce staging; `ecl-conversion` plugin +
hello-elementor child theme; research-use-only copy rules; no Elementor JSON edits).

Tasks:
1. Sticky add-to-cart bar in `ecl-conversion`: on single product pages, when the buy box
   scrolls out of view (IntersectionObserver), show a fixed bottom bar (mobile-first) with
   product name, currently-selected tier price (sync with the Phase 2 radio cards), and an
   Add to Cart button that submits the selected variation.
2. Announcement bar: render via wp_body_open hook (so it works above the Elementor header):
   "Free shipping over $150 · Every batch independently tested → See lab results" linking to
   the Lab Results page. Dismissible, remembers dismissal in localStorage.
3. Guarantee microcopy under every ATC button (single product + sticky bar):
   "Purity guaranteed — we cover the test. 1-business-day dispatch."
4. Final CTA strip module at the bottom of PDP content: "From ${six_pack_per_vial}/vial in
   6-packs — Choose your pack" with a scroll-to-buy-box button (per-vial value computed from
   the product's -6PK variant).
5. Reorder PDP hooks so the section order matches plan §4.1 (report the final hook/priority map).
6. Output a COPY DECK (markdown, no code) for the HUMAN to paste into Elementor: homepage
   hero H1/sub/CTAs (from plan §4.2), bestsellers section intro with "from $X/vial" per
   bestseller (Tesamorelin $78.67, MOTS-C $52.33, Semax $44.83, Selank $48.67), tightened
   4-step testing strip copy, and Restock Program promo section copy.

Verify: staging screenshots/HTML of BPC-157 PDP top-to-bottom section order, sticky bar
appearing on scroll with the 3-pack price, and the announcement bar on the homepage.
```

---

### Phase 5 — Retention: Email/SMS Flows (Weeks 5–6 · effort: M)

Platform: **Klaviyo** (has a native WooCommerce integration; free to 250 profiles) — the same tool Respire runs. Alternative: Omnisend (cheaper at scale). **[HUMAN]** connects; **[GLM]** drafts every template.

Flows (all copy compliance-checked — logistics/purity/service angles only):
1. **Welcome** (popup + footer signup, "15% off your first order" — code WELCOME15): 3 emails — code + what makes ECL different (testing/proof); how to verify your COA; bestsellers with per-vial pack pricing.
2. **Abandoned cart**: 1h ("your cart's saved — dispatch cutoff 3:30pm"), 24h (guarantee + COA proof), 72h (10% nudge). Klaviyo's Woo cart tracking.
3. **Post-purchase**: order confirmed → shipped w/ tracking → delivered +2d: "How to verify your batch COA" (trust-building moment nobody else does) → +14d: Judge.me review request.
4. **Replenishment**: timed per pack size (1 vial: +3 wks; 3-pack: +10 wks; 6-pack: +22 wks): "Running low? Restock in one click" + RESTOCK10. (This is Phase 3.5's engine — built once.)
5. **Winback**: 60/90-day inactive: latest batch results + what's new in the catalog.
- Popup: exit-intent + 8-second delay, not instant; suppress for subscribers and cart pages.

**Acceptance criteria:** Klaviyo connected to Woo; all 5 flows live with final copy; popup behavior verified; test order triggers post-purchase sequence on staging/sandbox list.

**GLM 5.2 prompt — Phase 5:**

```text
Context: WooCommerce peptide store (research-use-only compliance: emails may reference
logistics, purity testing, COA verification, restocking — NEVER usage, effects, dosing, or
benefits). Brand voice: plain, specific, proof-led. Store facts: independent JanoShik COAs
per batch published on site; 1-business-day dispatch; free shipping over $150; packs of
1/3/6 vials with per-vial savings up to 25%; RESTOCK10 coupon; WELCOME15 = 15% off first order.

Klaviyo is connected to WooCommerce (HUMAN did the integration). Produce, as markdown ready
to paste into Klaviyo:
1. Welcome flow (3 emails): subjects, preview text, full body copy, CTA links.
   E1 immediately (WELCOME15 + what makes ECL different: testing/proof), E2 +2 days
   (how to verify your COA step-by-step), E3 +4 days (bestsellers with per-vial pack pricing).
2. Abandoned cart flow (3 emails: 1h / 24h / 72h) per plan §5 angles.
3. Post-purchase flow: confirmation add-on copy, shipped, delivered+2d "verify your batch
   COA" walkthrough, +14d review request (service/logistics/testing angles only).
4. Replenishment reminders (variants for 1-vial/+3wk, 3-pack/+10wk, 6-pack/+22wk) with
   one-click reorder framing + RESTOCK10.
5. Winback (60d, 90d): latest batch results angle + catalog news.
6. Popup spec: exit-intent + 8s delay, suppressed for existing subscribers and cart/checkout
   pages; headline/body/CTA copy for the 15% capture.
Also output the exact Klaviyo flow-trigger settings (event, timing, filters) per flow as a
config table for the HUMAN. Nothing in any email may imply human consumption.
```

---

### Phase 6 — Measurement & Testing Discipline (Week 6, then ongoing · effort: S)

1. **Baseline before Phase 2 ships** — **[GLM]** pulls from WooCommerce analytics (last 90 days): conversion rate, AOV, repeat-purchase rate, revenue/SKU, cart abandonment. Record in a `BASELINE.md`. Without this you can't prove the upgrade worked.
2. **GA4**: verify ecommerce events fire (view_item, add_to_cart, begin_checkout, purchase) through MonsterInsights or direct gtag; fix gaps. (No Meta/TikTok pixels: peptide ads are prohibited there anyway — your growth channels are SEO, email, and community reputation, which this plan's trust work directly feeds. Rank Math is installed; ensure Product schema with aggregateRating once reviews exist.)
3. **KPI targets (90 days post-launch):** AOV +25% (tier mix), repeat rate +30% (flows + restock), CR +15% (trust). Review monthly against BASELINE.md.
4. **Testing culture, right-sized:** Respire runs VWO with dozens of hidden funnel-variant products — overkill at your volume. Instead: **sequential before/after** (2-week windows) per change, one change at a time, judged against baseline. First three tests: (a) 3-pack vs 6-pack as default tier, (b) guarantee microcopy under ATC on/off, (c) free-shipping threshold $150 vs $130. Graduate to A/B tooling only past ~500 orders/month.

**Acceptance criteria:** `BASELINE.md` committed with 90-day CR/AOV/repeat-rate/abandonment figures dated before Phase 2 goes live; GA4 DebugView shows view_item, add_to_cart, begin_checkout, purchase firing on staging; Product schema with aggregateRating validates in Google's Rich Results test once ≥1 review exists; first sequential test scheduled with start/end dates.

**GLM 5.2 prompt — Phase 6:**

```text
Same site/stack/access constraints (WooCommerce + WP-CLI/REST on staging; GA4 via
MonsterInsights; Rank Math installed).

Tasks:
1. Pull the last 90 days from WooCommerce Analytics (REST /wc-analytics or wp wc CLI):
   orders, revenue, conversion rate (needs sessions — pull from MonsterInsights/GA4 if
   available, else note the gap), AOV, repeat-purchase rate (distinct customers with 2+
   orders / all customers), revenue per SKU, cart-abandonment proxy. Write BASELINE.md in
   the site root (dated) with every figure and its source query.
2. Verify GA4 ecommerce events on staging: view_item, add_to_cart, begin_checkout, purchase.
   Use GA4 DebugView (report what fires) — fix missing events via MonsterInsights settings
   or a gtag snippet in `ecl-conversion` (document which).
3. Confirm Rank Math outputs Product schema on PDPs; once Judge.me reviews exist, ensure
   aggregateRating appears in the JSON-LD. Validate one PDP with the Rich Results test and
   quote the result.
4. Create TESTS.md: the sequential-testing protocol from plan §6.4 with a table
   (test, hypothesis, metric, start, end, result) pre-filled with the first three tests.

Verify: quote BASELINE.md contents, the DebugView event list, and the Rich Results output.
```

---

## 4. Master Checklist (paste into your tracker)

- [ ] P0: staging + backup + child theme + `ecl-conversion` plugin
- [ ] P0: backorder banner, purity number, dispatch claim, Gmail, WELCOME! — all fixed
- [ ] P0: fake testimonials removed (incl. "rotator cuff/KLOW" human-use one)
- [ ] P1: Judge.me + review requests + moderation rule (no human-use reviews)
- [ ] P1: per-PDP COA module + homepage proof strip + "Lab Results" nav
- [ ] P1: purity guarantee ("we cover the test") on PDP + policy
- [ ] P1: About page + ABN + branded email + checkout payment-trust block
- [ ] P1: 15 descriptions rewritten, template skeleton gone
- [ ] P2: 14 products → variable, 1/3/6-vial tiers priced per table, fake sales purged
- [ ] P2: radio tier cards, 3-pack default + MOST POPULAR, 6-pack free bac water
- [ ] P2: bac-water attach checkbox + curated cross-sells + CartFlows order bump
- [ ] P2: $150 free-shipping threshold + progress notice
- [ ] P3: Bankful recurring answer → Restock Program (or reminder fallback) + Bulk Packs page
- [ ] P4: PDP 10-section rebuild + sticky ATC + homepage hero/proof rework + 4–6 photos per PDP
- [ ] P5: Klaviyo + 5 flows (welcome, abandoned, post-purchase, replenishment, winback)
- [ ] P6: BASELINE.md, GA4 events verified, product schema, first 3 sequential tests

## 5. What NOT to do (anti-patterns, deliberate)

- ❌ No fabricated reviews, testimonials, star counts, or "trusted by X" numbers you can't back.
- ❌ No fake scarcity: countdown timers, evergreen "SITEWIDE SALE", stock counters. (Respire gets away with it; your audience will not forgive it.)
- ❌ No "month supply" naming, dosing language, or benefit/effects claims anywhere — including reviews you approve and emails you send.
- ❌ No permanent compare-at anchors — the only strikethroughs allowed are real N×-single pack anchors.
- ❌ No direct edits to production; every GLM task runs on staging first, behind a backup.
- ❌ Don't promise payment methods you can't have (Afterpay/PayPal) — explain the gateway you do have.
