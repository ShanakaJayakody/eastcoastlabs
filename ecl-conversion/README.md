# ECL Conversion Plugin

**Version:** 1.0.0  
**Author:** East Coast Labs  
**Requires:** WordPress 6.0+, PHP 8.0+, WooCommerce 8.0+

Custom WooCommerce conversion optimisation plugin for eastcoastlabs.com.au. Built per the ECOM_UPGRADE_PLAN.md specification.

## Quick Install

See [INSTALL.md](INSTALL.md) for the full step-by-step.

```bash
# 1. Upload to wp-content/plugins/ecl-conversion/
# 2. Activate via WP-CLI or WP Admin
wp plugin activate ecl-conversion

# 3. Run the product conversion (on staging!)
wp ecl convert-products --dry-run    # preview first
wp ecl convert-products              # then for real

# 4. Import COA data
wp ecl import-coa

# 5. Set cross-sells
wp ecl set-cross-sells

# 6. Create WELCOME15 coupon + Bulk Packs page
wp ecl create-welcome15
wp ecl create-bulk-packs

# 7. Scan for consistency issues
wp ecl scan-consistency
```

## Module Overview

| Module | Phase | Description |
|--------|-------|-------------|
| `ECL_Stock_Status` | 0.3 | Real per-product stock status line (replaces hardcoded "ships today") |
| `ECL_Consistency` | 0.4-0.7 | Auto-fix + scan for purity/dispatch/email/coupon consistency issues |
| `ECL_COA_Module` | 1.2 | Per-PDP COA verification module (batch ID, purity, lab links) |
| `ECL_Guarantee` | 1.3 | Purity guarantee block ("we cover the test") |
| `ECL_Checkout_Trust` | 1.5 | Checkout gateway explanation + statement descriptor + security signals |
| `ECL_Bac_Water` | 2.3 | Bac-water attach checkbox + 6-pack free gift + curated cross-sells |
| `ECL_Free_Shipping` | 2.4 | Free shipping at $150 + progress notice with AJAX update |
| `ECL_Restock` | 3 | Subscribe & Save toggle + reminder-based fallback + Bulk Packs page |
| `ECL_Sticky_ATC` | 4.1 | Sticky add-to-cart bar (IntersectionObserver, mobile-first) |
| `ECL_Announcement` | 4.2 | Dismissible announcement bar above header |
| `ECL_CTA_Strip` | 4.4 | Final CTA strip with per-vial price from 6-pack |
| `ECL_GA4_Events` | 6.2 | GA4 ecommerce event verification + fallback gtag |

## Settings

All module settings are managed at **WooCommerce → ECL Conversion** in WP Admin, or via `wp option`:

```bash
wp option update ecl_settings '{"purity_pct":"98","free_shipping_threshold":150,"statement_descriptor":"EAST COAST LABS","support_email":"eclpeptides@gmail.com"}' --format=json
```

## WP-CLI Commands

| Command | Description |
|---------|-------------|
| `wp ecl convert-products` | Convert simple products to variable with 1/3/6 vial tiers |
| `wp ecl import-coa` | Import COA data from `data/coa-seed.csv` |
| `wp ecl scan-consistency` | Scan DB for trust/consistency issues |
| `wp ecl set-cross-sells` | Apply curated cross-sell mappings |
| `wp ecl create-welcome15` | Create WELCOME15 coupon |
| `wp ecl create-bulk-packs` | Create Bulk Packs collection page |

## File Structure

```
ecl-conversion/
├── ecl-conversion.php                    # Main plugin file + settings page
├── uninstall.php
├── includes/
│   ├── class-ecl-stock-status.php        # Phase 0.3
│   ├── class-ecl-consistency.php         # Phase 0.4-0.7
│   ├── class-ecl-coa-module.php          # Phase 1.2
│   ├── class-ecl-guarantee.php           # Phase 1.3
│   ├── class-ecl-checkout-trust.php      # Phase 1.5
│   ├── class-ecl-bac-water.php           # Phase 2.3
│   ├── class-ecl-free-shipping.php       # Phase 2.4
│   ├── class-ecl-restock.php             # Phase 3
│   ├── class-ecl-sticky-atc.php          # Phase 4.1
│   ├── class-ecl-announcement.php        # Phase 4.2
│   ├── class-ecl-cta-strip.php           # Phase 4.4
│   └── class-ecl-ga4-events.php          # Phase 6.2
├── assets/
│   ├── css/ecl-conversion.css            # All module styles
│   └── js/
│       ├── ecl-tier-cards.js             # Tier card radio selector + variation sync
│       ├── ecl-sticky-atc.js             # Sticky bar IntersectionObserver
│       └── ecl-announcement.js           # Announcement bar dismiss
├── cli/
│   └── class-ecl-cli-commands.php        # WP-CLI commands
├── data/
│   ├── coa-seed.csv                      # COA batch data (14 compounds)
│   ├── price-table.json                  # 1/3/6-vial tier pricing
│   └── cross-sells.json                  # Curated cross-sell mappings
├── templates/
│   ├── coa-module.php                    # COA module template
│   ├── guarantee-block.php               # Guarantee block template
│   └── sticky-atc-bar.php                # Sticky ATC template
└── docs/
    ├── COMPLIANCE.md
    ├── INSTALL.md
    └── JUDGE_ME_SETUP.md
```

## Compliance

**This plugin operates on a research-use-only peptide store.** All copy, hooks, and generated content preserve "research use only" framing. See [COMPLIANCE.md](COMPLIANCE.md) for the full guardrail list.

Never use in any output:
- "month supply" or dosing language
- Health benefit or effect claims
- Before/after imagery
- Human consumption implications

Always frame as: vials, packs, restocking, lab supplies, research.
