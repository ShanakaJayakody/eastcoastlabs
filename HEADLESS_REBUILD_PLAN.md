# East Coast Labs — Headless Rebuild Plan (Next.js storefront + WooCommerce backend + Bankful)

> **Supersedes the platform choice in `ECOM_UPGRADE_PLAN.md`.** That plan's *strategy* (tiers, subscriptions, trust, copy, measurement) is 100% still valid and reused. Only the *presentation platform* changes: from an Elementor/WordPress theme to a brand-new Next.js storefront.
> **Decision (2026-07-21):** Stack = **Next.js + headless WooCommerce**; Payments = **keep Bankful (already approved)**.
> **Executor:** GLM 5.2 (builds React/Next well — unlike Elementor) + you for DNS/host/gateway steps.

---

## 0. Why this architecture (read once)

You want a genuinely new site. You cannot use Shopify/Stripe/Square — they terminate research-peptide merchants. Your working, **already-approved Bankful** account lives inside WooCommerce. So:

- **WooCommerce stays** — invisible, as a headless commerce API + the payment step. You never look at wp-admin's front end again.
- **Next.js is the entire storefront** the customer sees — home, collection, PDP, cart. Deployed to Vercel. This is the "new site."
- **Payments are never re-solved.** At checkout, the cart is handed to WooCommerce's own `/checkout`, where Bankful runs exactly as today. Only the final pay screen is Woo-hosted.

This is the one headless pattern that keeps a high-risk hosted gateway working without a payment re-integration. It's why this path was recommended.

### Confirmed viable (probed live 2026-07-21)
```
/wp-json/                      200   REST API on
/wp-json/wc/store/v1/products  200   15 products, prices, SKUs (public read)
/wp-json/wc/store/v1/cart      200   headless cart + Cart-Token header
```

### Data flow
```
 Customer ──▶ Next.js storefront (Vercel, eastcoastlabs.com.au)
                │  browse / PDP / add-to-cart / cart drawer
                │  reads:  GET  wc/store/v1/products (catalog, tiers, prices)
                │          GET  /wp-json/ecl/v1/coa   (batch COA data — custom)
                │  cart:   POST wc/store/v1/cart/*    (Cart-Token, shared cookie)
                ▼
        "Checkout" ──▶ shop.eastcoastlabs.com.au/checkout   (WooCommerce)
                          │  same cart (shared .eastcoastlabs.com.au cookie)
                          │  WooCommerce Subscriptions (Restock Program)
                          ▼
                     Bankful hosted payment  ──▶  order  ──▶  redirect back to
                                                              eastcoastlabs.com.au/thank-you
```

### What of GLM's existing work survives
| Existing file(s) | Fate |
|---|---|
| `ecl-conversion/includes/` (COA, bac-water, free-shipping, restock, consistency, stock-status) | **KEEP** — backend logic on WooCommerce |
| `ecl-conversion/data/` (price-table.json, cross-sells.json, coa-seed.csv) | **KEEP** — consumed by Next.js + WP-CLI |
| `ecl-conversion/cli/` (product/tier setup commands) | **KEEP** — backend catalog setup |
| `ecl-conversion/docs/` + top-level `docs/` (all copy decks) | **KEEP** — becomes Next.js content |
| `class-ecl-coa-module.php` | **KEEP logic, ADD REST** — expose COA as `/wp-json/ecl/v1/coa` |
| `class-ecl-ga4-events.php` | **MOVE** — GA4 goes in the Next.js frontend |
| `ecl-conversion/templates/*.php`, `assets/js/ecl-*.js`, `assets/css` | **REPLACE** — rebuilt as React components |
| `hello-elementor-child/` | **RETIRE** (front) — keep only enough to style the Woo `/checkout` page |
| `BASELINE.md`, `TESTS.md` | **KEEP** |

Roughly 70% reuse, 30% rebuild. Nothing was wasted — it was built one layer too low.

---

