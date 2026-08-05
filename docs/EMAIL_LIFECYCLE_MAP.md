# East Coast Labs — Complete Email Lifecycle Map

> Every email a customer could receive, mapped to lifecycle stage, trigger, timing, and goal.
> Status legend: ✅ built (copy deck + trigger defined) · 🟡 partial (transactional template exists, no flow) · ⬜ gap
>
> Sources of truth today:
> - Flow copy: [KLAVIYO_COPY_DECK.md](../storefront/content/KLAVIYO_COPY_DECK.md)
> - Transactional templates: [templates.ts](../storefront/lib/email/templates.ts) (Resend, outbox-drained)

---

## Part 1 — Principles (the ones that actually move revenue)

These are the operating rules. Everything in Part 2 should be checked against them.

**1. Flows > campaigns.** Automated flows are typically <5% of send volume but 30–40% of email revenue. Build every flow before you optimise a single broadcast. Campaigns are for news; flows are for money.

**2. One email = one job.** Every email has exactly one primary action. If a customer has to decide between three CTAs, they decide nothing. Secondary links are allowed; secondary *goals* are not.

**3. Trigger on behaviour, not on the calendar.** "Send Tuesday 10am" is a campaign. "Send 1 hour after they added to cart and didn't check out" is revenue. Behavioural triggers convert 3–8× better because the intent is already there.

**4. The first 60 minutes are worth more than the next 60 days.** Cart recovery at +1h converts dramatically better than +24h. Welcome email at +0 minutes outperforms +1 day. Speed is a conversion lever you get for free.

**5. Segment by value, then by behaviour.** A 6-pack repeat buyer and a first-time 1-vial buyer should never get the same replenishment timing, the same discount, or the same tone. Your existing 3-variant replenishment split is exactly right — extend that thinking everywhere.

**6. Never discount by default.** Discount is the last lever, not the first. Sequence: *reminder → objection handling → social proof/trust → scarcity → discount*. If email 1 in the cart flow carries a code, you've taught the list to abandon carts on purpose. Your current cart flow does this correctly — hold the line.

**7. Plain-text-leaning beats heavy HTML for trust categories.** Peptides, supplements, and anything where the buyer is doing due diligence: image-heavy "brand" emails read like marketing. Simple, typed, signed emails read like a person. Your copy deck's format is right for the category.

**8. Deliverability is a growth channel.** Authenticate (SPF/DKIM/DMARC), send from a subdomain, warm it, and sunset unengaged profiles ruthlessly. A 20k list where 6k open beats a 50k list where 6k open — same revenue, better inbox placement, lower cost.

**9. Suppression logic is as important as the copy.** The fastest way to destroy trust is a "you left something in your cart" email sent 20 minutes after they bought it. Global exclusion rules (Part 3) are non-negotiable infrastructure.

**10. Transactional emails are your highest-open real estate.** Order confirmations open at 50–70%. That's 5–10× a campaign. A confirmation email that is *only* a receipt is wasted inventory — add the COA link, the verification walkthrough, the referral ask.

**11. Preference over unsubscribe.** Always offer "fewer emails" or "only restocks" before the unsubscribe. You keep the address, they keep control.

**12. Measure revenue per recipient (RPR), not open rate.** Since Apple MPP, open rate is directional noise. RPR and placed-order rate per flow are the only numbers that decide what to build next.

**Category guardrail for ECL:** every email is research-use-only framing. Logistics, purity, COA verification, batch results, restocking, pricing. Never usage, effects, dosing, protocols, benefits, or before/after. This constrains — and simplifies — the entire map: your differentiation angle is *proof*, not *outcome*.

---

## Part 2 — The Map

### Stage 0 — Pre-purchase / list acquisition

| # | Email | Trigger | Timing | Goal | Status |
|---|-------|---------|--------|------|--------|
| 0.1 | Popup opt-in confirmation (code delivery) | Popup submit | Immediate | Deliver code, set expectation | ✅ |
| 0.2 | Double opt-in confirm | List subscribe (if DOI on) | Immediate | Deliverability hygiene | ⬜ |
| 0.3 | Back-in-stock alert | Product restocked + waitlist signup | Immediate | Convert waiting demand | 🟡 template exists, no flow |
| 0.4 | Price-drop / new-batch alert | Batch published or price change on watched item | Immediate | Reactivate browsers | ⬜ |
| 0.5 | New product launch announcement | New SKU listed | Manual/campaign | Introduce compound + COA | ⬜ |
| 0.6 | Lead magnet delivery (e.g. "How to read a COA" guide) | Guide download | Immediate | Trust-first list building for non-buyers | ⬜ |

