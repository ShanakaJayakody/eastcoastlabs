# Homepage + PDP Copy Deck — Phase 4.5

> Ready-to-paste copy for the human to assemble in Elementor.
> All copy is compliance-checked (research-use-only framing, no benefit claims).

---

## Homepage Copy

### Hero Section

**H1:** Lab-grade peptides. Independently tested. Proof published.

**Subheadline:** Every vial tested by JanoShik with the COA published before it ships. Australian owned, dispatched in 1 business day.

**CTAs:**
- Primary: [Shop bestsellers](/shop/)
- Secondary: [See latest batch results →](/lab-results/)

---

### Live Batch Proof Strip

*(Rendered automatically via `[ecl_proof_strip]` shortcode)*

Copy for surrounding context:

**Section heading:** Latest batch results — updated with every restock

**Supporting text:** We test every batch through JanoShik, an independent laboratory. Purity results are published on our site before products are listed. No exceptions.

---

### Bestsellers Section

**Section heading:** Bestselling research peptides

**Section intro:** Our most-ordered compounds, with per-vial savings when you buy in 3 or 6-vial packs.

| Product | Per-vial price (6-pack) | From |
|---------|------------------------|------|
| Tesamorelin | $78.67/vial | $472 (6-pack) |
| MOTS-C | $52.33/vial | $314 (6-pack) |
| Semax | $44.83/vial | $269 (6-pack) |
| Selank | $48.67/vial | $292 (6-pack) |

*CTA per card: [View pack options →](/shop/<slug>/)*

---

### How Testing Works (tightened 4-step strip)

**Step 1 — Synthesise**  
Compounds are synthesised and each batch assigned a unique batch ID.

**Step 2 — Test independently**  
Every batch is sent to JanoShik, an independent laboratory, for purity analysis.

**Step 3 — Publish results**  
COA results are published on our Lab Results page before the product is listed for sale. If purity is below standard, the batch doesn't ship.

**Step 4 — Verify yourself**  
Every order includes a COA. You can verify your batch independently using the JanoShik verification link, or send it to any lab of your choice. If they find it below our purity guarantee, we cover the test.

---

### Restock Program Promo

**Heading:** Never run out of lab supplies

**Body:** Set up automatic restocks and save 10% on every order. Delivery frequency is based on your pack size — 1 vial every 4 weeks, 3-pack every 12 weeks, 6-pack every 24 weeks. Pause, skip, or cancel anytime. No lock-in.

**CTA:** [Learn about the Restock Program →](/bulk-packs/)

---

### FAQ Section

**Q: Are these products tested?**  
Every batch is independently tested by JanoShik. Results are published on our Lab Results page before products are listed. Every order ships with a COA.

**Q: How fast is dispatch?**  
Orders placed before 3:30pm AEST are dispatched the same business day. All orders ship from Australia.

**Q: What's on my card statement?**  
You'll see "EAST COAST LABS" on your card statement. No product names appear. Billing is discreet.

**Q: Do you offer bulk pricing?**  
Yes. Every peptide is available in 1-vial, 3-pack, and 6-pack options. The more you buy, the less you pay per vial. See our Bulk Packs page for details.

**Q: What if my batch fails an independent test?**  
If any independent lab test shows your batch below our purity guarantee, we refund or replace it — and we cover the cost of the test. One email: eclpeptides@gmail.com.

---

### Email Capture / Popup

**Popup headline:** 15% off your first order

**Popup body:** Get 15% off your first order of research-grade peptides. Every batch independently tested, COA included with every shipment.

**CTA:** [Get my code]

**Code:** WELCOME15 (auto-applied on click)

**Trigger:** Exit-intent + 8-second delay. Suppressed for existing subscribers and on cart/checkout pages.

---

## PDP Blueprint — Section Order (Phase 4.1)

The `ecl-conversion` plugin reorders WooCommerce hooks to achieve this sequence automatically:

| # | Section | Hook / Module |
|---|---------|---------------|
| 1 | Announcement bar | `wp_body_open` → `ECL_Announcement` |
| 2 | Buy box (gallery, title, tier cards, ATC) | WooCommerce core + `ECL_Sticky_ATC` |
| 3 | Guarantee microcopy under ATC | `ecl_render_guarantee_microcopy()` |
| 4 | Trust icon row | *(Elementor — HUMAN adds)* |
| 5 | COA verification module | `woocommerce_single_product_summary:15` → `ECL_COA_Module` |
| 6 | Guarantee block | `woocommerce_single_product_summary:20` → `ECL_Guarantee` |
| 7 | Bac-water attach checkbox | `woocommerce_after_add_to_cart_button` → `ECL_Bac_Water` |
| 8 | Restock toggle (Phase 3) | `woocommerce_after_add_to_cart_button:5` → `ECL_Restock` |
| 9 | Stock status line | `woocommerce_single_product_summary:10` → `ECL_Stock_Status` |
| 10 | Description (rewritten) | WooCommerce core |
| 11 | Lab Results tab | `woocommerce_product_tabs:98` → `ECL_COA_Module` |
| 12 | Curated cross-sells | `ECL_Bac_Water::set_curated_cross_sells()` |
| 13 | Judge.me review feed | Judge.me plugin widget |
| 14 | Final CTA strip | `woocommerce_after_single_product_summary:30` → `ECL_CTA_Strip` |
| 15 | Sticky ATC bar | `ECL_Sticky_ATC` (IntersectionObserver) |

---

## Trust Icon Row Copy

*(Elementor section — HUMAN assembles)*

- 🔬 **Independent COA every batch** — Tested by JanoShik before listing
- ✓ **≥98% purity verified** — Every batch, every product
- 📦 **1-business-day dispatch** — Ships from Australia
- 🤐 **Discreet packaging & billing** — No product names on your statement

---

## Guarantee Microcopy (under every ATC)

🛡️ Purity guaranteed — we cover the test. 1-business-day dispatch.

---

## CartFlows Order Bump Configuration (Phase 2.5)

Configure in CartFlows → Checkout Flow → Order Bump:

| Setting | Value |
|---------|-------|
| **Product** | Bacteriostatic Water (10mL) |
| **Price** | $19.99 |
| **Headline** | Don't forget reconstitution supplies |
| **Description** | Bacteriostatic Water (10mL) — required for reconstitution. Add it now and save a separate order. |
| **Trigger** | Show if Bacteriostatic Water is NOT already in cart |
| **Discount** | None (already at best price) |

Alternative order bump:
| Setting | Value |
|---------|-------|
| **Product** | Same peptide, 1 additional vial |
| **Price** | 10% off single-vial price |
| **Headline** | Add a 2nd vial — 10% off |
| **Description** | Stock up while you're here. One extra vial at 10% off. |
| **Trigger** | Show when cart contains a 1-vial variant |
