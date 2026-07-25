# East Coast Labs — `/1` Front-Page Variant & Split-Test Plan

> Status: **PLAN — awaiting approval. No code has been changed.**
> Scope: Next.js storefront (Vercel) only. The legacy Woo site on Hostinger (.com.au) is untouched.
> Reference model: renuebyscience.com (live teardown performed 2026-07-25).

---

## Executive Summary

**The hypothesis being tested:** a light, clinical, trust-first design (Renue By Science style) converts research-peptide buyers better than the current dark "premium-tech" theme — because this audience buys on *verifiable credibility* (published COAs, real reviews, independent testing), and light clinical design is the visual language of credibility in supplements/lab products.

**The five biggest levers this plan pulls:**

1. **Re-light existing proof.** ECL already has Renue's trust engine wired — `getLatestCoa()` batch data, JanoShik independent testing, `data/reviews.json` aggregates — but presents it in a dark theme that reads "crypto/gaming" more than "laboratory." The variant is largely a re-presentation of proof you already ship.
2. **Same funnel past the landing.** `/1` shares the cart context, product pages, and checkout. The test isolates *design*, not funnel mechanics — otherwise results are uninterpretable.
3. **Two-layer traffic split.** Layer 1 (launch): drive ads directly to `/` and `/1` with UTMs. Layer 2 (optional, later): middleware 50/50 cookie split for organic traffic.
4. **Variant-tagged analytics.** One `ecl_variant` cookie + a `variant` param on the existing GA4 commerce events makes every purchase attributable to its landing design.
5. **Honest measurement.** A low-traffic store cannot power a purchase-rate test quickly. The framework includes a proxy-metric ladder (add-to-cart → begin-checkout → purchase) so you get directional answers in weeks, not quarters.

**Build estimate:** one focused session (E3/E4) for Phases 1–3; Phase 4 (middleware auto-split) optional +1–2 hrs.

---

## 1. What the teardowns found

### Current storefront (facts the plan is grounded in)

- Home is `storefront/app/(store)/page.tsx` — server component composing: inline hero → `CoaStrip` → bestsellers (`ProductCard` grid, hardcoded `BESTSELLER_SLUGS`) → collection tiles → `StackCard`s → testing steps → `TrustRow` → `GuaranteeBand` → restock promo → `Faq` (+ FAQPage JSON-LD).
- Design system is entirely in `app/globals.css` (Tailwind v4 `@theme`): dark tokens — bg `--color-ink #080b10`, surface `#121821`, text `#e7ebf2`, accent teal `#2fd4c8`. System fonts only; no component library (buttons/cards are inline class patterns).
- `middleware.ts` matches **only** `/admin/:path*` (Supabase session refresh + login redirect). The public storefront is a clean slate for split routing.
- Analytics is hand-rolled and env-gated: `components/Analytics.tsx` injects GA4 only when `NEXT_PUBLIC_GA4_ID` is set; `lib/analytics.ts` fires `view_item`, `add_to_cart`, `begin_checkout`, `purchase` (AUD). **No variant dimension exists.**
- Cart is localStorage (`ecl_cart_v1`) via `lib/cart-context.tsx`; checkout is a Supabase server action at `/checkout`; free-shipping threshold **$150** (`lib/env.ts`).
- Data: `data/catalog.json` (products, prices in minor units), `data/reviews.json`, `data/collections.json`, `data/stacks.json`, `lib/coa.ts` (real batch records).
- No `/1` route, no A/B or feature-flag infra anywhere.

### Renue By Science (what actually makes it convert)

20-section homepage; the load-bearing patterns:

- **Trust = published verifiable data, not badges.** Real COA reference numbers on product pages, review counts on every tile (Okendo, e.g. 4.6★/684 — even a 3.5★/6 product shown), ISO/cGMP third-party lab language, "results published so you can verify before you buy."
- **Business-scale metrics band:** "10 years · 80%+ reorder rate · 100+ countries · 1M+ bottles" — quantified longevity as social proof.
- **Named humans:** team-of-experts section with doctor credentials; video testimonials from named customers.
- **Almost zero urgency theater.** No countdowns, no stock scarcity, no discount popups on the homepage. Calm confidence *is* the conversion strategy.
- **Proprietary framework as navigation** ("Four Pathways: Boost/Protect/Optimize/Regenerate") — brand-owned mental model doubling as merchandising.
- **Goal-based shopping** (Heart, Sleep, Energy…) implemented as filters on one collection.
- **Offer mechanics:** subscribe-&-save 10% in the announcement bar, free shipping $50+, protocol bundles, loyalty program. All low-pressure.
- Copy: short declarative headlines, mechanism-then-study science framing, "supports/studied" compliance language, plain CTAs ("Shop now", "Learn More").