> **0.3 is the highest-value gap in this stage.** Back-in-stock is consistently one of the top-3 RPR flows in ecommerce because it's 100% intent. You already have the template — it just needs the waitlist capture + trigger.

---

### Stage 1 — Welcome / nurture (subscriber, not yet bought)

| # | Email | Trigger | Timing | Goal | Status |
|---|-------|---------|--------|------|--------|
| 1.1 | Welcome + 15% code + differentiation | Subscribed to list | Immediate | Deliver value, state the difference | ✅ |
| 1.2 | COA verification walkthrough | ↑ | +2 days | Handle the #1 objection (is it real?) | ✅ |
| 1.3 | Bestsellers + per-vial pricing | ↑ | +4 days | Product education, price framing | ✅ |
| 1.4 | Founder/brand story — why we publish results | ↑ | +7 days | Trust deepening, non-promotional | ⬜ |
| 1.5 | Social proof / independent verification round-up | ↑ | +10 days | Third-party credibility | ⬜ |
| 1.6 | Code expiry reminder ("your 15% expires in 48h") | ↑, no purchase | +12 days | Deadline-driven conversion | ⬜ |
| 1.7 | Soft exit — "not ready? here's what to watch" | ↑, no purchase | +16 days | Move to low-frequency segment, avoid unsub | ⬜ |

> **1.6 is the single cheapest win in this list.** An expiry reminder on an already-issued code routinely converts 15–30% of a welcome flow's total revenue. One email, no new offer, no new asset.

---

### Stage 2 — Browse & cart recovery (highest RPR band)

| # | Email | Trigger | Timing | Goal | Status |
|---|-------|---------|--------|------|--------|
| 2.1 | Browse abandonment | Viewed product ≥2× or ≥60s, no add-to-cart | +4 hours | Catch upper-funnel intent | ⬜ |
| 2.2 | Category/collection abandonment | Viewed collection, no product view | +12 hours | Guide undecided shoppers | ⬜ |
| 2.3 | Abandoned cart 1 — reminder, no discount | Added to cart, no checkout start | +1 hour | Frictionless return | ✅ |
| 2.4 | Abandoned cart 2 — objection handling (COA, purity guarantee) | ↑ | +24 hours | Kill the trust objection | ✅ |
| 2.5 | Abandoned cart 3 — final / scarcity or light incentive | ↑ | +72 hours | Last call | ✅ |
| 2.6 | Abandoned **checkout** 1 (started checkout, higher intent) | Checkout started, not completed | +30–60 min | Recover near-miss orders | ⬜ separate from cart |
| 2.7 | Abandoned checkout 2 | ↑ | +24 hours | Second chance | ⬜ |
| 2.8 | Payment failed / declined card | Payment error at checkout | +15 min | Recover a lost sale that *tried* to happen | ⬜ |
| 2.9 | Cart expiry / stock warning | Cart item low stock | +6 hours | Genuine scarcity only | ⬜ |

> **Cart ≠ checkout.** Right now the flow treats them as one event. Someone who entered shipping details and bailed is a materially hotter lead than someone who clicked "add to cart" — they deserve a faster, shorter, different email. Splitting 2.3 and 2.6 is a standard Shopify-side uplift.
>
> **2.8 (payment failed) is pure found money** — the customer already decided to buy. Typical recovery rates are high because there's no objection left to handle, just a mechanical failure.

---

### Stage 3 — Transactional (highest open rates on the list)