## 1. Compliance carryover (unchanged, still non-negotiable)

Every rule from `ECOM_UPGRADE_PLAN.md §1` still applies on the new frontend: research-use-only framing; **vial/pack counts, never "month supply"**; no dosing/effects/benefit claims; review moderation strips human-use claims; "research use only" disclaimers on PDP, cart, checkout, and subscription sign-up. React components render this copy; the rules don't change because the platform did.

---

## 2. Fixing the 404 properly

The 404 happened because a WordPress PHP repo was deployed to a static host — nothing to serve. The real fix is the deployment model below, done at the end (Phase R6), not now:

- **Storefront:** Next.js → **Vercel**, domain `eastcoastlabs.com.au` + `www`. (Vercel serves a real build — no more 404.)
- **Backend:** WooCommerce moves to **`shop.eastcoastlabs.com.au`** on the current LiteSpeed host. Handles Store API, `/checkout`, `/my-account`, Bankful, subscriptions.
- **DNS cutover is the last step** — build and verify on Vercel preview URLs first.

Do **not** try to redeploy the current repo to fix the 404 — there is no site in it. The site gets built in R1–R5.

---

## 3. Phases

Sequence R0 → R6. R0 (backend headless-ready) must land before R1 can pull data.

---

### R0 — Make the WooCommerce backend headless-ready (effort: M)

| Task | Owner |
|------|-------|
| R0.1 Confirm the ecl-conversion backend classes are active on the site; run the WP-CLI tier/price setup so the Store API returns variable products with 1/3/6-vial tiers (per `ECOM_UPGRADE_PLAN.md §2.1` price table / `data/price-table.json`) | GLM |
| R0.2 Add a custom REST route `GET /wp-json/ecl/v1/coa` (and `/coa/{product_id}`) exposing batch id, purity %, lab, test date, COA url — from the existing `_ecl_coa` meta / `coa-seed.csv` | GLM |
| R0.3 Enable CORS on the Store API + custom routes for the storefront origins (`https://eastcoastlabs.com.au`, Vercel preview `*.vercel.app`); expose `Cart-Token` | GLM |
| R0.4 Set WooCommerce cart/session cookie domain to `.eastcoastlabs.com.au` so the headless cart carries into the Woo checkout | GLM+HUMAN |
| R0.5 Plan the subdomain move: WooCommerce will answer on `shop.eastcoastlabs.com.au`; update WP Address/Site Address, `home`/`siteurl`, and Bankful return URLs accordingly (executed at R6, staged now) | GLM+HUMAN |
| R0.6 Confirm with Bankful: hosted-checkout return URL can point at `eastcoastlabs.com.au/thank-you`; tokenized recurring works for the Restock subscription | HUMAN |

**Acceptance:** `GET /wp-json/wc/store/v1/products` returns variable products with 3 tier variations and correct prices; `GET /wp-json/ecl/v1/coa/{id}` returns batch data; a browser `fetch` from a different origin succeeds (CORS ok); cart cookie domain = `.eastcoastlabs.com.au`.

