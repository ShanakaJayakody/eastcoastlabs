# BASELINE — East Coast Labs Commerce Metrics

**Baseline Period:** 90 days ending 2026-07-21  
**Recorded:** 2026-07-21  
**Purpose:** Establish pre-upgrade baseline for measuring the ECOM Upgrade Plan impact.  
**Target comparison:** 90 days post-Phase-2 launch

> ⚠️ **This file contains [PLACEHOLDER] values to be filled from staging data.**  
> Source query for each metric is documented inline.

---

## Orders & Revenue

| Metric | Value | Source Query |
|---|---|---|
| Total orders (90d) | [PLACEHOLDER] | `wp wc shop_order list --period=last90days --fields=id --format=count` |
| Gross revenue (90d) | [PLACEHOLDER] | `wp wc shop_order list --period=last90days --fields=total --format=json | jq '[.[] | tonumber] | add'` |
| Net revenue (90d) | [PLACEHOLDER] | Same as gross, minus refunded orders |
| Average order value | [PLACEHOLDER] | `net_revenue / total_orders` |

**Notes:**
- Gross revenue includes all orders regardless of status
- Net revenue excludes refunded and cancelled orders
- AOV calculated from net revenue for accuracy

---

## Conversion

| Metric | Value | Source |
|---|---|---|
| Sessions (90d) | [PLACEHOLDER] | MonsterInsights / GA4 — document source if available |
| Conversion rate | [PLACEHOLDER] | `total_orders / sessions` |
| Note | Sessions not available in WooCommerce Analytics natively | Pull from GA4 or MonsterInsights |

**Notes:**
- WooCommerce Analytics does not track sessions natively
- Use Google Analytics 4 (GA4) or MonsterInsights if available
- Document if session data is unavailable and use alternative proxy

---

## Customer Behavior

| Metric | Value | Source Query |
|---|---|---|
| Unique customers (90d) | [PLACEHOLDER] | `wp wc shop_order list --period=last90days --fields=customer_id --format=json | jq '[.[] | select(. != 0)] | unique | length'` |
| Repeat customers (2+ orders) | [PLACEHOLDER] | SQL query needed — see below |
| Repeat purchase rate | [PLACEHOLDER] | `repeat_customers / unique_customers` |

**SQL Query for Repeat Customers:**
```sql
SELECT customer_id, COUNT(*) as order_count
FROM wp_posts
WHERE post_type = 'shop_order'
  AND post_status IN ('wc-completed', 'wc-processing')
  AND post_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
GROUP BY customer_id
HAVING COUNT(*) > 1;
```

**Notes:**
- Guest orders (customer_id = 0) excluded from unique customer count
- Repeat customers defined as those with 2+ completed orders in 90-day period

---

## Revenue per SKU

| Product | SKU | Units Sold | Revenue | % of Total |
|---|---|---|---|---|
| BPC-157 | BPC157 | [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] |
| TB-500 | TB500 | [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] |
| BPC-157/TB-500 Blend | BPC157-TB500 | [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] |
| CJC-1295 | CJC1295 | [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] |
| CJC-1295/Ipamorelin | CJC-IPA | [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] |
| Ipamorelin | IPA | [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] |
| Epithalon | EPITH | [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] |
| Selank | SELANK | [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] |
| Semax | SEMAX | [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] |
| MGF | MGF | [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] |
| PT-141 | PT141 | [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] |
| GHK-Cu | GHKCU | [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] |
| KPV | KPV | [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] |
| PEA | PEA | [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] |
| Bacteriostatic Water | BAC-WATER | [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] |

**Source Query:**
```bash
# Get all line items from orders in the 90-day period
wp wc shop_order list --period=last90days --fields=line_items --format=json | \
  jq '[.[] | .line_items[] | {name, sku, quantity, total}] | group_by(.sku) | 
      map({sku: .[0].sku, name: .[0].name, units: (map(.quantity) | add), revenue: (map(.total | tonumber) | add)})'
```

**Notes:**
- Revenue per SKU helps identify top performers and underperformers
- Use for merchandising decisions and bundle strategy

---

## Cart Abandonment Proxy

| Metric | Value | Source |
|---|---|---|
| Carts initiated (90d) | [PLACEHOLDER] | GA4 `begin_checkout` events |
| Carts completed | [PLACEHOLDER] | = Total orders (from Orders & Revenue section) |
| Abandonment proxy rate | [PLACEHOLDER] | `1 - (completed / initiated)` |

**Notes:**
- WooCommerce does not track cart initiation natively
- Use GA4 `begin_checkout` event as proxy
- If GA4 unavailable, document gap and use alternative approach

---

## KPI Targets (90 days post-Phase-2 launch)

| KPI | Baseline | Target | Change | Methodology |
|---|---|---|---|---|
| Average Order Value | [PLACEHOLDER] | +25% | [PLACEHOLDER] | Compare 90d post-launch vs 90d baseline |
| Repeat Purchase Rate | [PLACEHOLDER] | +30% | [PLACEHOLDER] | Compare 90d post-launch vs 90d baseline |
| Conversion Rate | [PLACEHOLDER] | +15% | [PLACEHOLDER] | Compare 90d post-launch vs 90d baseline |

**Target Calculation Notes:**
- AOV +25%: Target = Baseline × 1.25
- Repeat Rate +30%: Target = Baseline × 1.30  
- Conversion +15%: Target = Baseline × 1.15

---

## Notes & Gaps

### Data Availability
- [ ] WooCommerce Analytics configured and collecting data
- [ ] Google Analytics 4 (GA4) installed and tracking sessions
- [ ] MonsterInsights or alternative GA4 integration available
- [ ] Direct database access for SQL queries if needed

### Known Gaps
1. **Sessions data:** Not available in WooCommerce Analytics natively — requires GA4 or MonsterInsights
2. **Cart initiation:** Not tracked by WooCommerce — requires GA4 `begin_checkout` event
3. **Guest customers:** Cannot be tracked for repeat purchase analysis without email-based matching

### Methodology Notes
- All metrics use 90-day rolling windows to smooth weekly variations
- Revenue metrics exclude refunds/cancellations for accuracy
- Repeat customer analysis uses customer_id only (guests excluded)
- Post-launch comparison uses same 90-day duration as baseline

### Data Collection Commands

**Export all baseline data in one command:**
```bash
# Orders & Revenue
wp wc shop_order list --period=last90days --fields=id,total,status --format=json > baseline_orders.json

# Customer IDs
wp wc shop_order list --period=last90days --fields=customer_id --format=json > baseline_customers.json

# Line Items (SKU data)
wp wc shop_order list --period=last90days --fields=line_items --format=json > baseline_lineitems.json
```

---

## Baseline Validation Checklist

- [ ] All [PLACEHOLDER] values filled with actual data
- [ ] Source queries tested on staging environment
- [ ] Session data source confirmed (GA4 or alternative)
- [ ] Cart initiation tracking confirmed (GA4 or alternative)
- [ ] SQL query for repeat customers tested
- [ ] SKU revenue table populated
- [ ] KPI targets calculated from baseline values
- [ ] Data collection date documented
- [ ] Any gaps or limitations noted above

---

*This baseline file serves as the pre-intervention reference point. All post-Phase-2 metrics will be compared against these values using identical methodology and measurement windows.*