| # | Email | Trigger | Timing | Goal | Status |
|---|-------|---------|--------|------|--------|
| 3.1 | Order confirmation / receipt | Order placed | Immediate | Confirm + reassure + set delivery expectation | ✅ |
| 3.2 | Payment receipt / invoice (if separate) | Payment captured | Immediate | Compliance / records | 🟡 |
| 3.3 | Order processing / packed | Status → processing | On event | Reduce "where is it?" tickets | ⬜ |
| 3.4 | Shipped + tracking | Fulfillment created | Immediate | Tracking + COA link | ✅ |
| 3.5 | Out for delivery | Carrier webhook | On event | Anticipation, reduce failed delivery | ⬜ |
| 3.6 | Delivered confirmation | Carrier webhook | On event | Close the loop, prompt inspection | ⬜ |
| 3.7 | Delivery exception / delayed | Carrier exception | On event | Pre-empt the complaint | ⬜ |
| 3.8 | Refund processed | Refund issued | Immediate | Trust maintenance | 🟡 template exists |
| 3.9 | Order cancelled | Cancellation | Immediate | Clarity | ⬜ |
| 3.10 | Address confirmation / correction request | Invalid address flagged | Immediate | Prevent failed delivery | ⬜ |
| 3.11 | Account created / password reset | Account event | Immediate | Access | ⬜ |

> **3.5–3.7 (carrier lifecycle) are support-cost reducers more than revenue drivers**, but for a dispatch-from-Australia brand where the buyer is anxious about the parcel, they materially lift repeat-purchase rate. "Where is my order?" is the #1 support ticket in every ecommerce business.

---

### Stage 4 — Post-purchase / onboarding (turns a buyer into a customer)

| # | Email | Trigger | Timing | Goal | Status |
|---|-------|---------|--------|------|--------|
| 4.1 | Thank you + what happens next | Order placed | +1 hour | Reduce buyer's remorse | ⬜ (partly in 3.1) |
| 4.2 | COA verification walkthrough | Fulfilled | +2 days | Deliver on the core promise | ✅ |
| 4.3 | "Did it arrive OK?" check-in | Fulfilled | +5 days | Catch problems before reviews | ⬜ |
| 4.4 | Review / testimonial request | Fulfilled | +14 days | Social proof engine | ✅ |
| 4.5 | Review reminder (non-responders) | ↑, no review | +21 days | Doubles review volume | ⬜ |
| 4.6 | Post-review thank you + referral ask | Review submitted | +1 day | Convert goodwill into referral | ⬜ |
| 4.7 | Cross-sell — complementary items | Fulfilled | +10 days | AOV expansion | ⬜ |
| 4.8 | Upsell to pack pricing ("you bought 1, here's 3-pack math") | Fulfilled, 1-vial buyer | +7 days | Move to higher LTV tier | ⬜ |
| 4.9 | First-order-only: how we publish batch results | First order fulfilled | +3 days | Onboarding, differentiation | ⬜ |
| 4.10 | Second-purchase nudge (the critical conversion) | 1 order, none since | +30 days | 1→2 orders is the LTV hinge | ⬜ |

> **4.10 is the most under-built email in ecommerce.** The probability a customer buys a third time after buying twice is roughly double the probability they buy a second time after buying once. Every dollar spent moving order 1 → order 2 compounds.
>
> **4.8 is nearly free margin** for you specifically — you already have per-vial pack pricing as a differentiator; this email just does the arithmetic for a 1-vial buyer.

---

### Stage 5 — Retention / replenishment

| # | Email | Trigger | Timing | Goal | Status |
|---|-------|---------|--------|------|--------|
| 5.1 | Replenishment — 1-vial buyer | Fulfilled, 1-vial variant | +3 weeks | Reorder at consumption point | ✅ |
| 5.2 | Replenishment — 3-pack buyer | ↑ 3-pack | +10 weeks | ↑ | ✅ |
| 5.3 | Replenishment — 6-pack buyer | ↑ 6-pack | +22 weeks | ↑ | ✅ |
| 5.4 | Replenishment reminder 2 (non-responders) | ↑, no reorder | +1 week after 5.x | Second touch lifts reorder ~40% | ⬜ |
| 5.5 | Replenishment + upgrade offer (step up a pack size) | ↑, no reorder | +2 weeks after 5.x | Increase order value on reorder | ⬜ |
| 5.6 | New batch published for a product you bought | Batch result published | On event | Reinforces the proof loop, drives reorder | ⬜ |
| 5.7 | Restock alert for previously purchased item | Item back in stock, prior buyer | Immediate | Highest-intent audience for a restock | ⬜ |
| 5.8 | Loyalty / VIP tier reached | LTV or order-count threshold | On event | Recognition drives retention | ⬜ |
| 5.9 | VIP early access (new batch/compound) | VIP segment | Before public launch | Exclusivity without discounting | ⬜ |
| 5.10 | Subscription started / renewal reminder / failed payment | Subscription events | Various | Only if you add subscriptions | ⬜ future |

