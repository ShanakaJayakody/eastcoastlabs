# Homepage + PDP Copy Deck — Phase 4.5

> Ready-to-paste copy for the human to assemble in Elementor.
> All copy is compliance-checked (research-use-only framing, no benefit claims).

---

## Homepage Copy

### Hero Section

**H1:** Research peptides. Explore the catalogue.

**Subheadline:** Browse compounds, compare current pack prices and check available batch documentation.

**CTAs:**
- Primary: [Shop bestsellers](/shop/)
- Secondary: [See latest batch results →](/lab-results/)

---

### Live Batch Proof Strip

*(Rendered automatically via `[ecl_proof_strip]` shortcode)*

Copy for surrounding context:

**Section heading:** Latest batch results — updated with every restock

**Supporting text:** Available certificates appear on the Lab Results page after the document has been verified.

---

### Bestsellers Section

**Section heading:** Featured research peptides

**Section intro:** Compare current single-vial and available pack prices.

| Product | Per-vial price (6-pack) | From |
|---------|------------------------|------|
| Tesamorelin | $78.67/vial | $472 (6-pack) |
| MOTS-C | $52.33/vial | $314 (6-pack) |
| Semax | $44.83/vial | $269 (6-pack) |
| Selank | $48.67/vial | $292 (6-pack) |

*CTA per card: [View pack options →](/shop/<slug>/)*

---

### How Testing Works (tightened 4-step strip)

**Step 1 — Find the compound**
Open the product page and check its available pack options.

**Step 2 — Find the document**
Check the available certificates on the Lab Results page.

**Step 3 — Match the batch**
Match the compound name and batch identifier to your product.

**Step 4 — Review the source**
Read the original lab document. Contact support before ordering if a document is unavailable.

---

### Restock Program Promo

**Heading:** Restock alerts

**Body:** Join the mailing list for product availability and new compound updates. Purchases are one-time orders.

---

### FAQ Section

**Q: Where can I find batch documentation?**
Check available verified documents on the Lab Results page. If a certificate is unavailable, contact support before ordering.

**Q: When does dispatch begin?**
Orders are prepared after payment confirmation. Shipping options and estimated delivery times appear at checkout.

**Q: How do I pay?**
Select an available bank transfer method at checkout. The payment page provides the exact amount and order reference after you place the order.

**Q: Do you offer pack pricing?**
Available packs and current per-vial prices appear on each product page. Pack availability depends on stock.

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
