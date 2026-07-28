# `/1` Total Redesign — "The Dossier"

> Status: **PLAN — awaiting approval. Supersedes the visual spec in VARIANT_SPLIT_TEST_PLAN.md §2.**
> What survives from the current `/1` build (verified working, keep untouched): the `(variant)` route group, `ecl_variant` first-touch cookie, GA4 `variant` tagging on all commerce events, noindex/canonical, shared cart/checkout funnel, `.theme-*` token-scoping mechanism, launch.json port-3100 dev server.
> What gets replaced: **every visible pixel of the page.**

---

## 0. Why the first pass failed the brief — and what that teaches us

The v1 variant was the same information architecture with light tokens: hero → trust cards → grids of rounded cards → FAQ. That IS the generic AI template, and it looks like it because those are its tells:

| AI tell (v1 had it) | The Dossier rule |
|---|---|
| `rounded-xl` cards on everything | **2px radius max.** Hairline borders do the work, not corner radius |
| Emoji as icons (🔬 🇦🇺 🛡️) | **Zero emoji anywhere.** Custom thin-line SVG glyphs or typographic marks only |
| Gradient text on the hero keyword | No gradients. One accent colour, used sparingly, always flat |
| Centered symmetric sections, equal-width card grids | Asymmetric 12-col editorial grid with visible structure |
| Interchangeable "trust badge" cards | Trust rendered as **documents** (a real COA, a signed guarantee), not badges |
| Soft drop-shadows floating everything | Flat. Paper sits on paper; rules separate, shadows don't |
| Generic SaaS blue/teal on white | Warm paper + archival ink + one laboratory green |
| Copy in "benefit-speak" | Copy in laboratory register: numbers, dates, batch IDs, declarative sentences |

**Design thesis:** this store's entire competitive advantage is *published proof*. So the design language is the proof itself — the site is typeset like a laboratory dossier: certificate, ledger, specimen plate, verification stamp. Reference points: Aesop (editorial ecom restraint), Swiss technical documentation (grids, rules, mono data), a journal masthead (serif authority). No competitor in this category looks like this; renuebyscience gave us the *trust content* playbook, but the *visual* language here is ownable.

---

## 1. Design system — "Dossier"

### 1.1 Colour (scoped as `.theme-paper` in globals.css, same mechanism as `.theme-light`)

| Token | Value | Role |
|---|---|---|
| `--color-ink` (page bg) | `#F4F2ED` | Warm archival paper — NOT cool white; this alone kills the SaaS look |
| `--color-ink-2` | `#EBE8E1` | Recessed panels, table header rows |
| `--color-surface` | `#FBFAF7` | Raised paper — cards, the COA document |
| `--color-surface-2` | `#F0EDE6` | Alternate table rows |
| `--color-line` | `#D9D4C9` | Hairlines (1px, everywhere, visible grid) |
| `--color-line-2` | `#B8B2A4` | Emphasised rules, table borders |
| `--color-fg` | `#171512` | Near-black warm ink |
| `--color-fg-2` | `#3E3A33` | Secondary text |
| `--color-muted` | `#6E6759` | Captions, metadata |
| `--color-muted-2` | `#8A8375` | Faintest labels |
| `--color-accent` | `#1A5C4A` | Laboratory green — CTAs, links, verified marks. 6.4:1 on paper |
| `--color-accent-2` | `#8C2F1B` | Oxide red — the "stamp" colour. Used ONLY for the certification stamp motif and sale/alert marks. Scarcity of use is what gives it authority |
| `--color-accent-ink` | `#F8F7F2` | Text on accent fills |
| `--color-success` | `#1A5C4A` | Same as accent — one green, not two |
| `--color-warn` | `#8C5A1B` | RUO compliance notices |

Product photography plates: keep the verified `:has(img)` dark-plate rule but retune to `#101010` matte with a 1px `--color-line-2` border — "specimen viewport" framing.

### 1.2 Typography (the redesign's backbone — this is where "world-class" lives)

Three families via `next/font/google`, subset latin, `display: swap`:

| Slot | Face | Usage |
|---|---|---|
| **Display serif** | `Newsreader` (opsz axis, 400/500 + italic) | H1/H2, product names, pull quotes. Editorial authority — the single strongest anti-AI signal |
| **Text grotesk** | `Inter` (400/500/600) | Body, UI, buttons, nav |
| **Data mono** | `IBM Plex Mono` (400/500) | EVERY number that is evidence: batch IDs, purity %, dates, prices in tables, SKUs, the ticker. Mono numerals = instrument readout |