> **5.6 is your unique weapon.** Nobody else in this category can send "a new independently tested batch of the compound you bought has been published." It's a retention email that is *simultaneously* a trust email and needs zero discount. Build this one.

---

### Stage 6 — Reactivation / winback (lapsed customers)

| # | Email | Trigger | Timing | Goal | Status |
|---|-------|---------|--------|------|--------|
| 6.1 | Winback 1 — what's new, no offer | Last order +60 days | Day 60 | Re-engage on value | ✅ |
| 6.2 | Winback 2 — 10% off (RESTOCK10) | Last order +90 days | Day 90 | Incentivised return | ✅ |
| 6.3 | Winback 0 — "still comparing suppliers?" (pre-winback) | Last order +45 days | Day 45 | Catch them before they drift | ⬜ |
| 6.4 | Winback 3 — stronger offer / free shipping | Last order +120 days | Day 120 | Final commercial attempt | ⬜ |
| 6.5 | Winback 4 — "we'd rather hear why" (feedback ask, no sell) | Last order +150 days | Day 150 | Insight + occasional resurrection | ⬜ |
| 6.6 | Winback — personalised to last product purchased | Lapsed + product affinity | Varies | Relevance lifts winback 2–3× | ⬜ |
| 6.7 | Re-engagement for non-buyers (subscribed, never bought) | Subscribed 90d, 0 orders | Day 90 | Separate flow from customer winback | ⬜ |
| 6.8 | Sunset / last chance before removal | No open or click 180 days | Day 180 | Protect deliverability | ⬜ |
| 6.9 | Preference centre offer ("fewer emails?") | Low engagement | Before sunset | Retain the address, reduce unsubs | ⬜ |

> **Split 6.1/6.2 by lapse reason, not just lapse duration.** A customer who bought once and vanished needs a different email than a customer who bought six times then stopped — the second one is a *service recovery* problem, not a discount problem.
>
> **6.7 is currently missing entirely.** Subscribers who never bought are being treated with the same winback logic as customers. They have a different objection (trust, not satisfaction) and need a different flow.

---

### Stage 7 — Advocacy & community

| # | Email | Trigger | Timing | Goal | Status |
|---|-------|---------|--------|------|--------|
| 7.1 | Referral invite | 2+ orders, positive review | On event | Cheapest acquisition channel you have | ⬜ |
| 7.2 | Referral reward earned | Referral converts | Immediate | Reinforce the loop | ⬜ |
| 7.3 | UGC / verification-story request | Post-review | +7 days | Content asset generation | ⬜ |
| 7.4 | Anniversary — 1 year as a customer | First order +365d | Annual | Relationship, not transaction | ⬜ |
| 7.5 | Customer survey / NPS | Post-3rd order | On event | Product + service insight | ⬜ |

---

### Stage 8 — Operational / lifecycle hygiene

| # | Email | Trigger | Timing | Goal | Status |
|---|-------|---------|--------|------|--------|
| 8.1 | Preference centre / email frequency options | Manual link in footer | Always | Reduce unsubscribes | ⬜ |
| 8.2 | Unsubscribe confirmation | Unsub | Immediate | Compliance, clean exit | ⬜ |
| 8.3 | Re-permission / consent refresh | Annual, dormant profiles | Annual | Legal + deliverability | ⬜ |
| 8.4 | Privacy / terms update notice | Policy change | On event | Compliance | ⬜ |
| 8.5 | Service incident / shipping delay notice (broadcast) | Ops event | On event | Trust under pressure | ⬜ |

---

### Stage 9 — Campaigns (broadcast, not flows)

Not automations — these are the manual sends. Suggested rhythm: **1 value email + 1 commercial email per fortnight**, scaled up only if engagement holds.

