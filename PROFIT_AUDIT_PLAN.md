# East Coast Labs — Full Ecommerce Audit & Profit Maximization Plan

**Date:** 2026-08-05
**Scope:** Storefront (Next.js/Supabase), catalog & pricing, email lifecycle, copy, trust layer, ops.
**Method:** Full code + content + data audit against world-class ecom principles (measurement → trust → CVR → AOV → LTV → margin → traffic).

---

## Executive Summary

East Coast Labs has an **unusually strong strategic and engineering foundation** — a fast headless storefront, genuine offer architecture (tiers, stacks, reward ladder, order bumps), a real trust asset (published JanoShik COAs), and a 72-email lifecycle map that beats most live programs. But profits are currently capped by four structural problems:

1. **The business is flying blind.** GA4 and Klaviyo IDs are unset; `trackPurchase` is defined but never called; `BASELINE.md` is 100% placeholder. There is no measured revenue, CVR, AOV, or repeat rate. **Nothing can be optimized until this is fixed.**
2. **Trust leaks contradict the brand's entire positioning.** The store sells "proof, not promises" while displaying sample/fake reviews, a cosmetic Subscribe & Save that doesn't recur, a placeholder ABN, and zero policy pages — on a bank-transfer-only checkout. These actively suppress conversion and carry Australian Consumer Law exposure.
3. **Payments are the funnel's biggest structural friction.** PayID/bank transfer with a 24–48h hold means zero impulse purchases, no Apple/Google Pay, no BNPL. Every other optimization multiplies against this bottleneck.
4. **The retention engine is built but switched off.** Emails dead-end in a Supabase table; Klaviyo is load-only. Lifecycle revenue (typically 25–40% of ecom revenue) is currently $0.

The plan below is sequenced by **profit impact per unit of effort**, with Phase 0 (measurement + trust-stop-bleeding) gating everything else.

---

## Part 1 — Audit Findings

### 1.1 Measurement & Analytics — 🔴 CRITICAL

| Finding | Evidence | Impact |
|---|---|---|
| `trackPurchase` never called | `storefront/lib/analytics.ts:70`, no caller on thank-you page | The single most important event is untracked. No revenue attribution, no ROAS, no funnel math. |
| GA4 + Klaviyo IDs empty | `storefront/.env.local` (`NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_KLAVIYO_ID` unset) | Analytics render nothing in production. The entire A/B test infra (variant cookie, event params) is inert. |
| No Meta/TikTok pixel | grep across repo | Paid social would be 100% blind (though category ads are banned on Meta/TikTok anyway — lower priority). |
| No business baseline | `BASELINE.md` — every value `[PLACEHOLDER]`; `TESTS.md` assumes <500 orders/mo, ~1.5% CVR (assumed, not measured) | No way to know if any change helps or hurts. |
| Email capture dead-ends | `/api/subscribe` → Supabase `subscribers` only; comment: "A future ESP forward — Klaviyo — slots in right here" | The entire Klaviyo copy deck (`docs/KLAVIYO_COPY_DECK.md`) is unwired. |
| Margin data exists but unused | `lib/admin/costs.ts` — COGS snapshots, per-unit margin % | Good: profit reporting is possible today. Nothing rolls it up into decisions. |

### 1.2 Trust Layer — 🔴 CRITICAL (this category *is* the product)

The brand's only differentiation is verifiable proof. Anything fake or missing is disproportionately damaging:

| Finding | Evidence | Impact |
|---|---|---|
| **Sample/fake reviews rendered live** | `storefront/data/reviews.json` (`"sample": true`, e.g. BPC-157 "4.9, 214 reviews"); real Woo base = 2 reviews total | Fabricated reviews are the exact scam signal this audience hunts for. ACL s29 exposure (false testimonials). The doc's own note says swap before go-live. |
| **Fake Subscribe & Save** | `components/BuyBox.tsx` promises "Skip, pause, or cancel anytime"; `lib/checkout.ts` applies a flat 10% regex-detected discount; no recurrence exists (impossible with manual bank transfer) | Misleading functionality claim. ACL risk + chargeback-equivalent trust damage when customers discover it. |
| **"ABN: [PENDING]" placeholder** | `app/(store)/about/page.tsx`, Footer support column | A store asking for bank transfers displaying a missing ABN is a conversion killer for due-diligence buyers. |
| **No policy pages** | No Shipping, Returns, Privacy, Terms, or Contact page (mailto only) | For a bank-transfer store these are the pages skeptical buyers check *first*. |
| **[OWNER INPUT] placeholders in About copy** | `docs/ABOUT_PAGE_COPY.md` — founder story, origin, ABN never filled | The trust story is half-written. |
| Permanent fake-sale anchoring | All 15 SKUs perpetually `on_sale` ~17–20% off a never-charged `regular_price` | Weakens the anchor, blocks future real promos, and was/now pricing without a genuine "was" period is ACL-suspect. |
| Review submission path absent | Admin moderation exists; no buyer-facing submit flow | Real reviews can never accumulate — the fake ones can never be legitimately replaced. |
| Payment-failed / unpaid orders | Well-engineered (reminder/expiry emails, `/pay/[id]` self-confirm) — this is a genuine strength | Keep. It's the best part of the current funnel. |