Scale (desktop / mobile): H1 `clamp(2.6rem, 5.2vw, 4.4rem)` serif 480 weight, line-height 1.02, letter-spacing −0.015em · H2 `2rem/1.6rem` serif · H3 `1.05rem` grotesk 600 uppercase tracking +0.08em (section labels) · body `1rem/1.55` · caption `0.8125rem` · data-mono `0.8125rem`.

Rule: **serif never appears below 1.25rem; mono never used for prose.** Discipline is the aesthetic.

### 1.3 Grid & rhythm

- `max-w-[1200px]`, 12-col, 24px gutters. Section verticals: 96px desktop / 64px mobile.
- **Visible structure:** every section opens with a full-width 1px rule + a mono section marker line: `01 / PROOF` … `07 / DISPATCH`. The page reads as a numbered document.
- Radius: 2px on interactive elements, 0 on panels. Shadows: none, except the sticky header's 1px bottom rule.

### 1.4 Motion (restraint = craft)

- One easing (`--ease-brand`, kept), durations 150–250ms.
- Section rules "draw" in on first view (scaleX 0→1, 400ms) — replaces v1's fade-up cards; keep existing `Reveal` observer, new CSS.
- Purity numbers count up ONCE on view (mono, 600ms, respects `prefers-reduced-motion` → static).
- Ticker: continuous 40s linear marquee, pauses on hover.
- Buttons: background darkens 6%, no transforms. Cards: border darkens, no lift.
- Nothing floats, nothing pulses, no particles, no conic gradients.

---

## 2. Page specification — section by section

Information architecture is rebuilt around one narrative: **Claim → Evidence → Catalog → Protocol → Contract → Logistics.** Seven numbered chapters, not thirteen stacked blocks.

### Header (replaces VariantHeader)
56px. Wordmark "EAST COAST LABS" text-only, grotesk 600, +0.12em tracking (no logo image — the typographic wordmark is the masthead). Nav: Compounds · Protocols · Lab Results · About. Right: mono micro-line `AU · 1-DAY DISPATCH` + Cart (count in mono). On scroll >80px: bg gains opacity, bottom hairline appears. Mobile: wordmark + cart + menu; full-screen menu typeset as an index (serif items, mono numbering).

### 00 / Masthead strip (replaces announcement bar)
28px, `--color-ink-2`, single mono line, three items separated by `·` from `getSettings().announcementItems` (strip the emoji prefixes at render: `item.replace(/^\p{Emoji}+\s*/u,"")`). No icons.

### 01 / THE CLAIM — hero
Asymmetric 7/5 split on the 12-col grid, min-height 82vh, hairline column rule between.

**Left (7 cols):** mono eyebrow `RESEARCH-GRADE PEPTIDES — AUSTRALIA`; serif H1, two lines max: *"Every batch tested. Every result published. Before it ships."* (copy source: existing `copy.heroH1/heroSub` re-typeset — final wording at build); one-sentence grotesk sub; CTA row: primary filled `Browse the catalog` → `/shop`, secondary text-link with arrow `Read the lab results`; beneath, a mono proof-line pulled from live data: `LATEST: BATCH 89845 · KLOW · 99.91% · JANOSHIK · 20 DEC 2025` (from `getLatestCoa(1)`); then `ReviewSummary` (real aggregate) restyled — stars become five 8px squares filled/fractional in accent green (`Stars` gets a `variant="square"` prop or a v2 component).