| Type | Angle | Frequency |
|------|-------|-----------|
| New batch results published | Proof-driven, non-promotional | Monthly |
| New compound / SKU launch | Introduce + COA | Per launch |
| Restock round-up | "Back in stock this week" | As needed |
| Educational — how to read a COA, what JanoShik tests | Trust, zero sell | Monthly |
| Pack pricing / per-vial value reminder | Commercial | Monthly |
| Seasonal / EOFY / promotional | Commercial | 3–4×/year |
| Behind the scenes — testing process, dispatch | Brand | Quarterly |
| Policy / guarantee explainer | Trust | Quarterly |

---

## Part 3 — Global suppression & sequencing rules

Non-negotiable. These prevent the credibility-destroying sends.

1. **Purchase suppresses everything commercial.** Any order placed immediately exits cart, browse, checkout, winback, and replenishment flows.
2. **Never more than one flow email per customer per 24 hours.** Set flow priority: transactional > checkout recovery > cart recovery > browse > welcome > replenishment > winback > campaigns.
3. **Suppress campaign sends to anyone actively inside cart/checkout recovery.** Don't interrupt a conversion sequence with a newsletter.
4. **Suppress recent purchasers (7 days) from all promotional campaigns.** Nothing sours a new customer faster than a better discount 48 hours later.
5. **One review request per order, ever.** Track at order level, not customer level.
6. **Winback exits on any site session, not just on purchase.** If they came back, stop chasing.
7. **Sunset before you send.** Anyone with zero engagement in 180 days is excluded from campaigns and routed to 6.8.
8. **Discount ladder is one-directional.** Never send a 10% code to someone who already holds a 15% code. Track issued codes per profile.
9. **Global quiet hours + timezone send** for anything non-transactional.
10. **Every flow needs an explicit exit condition and a max-send cap.** Unbounded flows are how lists get burnt.

---

## Part 4 — Build priority

Ordered by expected revenue per unit of effort, given what already exists.

**Tier 1 — build next (highest return, lowest effort):**
1. `1.6` Welcome code expiry reminder — one email, existing offer
2. `2.8` Payment-failed recovery — pure recovered revenue
3. `0.3` Back-in-stock flow — template exists, needs waitlist + trigger
4. `4.10` Second-purchase nudge (day 30) — the LTV hinge
5. `4.5` Review reminder — roughly doubles review volume

**Tier 2 — high value, moderate effort:**
6. `2.6/2.7` Split abandoned checkout from abandoned cart
7. `5.6` "New batch published for a product you bought" — your unique retention asset
8. `4.8` 1-vial → pack-pricing upsell
9. `5.4` Replenishment second touch
10. `6.7` Non-buyer re-engagement (separate from customer winback)

**Tier 3 — infrastructure & hygiene:**
11. `3.5–3.7` Carrier lifecycle emails (delivered / out for delivery / exception)
12. `8.1` Preference centre + `6.8` sunset flow
13. `2.1` Browse abandonment
14. `6.3–6.5` Extended winback ladder

**Tier 4 — growth layer:**
15. `7.1/7.2` Referral programme
16. `5.8/5.9` VIP tiering and early access
17. `0.6` Lead magnet ("How to read a COA") for non-buyer list building

---

## Part 5 — Current coverage summary

| Stage | Built | Total mapped | Coverage |
|-------|-------|--------------|----------|
| 0 — Pre-purchase | 1 (+1 partial) | 6 | ~25% |
| 1 — Welcome | 3 | 7 | 43% |
| 2 — Cart & browse | 3 | 9 | 33% |
| 3 — Transactional | 2 (+2 partial) | 11 | ~27% |
| 4 — Post-purchase | 2 | 10 | 20% |
| 5 — Retention | 3 | 10 | 30% |
| 6 — Reactivation | 2 | 9 | 22% |
| 7 — Advocacy | 0 | 5 | 0% |
| 8 — Operational | 0 | 5 | 0% |
| **Total** | **16** | **72** | **~22%** |

The foundation is solid — the five core flows exist and the copy is compliance-clean. The gap is depth within flows (second touches, reminders, non-responder branches) and the entire advocacy + hygiene layer.

---

*Benchmarks cited are industry ranges from Klaviyo/Shopify published data and should be validated against ECL's own flow performance once each flow has run 30+ days.*
