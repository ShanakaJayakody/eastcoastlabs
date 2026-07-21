# Installation Guide — ecl-conversion + hello-elementor-child

## Prerequisites

- WordPress 6.0+ on **staging** (NOT production)
- WooCommerce 8.0+
- Hello Elementor theme (parent)
- Full backup taken (UpdraftPlus or host snapshot)
- WP-CLI access via SSH, or WooCommerce REST API with application password

---

## Step 1: Upload and Activate

### Upload the child theme

```bash
# From your local machine:
rsync -avz hello-elementor-child/ user@staging:/path/to/wp-content/themes/hello-elementor-child/

# Or zip and upload via WP Admin:
zip -r hello-elementor-child.zip hello-elementor-child/
# Then: WP Admin → Appearance → Themes → Add New → Upload
```

### Upload the plugin

```bash
rsync -avz ecl-conversion/ user@staging:/path/to/wp-content/plugins/ecl-conversion/

# Or zip and upload:
zip -r ecl-conversion.zip ecl-conversion/
```

### Activate

```bash
wp theme activate hello-elementor-child
wp plugin activate ecl-conversion
```

---

## Step 2: Configure Settings

Go to **WP Admin → WooCommerce → ECL Conversion** and set:

| Setting | Value |
|---------|-------|
| Purity Guarantee (%) | `98` (or `99` if all COA data supports it) |
| Free Shipping Threshold ($) | `150` |
| Bacteriostatic Water Product ID | [find via `wp wc product list --fields=id,name \| grep Bacteriostatic`] |
| Bank Statement Descriptor | `EAST COAST LABS` (confirm with Bankful) |
| Support Email | `support@eastcoastlabs.com.au` |
| Announcement Bar Text | `Free shipping over $150 · Every batch independently tested → See lab results` |
| Announcement Bar Link | `/lab-results/` (or `/coa/` until renamed) |

---

## Step 3: Rename COA Page

```bash
# Rename the /coa/ page to /lab-results/ with "Lab Results 🔬" title
wp post update $(wp post list --post_type=page --name=coa --field=ID) \
    --post_title='Lab Results 🔬' \
    --post_name='lab-results'
```

Update the nav menu item to point to the new slug.

---

## Step 4: Convert Products (Phase 2)

⚠️ **Run on staging only. Verify before pushing to production.**

```bash
# Preview the changes first:
wp ecl convert-products --dry-run

# If the preview looks correct, run for real:
wp ecl convert-products
```

This will:
- Remove fake sale prices from all 14 peptide products
- Set regular price = current sale price (the true price)
- Convert each to a variable product with "Pack Size" attribute
- Create 3 variations: 1 vial, 3 vials, 6 vials
- Apply correct tier pricing from `data/price-table.json`
- Set 3-pack as default selection (MOST POPULAR)
- Apply curated cross-sells

**Verify after conversion:**
```bash
# Check a sample product:
wp wc product list --fields=id,name,type,price | grep BPC

# Verify variation prices:
wp wc product_variation list <product_id> --fields=id,sku,regular_price,sale_price
```

---

## Step 5: Import COA Data (Phase 1.2)

```bash
wp ecl import-coa
```

This imports batch/purity/lab data from `data/coa-seed.csv` into each product's `_ecl_coa` meta field. The COA module will then render on every PDP automatically.

**To update the seed data**, edit `data/coa-seed.csv` before importing, or import a different file:
```bash
wp ecl import-coa --file=/path/to/updated-coa.csv
```

---

## Step 6: Set Cross-Sells + Create Pages

```bash
# Apply curated cross-sell mappings:
wp ecl set-cross-sells

# Create WELCOME15 coupon:
wp ecl create-welcome15

# Create Bulk Packs collection page:
wp ecl create-bulk-packs
```

---

## Step 7: Scan for Consistency Issues (Phase 0)

```bash
wp ecl scan-consistency
```

This scans the entire database for:
- Purity claim conflicts (≥99% vs ≥98%)
- Dispatch claim conflicts (24h vs 1 business day)
- Gmail address references (`eclpeptides@gmail.com`)
- Old coupon code (`WELCOME!`)
- Fake testimonial names in Elementor data

Auto-fixable items are fixed in post content on display. Elementor-stored issues are **reported only** and require manual editing in the Elementor editor.

---

## Step 8: Configure Free Shipping Zone (Phase 2.4)

In **WP Admin → WooCommerce → Settings → Shipping → Australia**:

1. Add a **Free Shipping** method
2. Set minimum order amount = `150`
3. Set the method title to "Free Standard Shipping"

For 6-pack free Express Post (handled automatically by the plugin):
- The plugin hooks `woocommerce_package_rates` and makes Express free when a 6-pack is in cart
- Ensure an "Express Post" shipping method exists in the zone

---

## Step 9: Remove Fake Testimonials (Phase 0.5)

The plugin scans for and reports these testimonial names in Elementor data:
- Sarah Johnson
- Michael Chen
- Emma Williams
- Daniel Lee
- Olivia Brown
- James Martinez

These are stored in Elementor JSON and **must be removed manually**:
1. Open the homepage in Elementor editor
2. Find and delete the testimonial widgets containing these names
3. Especially remove the "rotator cuff / KLOW" testimonial (human-use implication)
4. Replace with the `[ecl_proof_strip]` shortcode for the COA proof module

---

## Step 10: Configure Judge.me (Phase 1.1)

See [JUDGE_ME_SETUP.md](JUDGE_ME_SETUP.md) for detailed setup instructions.

---

## Step 11: Set Up About Page (Phase 1.4)

The About page content is provided in `docs/ABOUT_PAGE_COPY.md` (or root `docs/` directory).

```bash
# Create the About page:
wp post create --post_type=page --post_title='About' --post_status=publish --post_name=about --post_content="$(cat docs/ABOUT_PAGE_COPY.md)"
```

Or paste the content manually via **WP Admin → Pages → Add New** (use a Classic block, not Elementor).

---

## Verification Checklist

After completing all steps, verify on staging:

- [ ] Homepage: announcement bar visible above header
- [ ] Homepage: testimonial section removed, proof strip visible
- [ ] PDP: tier cards render with 3-pack pre-selected
- [ ] PDP: COA module shows batch ID + purity + lab links
- [ ] PDP: guarantee block under COA
- [ ] PDP: bac-water attach checkbox under ATC
- [ ] PDP: sticky ATC bar appears on scroll
- [ ] PDP: final CTA strip at bottom with per-vial price
- [ ] Cart: free shipping progress notice shows at < $150
- [ ] Cart: 6-pack auto-adds free bac water
- [ ] Checkout: trust block with gateway explanation + descriptor
- [ ] Checkout: restock reminder opt-in checkbox
- [ ] Thank-you page: restock reminder saved
- [ ] `/about/` returns 200
- [ ] `/bulk-packs/` returns 200
- [ ] `/lab-results/` (renamed from /coa/) returns 200
- [ ] No instances of "WELCOME!", "eclpeptides@gmail.com", "ships today", "24h ship"

---

## Push to Production

Only after all staging verification passes:

1. Take a fresh production backup
2. Upload the same plugin + child theme files
3. Run the same WP-CLI commands on production
4. Verify the same checklist items on production

**Never edit production directly.** Always stage → verify → deploy.