**Right (5 cols): THE CERTIFICATE.** Not a product photo — a rendered Certificate of Analysis document (`components/variant/v2/CertificateCard.tsx`), fed by `getLatestCoa(1)`:
- `--color-surface` sheet, 1px `--color-line-2` border, 2px radius, subtle paper texture via CSS noise (4% opacity).
- Letterhead: `CERTIFICATE OF ANALYSIS` mono +0.2em; rule; two-col data table (mono): COMPOUND / BATCH / LAB / TEST DATE / PURITY.
- Purity row emphasised: serif 2.5rem `99.91%`.
- An SVG chromatogram trace (single accent-green line, one dominant peak — decorative schematic, labelled "HPLC-UV — indicative trace" so it's not claiming to be the real chart).
- **The stamp:** 64px circular SVG in oxide red, rotated −8°, `VERIFIED · JANOSHIK · ECL`, 0.85 opacity — the page's signature moment.
- Footer row: `coa_url` → `View original PDF ↗` and `lab_verify_url` → `Verify with lab ↗` (real links from the record).
- Mobile: certificate stacks BELOW the H1/CTA, full-width.

*This is the hero because it's the one thing no template store can fake: the actual document, first.*

### 02 / THE LEDGER — batch ticker + results table
Full-bleed marquee ticker, hairlines above/below: every `getAllCoa()` row as `BATCH 89845 — KLOW — 99.91% — 20 DEC 2025` mono items separated by `///`. Below, "The last six batches" as a **document table** (not cards): columns BATCH (mono) / COMPOUND (serif 1.25rem) / PURITY (mono, green, counts up) / LAB / DATE / ↗ verify. Row hover: `--color-surface-2`. Mobile: table collapses to stacked two-col rows. Footer link: `Complete archive → /lab-results`.

### 03 / THE CATALOG — products
Section header row: serif H2 "The compounds" left; right-aligned mono filter tabs from `collections.json` (ALL · RECOVERY · METABOLIC · COGNITIVE · LONGEVITY · SKIN — client-side filter of the 8 decorated bestsellers, no navigation).

**Product cards, redesigned as specimen plates** (`components/variant/v2/SpecimenCard.tsx`, replaces ProductCard here — ProductCard itself untouched for control):
- 2-col mobile / 4-col desktop, 1px-line separated (shared borders like a contact sheet, not floating cards).
- Dark specimen viewport (16:13) with the vial render; top-left mono microlabel `ECL-TES-10`; top-right stock state as text: `IN STOCK` green mono / `BACKORDER` muted (no pill).
- Below: compound name serif 1.375rem; one 6-word grotesk descriptor (from catalog `short_description`, truncated); square-stars + count when real reviews exist (from `decorateCards`), otherwise nothing — never fake;
- Price block, mono: `FROM $44.83 / VIAL` with `$269 · 6-PACK` second line (from `lib/pricing.ts` `fromPerVialLabel` + tier data);
- Whole card links to PDP; hover reveals underlined `View pack options` — one CTA, no quick-add (tier choice matters too much in this category to shortcut).
- Full catalog link styled as a ledger row: `INDEX: ALL 15 COMPOUNDS →`.

### 04 / THE METHOD — chain of custody
The 4 `copy.steps` as a horizontal **process rule**: one continuous hairline with four mono waypoint numbers `01–04`; under each, grotesk 600 title + 2-line body. Between step 3 and 4, inline mono annotation `↳ published to /lab-results`. Mobile: vertical rule down the left margin, steps hang right. Closing line, serif italic, from the real guarantee: *"If any independent lab finds your batch below our stated purity, we refund it — and pay for the test."* → anchors to §06.

### 05 / THE PROTOCOLS — stacks
Two `StackCard` replacements (`ProtocolCard.tsx`) styled as filed documents: tab-top with mono `PROTOCOL 01 — RECOVERY & REPAIR`; component list as a mono manifest table (compound / single price / included ✓); combined specimen viewport; price line `$120 · SAVE $30` mono with strikethrough total; CTA `Add protocol to cart` (keeps existing `addLine` + `trackAddToCart` wiring). SAVE marks in oxide red — the only red outside the stamp.

### 06 / THE CONTRACT — guarantee + reviews
Two-col 6/6, column rule between.
**Left — The Purity Contract:** surface sheet, serif H2 "Our contract", three numbered clauses in grotesk (test independently / publish first / refund + pay for the disputed test — all real policies from `copy.faq` & guarantee copy), a rule, then a mono signature block: `EAST COAST LABS · ABN [PENDING — owner input]` + a small repeat of the red stamp.
**Right — testimony:** real published reviews only (`getSiteAggregate` + a new `getRecentReviews(3)` accessor in `lib/reviews.ts` — server-only read of already-fetched published rows). Serif pull-quote typesetting, mono attribution `— VERIFIED BUYER · BPC-157 · JAN 2026`. **If fewer than 3 published reviews exist, the whole right column renders the aggregate + `Read all reviews` only.** Never a fabricated quote; layout degrades honestly.

### 07 / DISPATCH — logistics + subscribe + FAQ
Three mono-labelled columns over a hairline grid: DISPATCH (1-day AU, discreet statement copy from FAQ), SHIPPING ($150 threshold from `lib/env.ts`), CORRESPONDENCE (email capture: single underlined input + `Subscribe` — posts to existing `/api/subscribe`, source `variant_v2_home`; caption "Batch releases and restock notices. Nothing else."). Below: FAQ as an editorial two-col definition list (serif Q / grotesk A, `copy.faq`, no accordion on desktop — hiding answers hides trust; mobile keeps native `<details>`).

### Footer
Document colophon: four mono-labelled link columns, full RUO disclaimer in a bordered warn block (keep from v1 — compliance is non-negotiable), `© 2026 EAST COAST LABS · ABN [PENDING]`, and a final 1px rule at the very bottom edge. No dark band.

### Sticky mobile CTA
Keep the verified `StickyCta` mechanics (appears past hero); restyle: paper bg, top hairline, mono microcopy left, `Browse catalog` accent button right.

---

## 3. Conversion architecture (why this converts, mapped to principles)

1. **Message-match for cold traffic:** ad promise ("independently tested peptides") is proven within 1 second by the certificate artifact above the fold — the single highest-leverage trust transfer available to this store.
2. **One primary CTA per viewport**, always `Browse the catalog` / product-forward; secondary links are text-weight. No competing buttons.
3. **Evidence adjacency:** price never appears without proof nearby (specimen cards carry purity-linked SKU + stars; ledger sits directly above catalog).
4. **Price anchoring:** per-vial framing everywhere (`FROM $44.83/VIAL`), 6-pack anchor beneath — pulls AOV toward multi-packs (existing tier economics).
5. **Cognitive load:** 7 numbered chapters, one idea each; F-pattern left-anchored headings; data in tables (scannable) not prose.
6. **Honest scarcity only:** stock state as text, no timers, no fake urgency — calm is the premium signal in a scam-adjacent category.
7. **Friction:** cart drawer + checkout untouched (already verified working from `/1`); email capture is one field; no popups, no exit-intent on the variant.
8. **Speed budget:** LCP ≤ 2.0s on the hero H1 (text = instant), certificate renders server-side from local CSV fallback, fonts subset + swap, zero new JS libraries, ticker is pure CSS. Target Lighthouse ≥ 95 performance.
9. **Measurement continuity:** all existing GA4 events + `variant` cookie continue untouched; add `select_content` event on certificate `Verify with lab ↗` clicks (it's the trust-engagement leading indicator).

---

## 4. Implementation map

```
app/(variant)/1/page.tsx            ← rebuilt (same data calls + getSettings, new render tree)
app/(variant)/layout.tsx            ← .theme-light → .theme-paper; fonts via next/font; header/footer v2
app/globals.css                     ← add .theme-paper tokens + dossier utilities (section-rule,
                                       ticker keyframes, stamp, count-up, square stars); keep .theme-light
                                       until v2 lands, then delete
components/variant/v2/
  MastheadStrip.tsx  DossierHeader.tsx  CertificateCard.tsx  Chromatogram.tsx  StampSeal.tsx
  BatchTicker.tsx  LedgerTable.tsx  SpecimenCard.tsx  CatalogSection.tsx (client filter tabs)
  MethodRule.tsx  ProtocolCard.tsx  ContractPanel.tsx  Testimony.tsx  DispatchGrid.tsx
  DossierFooter.tsx  SquareStars.tsx
lib/reviews.ts                      ← + getRecentReviews(n) (published rows, server-only)
lib/fonts.ts                        ← Newsreader / Inter / IBM Plex Mono exports
```

Deleted after v2 verified: `components/variant/{VariantHeader,VariantFooter,TrustStrip,MetricsBand}.tsx` (StickyCta restyled, kept). Control page, ProductCard, StackCard, cart, checkout: **untouched.**

### Phases & acceptance criteria

**P1 — System (≈1.5h):** fonts, `.theme-paper`, dossier utilities, DossierHeader/Footer, masthead.
✓ `/1` renders paper shell, serif/mono loading (network shows 3 subset woff2), control `/` byte-identical, `tsc` clean.

**P2 — The Claim + Ledger (≈2h):** hero, CertificateCard (chromatogram, stamp, real COA links), ticker, ledger table.
✓ Certificate shows real batch data + working verify/PDF links; ticker 60fps & pauses on hover; count-up respects reduced-motion; screenshots desktop+mobile.

**P3 — Catalog + Protocols (≈2h):** SpecimenCard grid, filter tabs, ProtocolCard, sticky CTA restyle.
✓ 8 real products with real pricing/ratings; filters re-render without navigation; protocol add-to-cart → drawer opens with correct line + GA4 event; no emoji anywhere on page (`rg` the rendered HTML).

**P4 — Contract + Dispatch + polish (≈1.5h):** contract/testimony, dispatch grid, FAQ, review-thin fallback verified, motion pass, a11y pass (focus rings, contrast, aria on ticker `aria-hidden` duplicate).
✓ Reviews section renders honestly with current (empty) review table; email capture posts 200; keyboard nav clean.

**P5 — Verification gate (≈1h):** full-page screenshots both breakpoints, Lighthouse (perf ≥95, a11y ≥95), 5× route-stability curl, cart→checkout smoke from `/1`, cookie first-touch re-test, control-page diff (zero visual change), then commit.

Total: ~8h focused build. Owner inputs still wanted (non-blocking, sections degrade honestly without them): ABN, real business-scale numbers if any metrics are ever to be claimed, WELCOME15 confirmation before the email incentive is mentioned.

---

## 5. What I need from you before build

1. **Approve the design direction** ("Dossier" — paper/serif/mono/certificate-led) or redirect.
2. Optional: any brand assets I don't know about (a proper logo SVG, product renders on neutral background, real HPLC charts) — each upgrades a section, none blocks it.