**GLM 5.2 prompt — R0:**
```text
You are making an existing WordPress + WooCommerce site (currently eastcoastlabs.com.au, later
shop.eastcoastlabs.com.au) into a HEADLESS commerce backend for a separate Next.js storefront.
Work on staging. The `ecl-conversion` plugin already exists with COA/bac-water/free-shipping/
restock logic and data files (data/price-table.json, cross-sells.json, coa-seed.csv). Compliance:
research-use-only; quantities are "vials"/"packs", never "month supply"; no human-use language.

Tasks:
1. Verify ecl-conversion is active and its WP-CLI commands run. Ensure all 14 peptide products
   are variable products with Pack Size = 1 vial|3 vials|6 vials, priced from data/price-table.json.
   Confirm via: curl "$SITE/wp-json/wc/store/v1/products?per_page=20" shows type:"variable" and
   3 variations each with correct prices.
2. In ecl-conversion, register a REST namespace `ecl/v1`:
   GET /coa            -> list: [{product_id, sku, name, batch_id, purity_pct, lab, test_date, coa_url, lab_verify_url}]
   GET /coa/{id}       -> single product's COA object
   Source the data from the existing _ecl_coa meta (fallback: data/coa-seed.csv). Permission:
   public read. Return proper JSON + 404 for unknown id.
3. Add CORS headers (rest_pre_serve_request filter) for the Store API and ecl/v1 routes:
   allow origins https://eastcoastlabs.com.au and https://*.vercel.app; allow GET/POST/OPTIONS;
   expose header Cart-Token; handle preflight OPTIONS.
4. Set the WooCommerce session/cart cookie domain to .eastcoastlabs.com.au (COOKIE_DOMAIN or the
   woocommerce_cookie_domain filter) so the headless cart persists into /checkout on the shop. subdomain.
5. Output a written runbook (do NOT execute) for the R6 domain move: exact wp_options home/siteurl
   changes, search-replace plan, and the Bankful return-URL values to update.

Verify by quoting: the products.json variation output for BPC-157, a GET /wp-json/ecl/v1/coa/{id}
response, and a cross-origin fetch test result. Do not touch production.
```

---

### R1 — Next.js storefront scaffold + data layer (effort: M)

| Task | Owner |
|------|-------|
| R1.1 New repo/app: Next.js 15 (App Router), TypeScript, Tailwind, in `/storefront` of this repo (or a fresh repo) | GLM |
| R1.2 Typed WooCommerce Store API client (products, product by slug, cart endpoints) + `ecl/v1/coa` client; `WOO_API_BASE` env var | GLM |
| R1.3 Design tokens from the brand (dark, lab-grade, clinical-but-premium); base layout, header nav (Shop / Lab Results / About / Cart), footer with ABN + branded email | GLM |
| R1.4 Content loader for the `docs/*.md` copy decks (product descriptions, About, homepage/PDP copy) | GLM |

**Acceptance:** `npm run build` succeeds; home route renders live product names/prices fetched from the Store API on a Vercel preview URL; no hardcoded catalog data.

**GLM 5.2 prompt — R1:**
```text
Build a new Next.js 15 (App Router, TypeScript, Tailwind) storefront for a headless WooCommerce
store. Backend base URL in env WOO_API_BASE (default https://eastcoastlabs.com.au for dev).
Create in /storefront. Compliance: research-use-only copy; "vials"/"packs" not "month supply";
no human-use/effects language anywhere.

Tasks:
1. Scaffold the app (app router, TS strict, Tailwind, eslint). Add .env.example with WOO_API_BASE.
2. lib/woo.ts: typed client for the WooCommerce Store API:
   getProducts(), getProductBySlug(slug), cart: getCart(), addItem(id, qty, variation),
   updateItem(), removeItem(). Persist and send the Cart-Token header (read from response,
   store in a cookie) so the cart survives navigation. Handle variable products (variations,
   attributes) and prices (they come as minor units + currency — format correctly, AUD).
3. lib/coa.ts: client for GET {WOO_API_BASE}/wp-json/ecl/v1/coa and /coa/{id}.
4. lib/content.ts: load the markdown copy decks from /docs (PRODUCT_DESCRIPTIONS.md,
   ABOUT_PAGE_COPY.md, HOMEPAGE_PDP_COPY.md) at build time; map to products by name/slug.
5. Global layout: header (Shop / Lab Results / About / Cart with item count), footer (ABN,
   eclpeptides@gmail.com, "Australian owned & operated", research-use disclaimer).
   Dark clinical-premium theme with Tailwind tokens.
6. Home page: hero (copy from HOMEPAGE_PDP_COPY.md — "Lab-grade peptides. Independently tested.
   Proof published."), a live "latest batch results" strip from the COA API, bestsellers grid
   with "from $X/vial" pricing.

Verify: run `npm run build`, then `npm run start`, and quote the rendered home page HTML showing
live product names + prices pulled from the API (not hardcoded). Report any Store API field
surprises. Commit to a branch; deploy a Vercel preview and give the URL.
```