**Genuine trust strengths to preserve and amplify:** Lab Results page (per-batch COA table + verify-at-lab links + batch lookup), falsifiable purity guarantee ("we cover the cost of the test"), 14 real education guides, discreet billing microcopy, verified-buyer badge system in `ReviewSection`.

### 1.3 Conversion Rate (CVR) — 🟠 HIGH

**Working well:** preselected 3-pack with anchoring, sticky ATC, cart drawer with two-rung reward ladder, exit-intent capture, A/B infra (control vs `/1` dossier variant), server-side re-pricing, RUO-compliant copy discipline.

**Gaps, ranked by expected CVR impact:**

1. **Payments friction** (see 1.4) — dwarfs everything else.
2. **No testimonials on control homepage** — `/1` has a `Testimony` section with real reviews; control doesn't. (Once reviews are real, port it.)
3. **No scarcity/urgency anywhere** — no live stock count, no batch-size framing ("this batch: 200 vials, COA #X"). Note: brand copy rules ban *fake* scarcity — but real batch sizes are authentic, on-brand scarcity.
4. **PLP has no sort/pagination/price filters** (`getProducts(20)` hard cap); search exists only on `/shop`, not in the header.
5. **No delivery-date estimate on PDP** ("1-business-day dispatch" only). "Order in the next 3h 12m → ships today → arrives Thu" is a proven CVR lever and fully factual here.
6. **Exit-intent "once per session" is actually once-forever** (localStorage never expires) — losing repeat capture.
7. **Checkout summary hides per-line prices**; no discount field in cart (checkout only); cart has no shipping estimate.
8. **No review photos, no Q&A, no COA image in product gallery.**
9. **Inconsistent discount codes:** WELCOME10 (exit-intent modal) vs WELCOME15 (copy decks); abandoned-cart email 3 subject says "10%" but body references WELCOME15. Pick one (recommend WELCOME10 — exit-intent + WELCOME15 in welcome flow is fine, but every surface must match its code).
10. Minor: sitemap includes `/cart` while robots disallows it; skip-link absent; emoji-as-icons.

### 1.4 Payments — 🔴 STRUCTURAL BOTTLENECK