### Renue → ECL translation map

| Renue pattern | ECL equivalent | Data source (already exists) |
|---|---|---|
| Published COA numbers | Latest batch strip w/ real batch IDs → `/lab-results` | `lib/coa.ts` `getLatestCoa()` |
| Review counts on tiles | Stars + counts on every product card | `data/reviews.json` via `decorateCards` |
| Third-party lab language | "Independently tested by JanoShik" (already the hero badge) | existing copy |
| Metrics band | Batches tested / compounds stocked / orders shipped | **needs Shanaka's real numbers** |
| Subscribe-&-save bar | 10% subscribe option already in `BuyBox` — surface it on `/1` | existing |
| Free shipping $50+ | "Free AU shipping over $150" announcement | `FREE_SHIPPING_THRESHOLD` |
| Goal-based shopping | "Shop by research goal" tiles | `data/collections.json` |
| Protocol bundles | Research stacks | `data/stacks.json` |
| Team of experts | Cannot fabricate — use "Our testing process" + JanoShik instead | existing steps copy |
| Calm, no urgency | Drop any countdown/scarcity impulse from `/1` | design rule |

**Compliance note:** Renue sells human supplements and can talk benefits/dosage. ECL cannot — everything stays research-use framing, purity/testing-led, zero physiological claims. Trust must come entirely from *process* (testing, COAs, dispatch, business legitimacy), which is exactly the strongest part of the Renue playbook anyway.

---

## 2. The `/1` variant — design specification

### 2.1 Design language ("Clinical Light")

| Token | Value | Note |
|---|---|---|
| Background | `#fafbfc` (near-white) | full-bleed light |
| Surface/cards | `#ffffff` with `#e5e9ef` borders, soft shadows | |
| Ink (text) | `#0c1220` (deep navy-black) | |
| Muted text | `#5b6676` | AA on white |
| Accent | `#0e8c82` (darkened brand teal) | the current `#2fd4c8` fails WCAG AA on white (~2.1:1); `#0e8c82` passes for text/CTAs. Keep `#2fd4c8` only for non-text accents |
| Success | `#0f7a4d` | verified/purity marks |
| Type | `next/font` Inter (or Geist), tabular numerals for prices/batch IDs | one font, subset — the only new dependency |

Feel: generous whitespace, thin rules, subtle science motifs (faint grid, molecule line-art), product photography on white. **No dark sections at all** — a single dark block would read as the old theme leaking through. Reuse existing utility patterns (`.card-hover`, `.btn-press`, `.reveal`) — they're theme-agnostic classes.

### 2.2 Section order (top → bottom)