---

### R2 — Collection + Product pages with tiers, COA, guarantee (effort: L)

Rebuild the conversion surfaces from `ECOM_UPGRADE_PLAN.md §4.1` as React:
- **Collection** `/shop`: product cards, "from $X/vial", stock status, star rating (Judge.me) once live.
- **PDP** `/product/[slug]`, section order: gallery → title → fact-led descriptor → **tier radio cards** (1 vial / 3-pack MOST POPULAR pre-selected / 6-pack BEST VALUE + free bac water) → **restock toggle** (unchecked, +10%, skip/pause/cancel copy) → bac-water attach checkbox → Add to Cart → guarantee microcopy → trust icons → **COA verification module** (live batch/purity from `ecl/v1/coa`) → description (from copy deck) → guarantee block → FAQ accordion → cross-sells → reviews.
- **Sticky add-to-cart** on scroll (IntersectionObserver) with selected-tier price.

**Acceptance:** BPC-157 PDP renders 3 tier cards with correct per-vial prices, 3-pack pre-selected, live COA batch shown, sticky bar appears on scroll; adding a tier to cart hits the Store API and updates the cart count.

**GLM 5.2 prompt — R2:** *(self-contained; specify the section order above, the tier-card component reading `variations` from the Store API, the COA module calling `ecl/v1/coa/{id}`, the bac-water attach adding the Bac Water product id to the cart, and the sticky bar. Reuse copy from `docs/HOMEPAGE_PDP_COPY.md` + `docs/PRODUCT_DESCRIPTIONS.md`. Verify with a Vercel preview screenshot of the BPC-157 PDP + a cart-add network trace.)*

---

### R3 — Headless cart + checkout handoff to Bankful (the crux) (effort: L)

- **Cart drawer** (React): line items, qty, remove; **free-shipping progress** ("You're $X from free shipping" at $150); cross-sell + bac-water upsell rows; subtotal.
- **Checkout button** → navigate to `https://shop.eastcoastlabs.com.au/checkout` with the **same cart** (shared `.eastcoastlabs.com.au` cart cookie from R0.4). Woo renders checkout → Bankful hosted payment → on success redirects to `eastcoastlabs.com.au/thank-you`.
- **Subscriptions** (Restock Program) complete on the Woo checkout — sub sign-up + tokenized recurring must be server-side; the tier's selling-plan is already in the cart item.
- **Fallback if cookie-sharing is fussy:** server action creates the order via Store API `/checkout` then redirects to the returned Bankful `payment_url`. Document both; ship the cookie-share path first.

**Acceptance:** on staging, a cart built in Next.js appears intact on the Woo `/checkout` page; a test order completes through Bankful (sandbox) and returns to `/thank-you`; a subscription line item creates a Woo subscription.

**GLM 5.2 prompt — R3:** *(self-contained; specify: Store API cart via Cart-Token; cart drawer components + free-ship progress; the handoff navigation to shop.eastcoastlabs.com.au/checkout relying on the shared cookie domain; the fallback order-create path; and an end-to-end verify with a Bankful sandbox order. Emphasize: do NOT build a custom card form — payment stays on Woo/Bankful.)*

---

### R4 — Trust & brand pages (effort: M)

- **`/lab-results`** — the Respire "Test Results 🔬" equivalent, live from `ecl/v1/coa`: every compound, batch id, JanoShik purity %, test date, COA links. Headline: "Every batch tested by an independent lab. Every result published."
- **`/about`** — from `docs/ABOUT_PAGE_COPY.md`: founder story, testing philosophy, ABN, location, support hours.
- **Reviews** — Judge.me headless widget/API embedded on PDP + a reviews section; verified-buyer badges; the human-use moderation rule stays enforced in Judge.me (backend).
- **Homepage proof strip** — live latest-batch results (replaces the deleted fake testimonials).