PayID/bank transfer only (`lib/payments.ts`: card processors won't take the category). Consequences: no instant gratification, no mobile wallets, no BNPL, every order requires the buyer to leave the site, open their banking app, and manually transfer — with a 24h hold and 48h expiry. Industry data puts manual-transfer completion well below instant-card completion; the gap is almost certainly the store's largest single revenue leak.

**The unpaid-order lifecycle is already excellent** (reminders, expiry, self-confirming pay page, abandoned-cart capture on email blur) — it mitigates but cannot eliminate the friction.

**Options, in priority order:**
1. **Azupay / PayID-to-PayID real-time confirmation** (noted as gated in code) — removes the "did they pay?" lag, enables instant order confirmation.
2. **High-risk-tolerant gateways:** retry Bankful (the original plan), or evaluate others that accept RUO peptide merchants (e.g. offshore high-risk processors, Pin Payments/Stripe high-risk review, crypto via a compliant AU on-ramp).
3. **BNPL-adjacent:** even if cards are impossible, any instant-confirmation rail (PayTo agreements — note PayTo also unlocks *real* subscriptions) is a double win.
4. Optimize what exists: shorter first reminder (1h), SMS reminder option, one-tap PayID deep link from `/pay/[id]` (PayID URI on mobile auto-fills payee + amount + reference — large completion lift, near-zero cost).

### 1.5 Average Order Value (AOV) — 🟡 STRONG FOUNDATION, UNDEREXPLOITED

**Already deployed (unusually complete):** 1/3/6-pack tiers (−15%/−25%, 3-pack preselected), 4 curated stacks (15–20% off + free bac water), cart accessory upsells, checkout order bump, $150 free-shipping / $250 gift / $400 free-express ladder, curated cross-sell map.

**Remaining levers, ranked:**

1. **Make the reward ladder omnipresent.** The progress bar lives in the cart; add a compact version to the PDP ("Add the 3-pack → free shipping + $19.99 bac water free") — most AOV decisions happen on the PDP, not the cart.
2. **Fix the express rung visibility** — the $400 free-express tier only surfaces at checkout; put it in the progress bar.
3. **Post-purchase upsell.** After payment confirmation (or on the thank-you page for unpaid orders): "Add syringes/swabs to this order before it ships — one tap, no second shipping fee." This works even with manual payments (amend-unpaid-order is easy since nothing is captured yet).
4. **Complete-the-stack logic in cart:** if cart contains BPC-157 but not TB-500, surface the Recovery Stack delta-price ("upgrade to the stack for $X more") instead of a generic accessory.
5. **6-pack default test** is already specced in `TESTS.md` — run it once measurement is live.
6. **Volume pricing beyond 6** (10-pack "lab pack") for the highest-AOV buyers — cheap to test via the existing tier system.
7. **Gift cards** (bank-transfer store: gift cards are just prepaid credit; easy with the discounts table).
8. **Loyalty/points** — defer until LTV engine runs; premature now.

### 1.6 Retention / LTV — 🔴 BUILT BUT OFF

The strategy layer is best-in-class (`docs/EMAIL_LIFECYCLE_MAP.md`: 72 emails mapped, 16 built ≈ 22% coverage, with correct prioritization already done). The execution layer is disconnected. **This is the cheapest large profit pool available.**

**Phase A — turn on what exists (highest ROI in this entire document):**
1. Wire `/api/subscribe` → Klaviyo (the code comment literally marks the slot).
2. Set `NEXT_PUBLIC_KLAVIYO_ID`; load the on-site script for forms/tracking.
3. Activate the flows whose copy is already written: Welcome (3), Abandoned Cart (3), Post-Purchase (4 incl. day-14 review request), Replenishment (3), Winback (2).

**Phase B — the lifecycle map's own Tier-1 gaps:**
1. **Second-purchase nudge at day 30** ("the LTV hinge" — repurchase rate from 1st→2nd order is the strongest predictor of LTV).
2. **Payment-failed recovery** ("pure found money" — partially covered by existing reminder emails; move into Klaviyo for proper sequencing).
3. **Back-in-stock flow** — waitlist already collected in Supabase; template exists; needs the trigger.
4. **Welcome-code expiry reminder.**
5. **Review-request enforcement** — this also feeds the fake-review fix (1.2).

**Phase C — differentiators:**
- **"New batch published for a product you bought" (5.6)** — no competitor can copy this; it turns the COA moat into a retention trigger.
- Browse abandonment, split cart vs checkout abandonment, replenishment second touch, VIP tiers, referral program.

### 1.7 Margin & Pricing — 🟡

- COGS tracking and per-unit margin reporting exist in admin — good.
- **Fix SKU/slug drift before scaling:** two SKU systems (`ECL-TES-10` vs `ECL-TESA`), `igf` vs `igf-1-lr3` patched with hardcoded aliases in two libs (a third consumer forgetting the alias silently breaks cross-sells), "GHK-cu"/"IGF" naming inconsistencies. One canonical SKU map, one migration.
- **Accessories are pure-margin basket builders** — expand the range (alcohol prep + sharps + travel cases); every attach is near-100% margin.
- **Re-anchor pricing honestly:** convert the permanent fake sale into real list prices, then run genuine promos (launch promos, batch-clearance promos for short-dated stock). Restores promo elasticity + ACL safety.
- **Shipping margin:** $12 flat standard is simple and fine; test $130 threshold vs $150 (already specced in TESTS.md).

### 1.8 Traffic / SEO — 🟢 ON TRACK (not the bottleneck)

14 guides, JSON-LD, sitemap, per-page metadata, Article schema, a lead-magnet-ready COA guide. Given the ad bans in this category, SEO + email + community reputation are the right channels and the plan already reflects this. Priorities: internal-link guides → PDPs harder, publish batch-COA content as indexable pages, and measure organic CVR once analytics are on. **Do not invest further here until Phases 0–2 are done.**

---

## Part 2 — Profit Maximization Plan

Profit = Traffic × CVR × AOV × Purchase Frequency × Margin. The sequence below attacks the multipliers in the order where each dollar of effort returns the most — and where earlier phases unblock later ones.

### Phase 0 — Instrument Everything (Week 1) 🔴 GATE
*You cannot maximize what you cannot measure. Every later phase depends on this.*

| # | Action | Effort | File(s) |
|---|---|---|---|
| 0.1 | Call `trackPurchase` on thank-you page + wire purchase into Klaviyo | 1h | `app/(store)/checkout/thank-you/page.tsx` |
| 0.2 | Set `NEXT_PUBLIC_GA4_ID` + `NEXT_PUBLIC_KLAVIYO_ID` in Vercel env | 15m | Vercel dashboard |
| 0.3 | Verify full event chain in GA4 DebugView: view_item → add_to_cart → begin_checkout → purchase, with variant param | 2h | — |
| 0.4 | Backfill `BASELINE.md` from Supabase (orders, revenue, AOV, CVR, repeat rate, per-SKU) | 2h | `BASELINE.md` |
| 0.5 | Stand up a weekly profit dashboard (admin already has margin data): revenue, AOV, CVR, paid-rate of orders, contribution margin/order | 4h | `lib/admin/costs.ts` |
| 0.6 | Fix sitemap `/cart` contradiction | 5m | `app/sitemap.ts` |

### Phase 1 — Stop the Trust Bleeding (Week 1–2) 🔴
*Cheap, fast, and directly conversion-critical for this specific audience.*

| # | Action | Effort |
|---|---|---|
| 1.1 | **Remove sample reviews from rendering** until real ones exist (show "No reviews yet — be the first" + submit CTA). Fabricated reviews are an ACL violation and an anti-signal. | 1h |
| 1.2 | **Build the buyer review-submission flow** (post-delivery day-14 email → submit form → admin moderation). Admin side already exists. | 1 day |
| 1.3 | **Fix Subscribe & Save honestly:** either (a) relabel as "Restock reminder — 10% off, we email you when it's time" (true today), or (b) implement real recurrence via PayTo. (a) now, (b) in Phase 3. | 2h |
| 1.4 | **Fill the ABN** in About + Footer; complete all `[OWNER INPUT]` placeholders in `docs/ABOUT_PAGE_COPY.md` (owner task). | 1h |
| 1.5 | **Publish policy pages:** Shipping, Returns, Privacy, Terms, Contact (form → support inbox). | 1 day |
| 1.6 | Normalize discount codes (WELCOME10 vs WELCOME15) and fix abandoned-cart E3 subject/body mismatch. | 1h |
| 1.7 | Replace permanent fake-sale anchoring with real list prices (prepares genuine promo capability). | 2h + data change |

### Phase 2 — Payments Friction (Week 2–4) 🔴 BIGGEST REVENUE LEVER
| # | Action | Effort | Expected impact |
|---|---|---|---|
| 2.1 | **PayID deep link on `/pay/[id]`** — one-tap mobile pay with payee/amount/reference pre-filled | 4h | Immediate lift on paid-rate of unpaid orders |
| 2.2 | Tighten reminder cadence: first reminder at 1h (not later), add optional SMS | 4h | Higher 24h completion |
| 2.3 | Pursue real-time rails: Azupay (unblock the gate), PayTo, or a high-risk gateway (retry Bankful; shortlist 2 alternatives). Owner-driven commercial task. | Days–weeks | Largest single CVR unlock; PayTo also enables true subscriptions |
| 2.4 | Measure paid-rate by hour-to-payment as the Phase 2 KPI | (from 0.5) | — |

### Phase 3 — CVR Quick Wins (Week 3–5) 🟠
| # | Action | Effort |
|---|---|---|
| 3.1 | Real batch scarcity: "Batch #X — 200 vials, COA verified 12 Jul" on PDP (authentic, on-brand) | 4h |
| 3.2 | Delivery estimate: "Order within Nh → ships today → est. arrival [day]" on PDP + cart | 4h |
| 3.3 | Port testimonial section to control homepage once real reviews ≥ ~10 | 2h |
| 3.4 | Header/site-wide search; PLP sort (price, bestseller, rating) | 1 day |
| 3.5 | Fix exit-intent expiry (30-day cooldown, not forever); add discount field to cart; show per-line prices in checkout summary | 4h |
| 3.6 | Add COA image to PDP gallery; enable review photos | 4h |
| 3.7 | Dead-code cleanup: remove Woo cart sync from `cart-context.tsx` | 1h |

### Phase 4 — Switch On the LTV Engine (Week 3–6, parallel) 🔴 CHEAPEST PROFIT POOL
| # | Action | Effort |
|---|---|---|
| 4.1 | Klaviyo integration at the marked slot in `/api/subscribe`; sync `subscribers` + `stock_notifications`; map order events | 1 day |
| 4.2 | Activate written flows: Welcome, Abandoned Cart, Post-Purchase, Replenishment, Winback | 1–2 days (copy exists) |
| 4.3 | Tier-1 gaps: day-30 second-purchase nudge, code-expiry reminder, back-in-stock trigger, payment-failed sequence | 2 days |
| 4.4 | "New batch published for a product you bought" trigger — the unique weapon | 1 day |
| 4.5 | Then Tier-2: browse abandonment, cart/checkout split, replenishment 2nd touch, VIP/referral design | ongoing |

### Phase 5 — AOV Expansion (Week 5–8) 🟡
| # | Action | Effort |
|---|---|---|
| 5.1 | PDP reward-ladder strip ("3-pack → free shipping + free bac water") | 4h |
| 5.2 | Complete-the-stack delta-price module in cart | 1 day |
| 5.3 | Post-purchase/thank-you one-tap accessory add (amend unpaid order) | 1 day |
| 5.4 | Expose $400 free-express rung in progress bar | 1h |
| 5.5 | 10-pack "lab pack" tier on top-3 SKUs | 4h + data |
| 5.6 | Gift cards | 1 day |

### Phase 6 — Data Hygiene & Margin (Week 6–8) 🟡
| # | Action | Effort |
|---|---|---|
| 6.1 | Canonical SKU map + migration; delete `SLUG_ALIASES` hacks | 1 day |
| 6.2 | Expand accessories range (pure margin) | sourcing |
| 6.3 | Margin review per SKU from `costs.ts`; reprice or re-tier any SKU below target contribution margin | 2h + owner decision |
| 6.4 | Fix Woo-data residue (Tesamorelin stock/backorder contradiction, MT2 tag, bac-water category) if Woo remains a data source | 2h |

### Phase 7 — Disciplined Testing (Ongoing, starts after Phase 0)
Adopt `TESTS.md` protocol as written (one change, 2-week windows, proxy metrics at low volume). Ready queue: 6-pack default vs 3-pack · guarantee microcopy · free-ship $150 vs $130 · scarcity framing on/off · dossier variant `/1` vs control (infra already live — just needs GA4 on). At <500 orders/month, judge on proxy ladder (ATC rate, begin-checkout rate, paid-rate) per `VARIANT_SPLIT_TEST_PLAN.md`.

---

## Part 3 — 90-Day Target Model

*(All numbers relative — absolute baseline unknown until Phase 0.4.)*

| Lever | Mechanism | Conservative 90-day effect |
|---|---|---|
| Paid-rate of orders | PayID deep link, 1h reminder, real-time rails | +15–30% completed payments on existing checkout starts |
| CVR | Trust fixes (real reviews, ABN, policies, honest S&S) + Phase 3 | +10–20% |
| AOV | PDP ladder strip, stack completion, post-purchase add | +8–15% |
| Repeat rate | Klaviyo activation + day-30 nudge + replenishment | +15–30% |
| Margin | Accessories attach, re-anchoring, SKU repricing | +2–5 pts |

Compounded on the existing base, this is a plausible **1.5–2.5× profit trajectory within 90 days**, dominated by Phases 2 and 4. The compounding is why sequencing matters: measurement (0) makes everything visible; trust (1) and payments (2) fix the leaks in the bucket; LTV (4) and AOV (5) fill it faster.

## Immediate Next Actions (this week)

1. **Owner:** provide ABN, founder story, confirm WELCOME10 vs WELCOME15, and re-engage a payment rail provider (Azupay/PayTo/gateway).
2. Set GA4 + Klaviyo env vars; wire `trackPurchase`; backfill `BASELINE.md`.
3. Pull sample reviews from rendering; ship review-submission flow.
4. Relabel Subscribe & Save to something true.
5. Build PayID deep link on `/pay/[id]`.

---

## Appendix — Compliance Watchlist (Australian Consumer Law)

- Fabricated/sample reviews displayed as real → s29 false testimonials. **Fix in Phase 1.1.**
- Permanent was/now pricing where "was" was never charged → misleading pricing. **Fix in 1.7.**
- "Skip, pause, cancel anytime" subscription claim with no subscription → misleading functionality. **Fix in 1.3.**
- RUO copy discipline is currently excellent — preserve it in all new modules (no dosing/benefit language, no "month supply").