1. **Announcement bar** — "Free AU shipping over $150 · Same-day dispatch before 2pm AEST" (verify cutoff with Shanaka). Light-grey bg, single line.
2. **Slim light header** (new `VariantHeader`) — logo, nav (Shop / Stacks / Lab Results / Learn), cart button (shared `useCart` badge). Sticky.
3. **Hero** — split layout. Left: small caps eyebrow "INDEPENDENTLY TESTED · RESEARCH USE ONLY", H1 (declarative, e.g. "Research peptides. Verified purity. Every batch."), one-line sub naming JanoShik third-party testing, review aggregate (stars + real count from `getSiteAggregate`), dual CTAs: primary **Shop peptides** → `/shop`, secondary **See our lab results** → `/lab-results`. Right: product vial photography on white with a real COA proof card (actual latest batch ID + purity %). Compact `ResearchDisclaimer` line beneath. *Antecedent check: everything above communicates "professional, tested lab" without scrolling.*
4. **Trust strip** — 4 items, icons + one-liners, all verifiable: Independently tested (JanoShik) · ≥99% stated purity, published COAs · Australian owned & dispatched · Secure checkout. (Only claims we can back; ABN/address shown if Shanaka confirms.)
5. **Latest verified batches** — restyled light `CoaStrip`: real batch IDs, compound, purity, test date, each linking to `/lab-results`. This is the Renue "published COA numbers" move and the page's credibility anchor.
6. **Bestsellers** — light `ProductCard` variant: photo on white, name, stars + review count, per-vial price ("$104.99 · $X/vial in 3-packs"), In stock mark. Same `BESTSELLER_SLUGS` + `decorateCards` data as `/` (identical merchandising = clean test).
7. **Shop by research goal** — light collection tiles from `data/collections.json`.
8. **Metrics band** — 3–4 quantified facts. **Every number PLACEHOLDER until Shanaka supplies real values** (e.g. batches tested to date, compounds stocked, orders shipped, avg dispatch time). Ship the section only with real numbers; otherwise cut it. No fabrication.
9. **How our testing works** — 3 numbered steps (existing `copy.steps` content, light styling) + CTA to `/lab-results`.
10. **Research stacks** — 2 `StackCard`s, light treatment, framed as "protocol bundles."
11. **Reviews** — real entries from `data/reviews.json` only (name, product, stars, text). If fewer than ~4 solid reviews exist, fall back to the aggregate + per-product review links; **never** pad with invented quotes.
12. **FAQ** — reuse `Faq` content, light accordion. Skip duplicate FAQPage JSON-LD on `/1` (canonical home already emits it; `/1` is noindex anyway).
13. **Email capture** — "Get batch releases & restock alerts" + WELCOME10 incentive (confirm the code is live), posting to existing `/api/subscribe`.
14. **Footer** (new light `VariantFooter`) — full research-use disclaimer, business details (ABN — needs Shanaka), payments, links.