**Acceptance:** `/lab-results` and `/about` return 200 on preview with live COA data + ABN visible; Judge.me reviews render on a PDP.

---

### R5 — Retention + analytics on the new frontend (effort: M)

- **Klaviyo** — onsite JS + API from Next.js: popup (exit-intent + 8s), footer capture (WELCOME15), and the 5 flows from `ECOM_UPGRADE_PLAN.md §5` / `docs/KLAVIYO_COPY_DECK.md` (welcome, abandoned cart via `checkout_started`, post-purchase COA-verify, replenishment, winback). Abandoned-cart events fire from the headless cart.
- **GA4** — gtag/GTM in Next.js with ecommerce events (view_item, add_to_cart, begin_checkout on handoff, purchase on `/thank-you`). Replaces the server-side `class-ecl-ga4-events.php`.
- **Product schema** (JSON-LD) in Next.js PDPs with aggregateRating once reviews exist.

**Acceptance:** GA4 DebugView shows the 4 events across a test journey; Klaviyo receives a `checkout_started` event from the headless cart; PDP emits valid Product JSON-LD.

---

### R6 — Deploy, DNS cutover, verify (effort: M)

| Task | Owner |
|------|-------|
| R6.1 Deploy `/storefront` to Vercel; set env `WOO_API_BASE=https://shop.eastcoastlabs.com.au` | GLM+HUMAN |
| R6.2 Move WooCommerce to `shop.eastcoastlabs.com.au` (run the R0.5 runbook: siteurl/home, search-replace, Bankful return URLs) | GLM+HUMAN |
| R6.3 DNS: apex + `www` → Vercel; `shop` → current host. TTL low during cutover | HUMAN |
| R6.4 301 map: old WP URLs (`/shop-all/`, `/product/...`, `/coa/`) → new routes (`/shop`, `/product/...`, `/lab-results`) | GLM |
| R6.5 Full live verify: home, PDP, add-to-cart, checkout handoff, **real Bankful order**, subscription create, thank-you redirect, COA/About/Lab-results pages, analytics events | GLM+HUMAN |

**Acceptance:** `https://eastcoastlabs.com.au/` serves the Next.js site (200, not 404); a real end-to-end purchase completes through Bankful and lands on `/thank-you`; old URLs 301 to new ones; no route 404s except intentionally removed ones.

**This is where the 404 is actually resolved** — a real Next.js build on Vercel behind the apex domain.

---

## 4. Master checklist

- [ ] R0: variable-product tiers in Store API · `ecl/v1/coa` route · CORS · cart cookie domain · Bankful return-URL confirmed
- [ ] R1: Next.js scaffold · typed Store API + COA clients · layout · content loader · home w/ live data
- [ ] R2: collection + PDP · tier cards (3-pack default) · COA module · guarantee · sticky ATC · bac-water attach
- [ ] R3: cart drawer · free-ship progress · **checkout handoff to Woo/Bankful** · subscription line · sandbox order passes
- [ ] R4: /lab-results · /about (ABN) · Judge.me reviews · homepage proof strip
- [ ] R5: Klaviyo (popup + 5 flows) · GA4 events · Product schema
- [ ] R6: Vercel deploy · shop. subdomain move · DNS cutover · 301 map · live Bankful order verified

## 5. Do-not (carried from the strategy plan)

- ❌ No custom card form / storing card data — payment stays on Woo + Bankful.
- ❌ No "month supply", dosing, or effects language on the new frontend, reviews, or emails.
- ❌ No fabricated reviews/stars/scarcity; strikethroughs only for real N×-single pack anchors.
- ❌ No DNS cutover before the Bankful end-to-end order passes on staging/preview.
- ❌ Don't rebuild what the backend already does (COA, subscriptions, shipping rules) — call it via API.