Deliberately excluded (Renue-informed): countdowns, stock scarcity, exit-intent modal (the store's `ExitIntentModal` stays off `/1` — calm confidence is the strategy being tested), hero carousels.

### 2.3 File architecture

```
app/(variant)/1/page.tsx        ← the variant page (server component, revalidate 300)
app/(variant)/layout.tsx        ← bespoke shell: Providers + VariantHeader + VariantFooter
                                   + CartDrawer + Analytics (cart/analytics shared, chrome not)
components/variant/…            ← VariantHeader, VariantFooter, light ProductCard/CoaStrip
                                   variants (new files — zero edits to existing components)
app/globals.css                 ← append a `.theme-light { … }` scoped token block
```

Own route group `(variant)` — **not** inside `(store)` — because the dark `Header`/`Footer`/`AnnouncementBar` would break the light page. `Providers`, `CartDrawer`, and `Analytics` are re-wrapped in the variant layout so cart state, GA4, and checkout behave identically. Known seam: the shared `CartDrawer` is dark-styled and will open over the light page — acceptable for v1 (it's identical for both arms so it can't bias the test); a light skin is a fast-follow.

Mobile: hero stacks (copy above image), sticky bottom **Shop peptides** CTA bar, cards in 2-col grid.

Performance: LCP < 2.5s — hero image `priority`, one subset font, no new JS libraries, static-friendly (same `revalidate = 300` as `/`).

SEO: `robots: { index: false, follow: true }` in `/1` metadata + canonical pointing at `/`. Paid traffic doesn't need indexing, and this prevents duplicate-content damage.

---

## 3. Split-test mechanics

### Layer 1 — direct traffic to two URLs (launch; matches "driving traffic to both")

- `/` = control, `/1` = variant. Ad sets duplicated per arm with UTMs:
  `utm_campaign=fp-test-2026q3`, `utm_content=control` → `/`, `utm_content=v1` → `/1`.
- **Variant cookie:** tiny client snippet in each landing surface sets `ecl_variant=control|v1` (120-day, path=/, only if not already set — first touch wins). This survives navigation to `/product/*` and `/checkout`, which is how purchases attribute to the landing design despite the shared funnel.
- **GA4 variant dimension:** extend `lib/analytics.ts` so every event (`view_item`, `add_to_cart`, `begin_checkout`, `purchase`) reads the cookie and attaches `variant` as an event param; register it as a custom dimension in GA4 admin. ~20 lines, no behavior change when GA4 is unset.
- **Phase-0 gate:** confirm `NEXT_PUBLIC_GA4_ID` is actually set in Vercel production env. **If it isn't, the test cannot be measured — this is the first checkbox of the build.**

### Layer 2 — automatic 50/50 split for organic traffic (optional, after Layer 1 is stable)

Extend `middleware.ts`: add `"/"` to the matcher; on `/` requests without `ecl_variant`, assign 50/50 via `crypto.getRandomValues`, set the cookie, and **rewrite** (not redirect) bucket-v1 users to `/1` (URL stays `/`, no SEO/UX cost). Existing cookie → honor it (sticky). Guard: the new branch runs **only** for exact-path `/`; every `/admin` request short-circuits into the existing logic untouched, and the Supabase session fetch never runs on public paths. Skip Layer 2 entirely if paid traffic is the only meaningful volume — simpler is better.

### Measurement & decision framework

- **Primary:** session → purchase conversion rate per variant (GA4 `purchase` w/ `variant`).
- **Secondary:** add-to-cart rate, begin-checkout rate, AOV, bounce/engagement rate.
- **Sample-size honesty:** detecting a 25% relative lift on a ~1.5% baseline CVR needs ≈ **9,000–10,000 sessions per arm** (α=.05, power .8). At low traffic that's months. Ladder: if <~1,000 sessions/arm/month, judge on **add-to-cart rate** (≈6–10× more events, weeks not months) with purchase rate as a directional sanity check; report begin-checkout as the middle rung.
- **Duration:** minimum 2 full weeks (whole weeks only, weekday/weekend cycles), regardless of early results.
- **Winner:** primary (or ladder) metric better at ≥95% confidence (chi-square/GA4 exploration) AND no secondary metric materially worse. Ambiguous after 6–8 weeks → iterate the variant rather than extend indefinitely.
- **Outcomes:** v1 wins → promote design to `/` (swap page content; retire `/1` with 308 → `/`), keep dark theme in git history. Control wins → retire `/1`, harvest any element that individually outperformed (COA strip prominence, review counts on cards) back into `/`.

---

## 4. Build phases (execution session — after approval)

**Phase 0 — Measurement foundation (~30 min)** · Verify `NEXT_PUBLIC_GA4_ID` in Vercel prod; add `variant` param to `lib/analytics.ts`; register GA4 custom dimension; add cookie helper.
✅ GA4 live in prod · events carry `variant` · cookie set on both landings · zero behavior change with env unset.

**Phase 1 — Variant shell & theme (~1 hr)** · `(variant)` route group, layout with shared Providers/CartDrawer/Analytics, `.theme-light` tokens, VariantHeader/VariantFooter, noindex metadata.
✅ `/1` renders light shell · cart opens & persists from `/1` · `robots` noindex present · `/` and `/admin` byte-identical to before.

**Phase 2 — Page sections (~2–3 hrs)** · Sections 1–14 per spec §2.2; light ProductCard/CoaStrip variants; real data wired (catalog, reviews, COAs, collections, stacks); metrics band only if real numbers supplied.
✅ All specced sections render with real data · no fabricated content · disclaimer present · add-to-cart → checkout completes from `/1` · Interceptor screenshots desktop + mobile.

**Phase 3 — QA & launch (~1 hr)** · Lighthouse on `/1` (LCP < 2.5s), full purchase test-order from each arm verifying `variant` on `purchase` event, deploy, verify live with Interceptor.
✅ Lighthouse pass · GA4 realtime shows both variants · live `/1` matches spec · runbook note in GO_LIVE_RUNBOOK.md.

**Phase 4 (optional) — Middleware auto-split (~1–2 hrs)** · Layer 2 per §3.
✅ 50/50 assignment sticky across sessions · `/admin` untouched (login + session refresh regression-tested) · rewrite keeps URL `/`.

### Inputs needed from Shanaka (blockers only for the sections that use them)

1. Real metrics-band numbers (batches tested, orders shipped, founded year) — or we cut the section.
2. ABN / business address for the footer trust block — recommended, optional.
3. Confirm dispatch cutoff claim ("same-day before 2pm"?) and that WELCOME10 is live.
4. Confirm GA4 property exists and `NEXT_PUBLIC_GA4_ID` is (or can be) set in Vercel.

---

*Plan grounded in: Explore-agent teardown of `storefront/` (2026-07-25) and live fetch teardown of renuebyscience.com (2026-07-25). Prior related work: ECOM_UPGRADE_PLAN.md (Woo site), eastcoastlabs-admin-plan ISA (admin panel).*
