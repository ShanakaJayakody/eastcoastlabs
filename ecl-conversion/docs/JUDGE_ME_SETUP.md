# Judge.me Setup Guide — Phase 1.1

## Overview

Judge.me for WooCommerce replaces native WooCommerce reviews with:
- Verified-buyer badges
- Photo reviews
- Aggregate star widgets (on shop cards + PDP)
- Automatic post-purchase review request emails
- Moderation queue with rules

## Installation

### [HUMAN] Install the plugin

1. Go to **WP Admin → Plugins → Add New**
2. Search for "Judge.me for WooCommerce" (free) or "Judge.me" (premium)
3. Install and activate
4. Connect your Judge.me account (create one at judge.me if needed)

### Import existing reviews

```bash
# Export the 2 existing WooCommerce reviews:
wp eval '
$reviews = get_comments(array("type" => "review", "status" => "approve"));
foreach ($reviews as $r) {
    echo $r->comment_post_ID . "|" . $r->comment_author . "|" . $r->comment_date . "|" . $r->comment_content . "\n";
}
'
```

Import these into Judge.me via the admin dashboard: **Judge.me → Import Reviews → From CSV**.

---

## Configuration

### Review Request Email (Phase 1.1 spec)

| Setting | Value |
|---------|-------|
| **Trigger** | 14 days after order is delivered/completed |
| **Subject** | How was your order from East Coast Labs? |
| **Timing** | 14 days after fulfillment (gives time for delivery + independent testing) |
| **Photo reviews** | Enabled |
| **Verified buyer badge** | Enabled |
| **Review form questions** | Dispatch speed, packaging/discretion, COA verification, independent testing |

**Review request email copy:**

```
Subject: How was your order from East Coast Labs?

Hi {{first_name}},

Your order from East Coast Labs was delivered about two weeks ago. We'd love to hear about your experience.

We're specifically interested in:
• Dispatch speed — did your order arrive when expected?
• Packaging — was it discreet and secure?
• COA verification — did you check your batch against our published results?
• Independent testing — if you tested independently, what did you find?

Leave a review: {{review_link}}

Every review helps other researchers make informed decisions. Honest feedback only — we never edit or remove reviews based on rating.

— East Coast Labs
```

### Moderation Rule (CRITICAL)

**Add this note to the Judge.me moderation settings / staff documentation:**

> **MODERATION RULE — HARD POLICY**
>
> Never publish reviews that describe:
> - Human use, consumption, or administration of products
> - Therapeutic effects, results, or outcomes ("it helped my...", "I felt...")
> - Dosing information ("I used X mg...")
> - Before/after descriptions of personal effects
>
> **Approve only reviews about:**
> - Dispatch speed and delivery
> - Packaging quality and discretion
> - COA verification experience
> - Independent lab testing results
> - Customer service interactions
>
> If a review describes human use, mark it as "rejected" and do not contact the customer about it. This is a legal compliance requirement, not a quality filter.

### Widget Placement

Configure Judge.me widgets:

1. **Star badge on shop cards**: Enable in Judge.me settings → "Product Badges"
2. **Review feed on PDP**: Enable "Review Widget" → place it via hook or shortcode
3. **Aggregate rating in PDP title area**: Use the Judge.me "Star Rating" snippet

To add the review widget to PDPs via the plugin:

```php
// In ecl-conversion, add to the COA module priority area:
add_action( 'woocommerce_single_product_summary', function() {
    echo do_shortcode('[jgm-product-rating]');
}, 8 ); // Before price
```

### Review Volume Seeding

Email past customers a one-time review request:

```bash
# Export all past customers:
wp wc customer list --fields=id,email,first_name --format=csv > customers.csv
```

Send via Klaviyo or manually with this copy:

```
Subject: Share your experience — and get 10% off your next order

Hi {{first_name}},

You've ordered from East Coast Labs before, and we'd value your honest review.

Share your experience with dispatch, packaging, COA verification, or independent testing:
{{review_link}}

As thanks, we'll send you a 10% off code for your next order — for any honest review, positive or critical.

— East Coast Labs
```

**Incentive rule**: reward for *reviewing* (any honest review), never for *positive* reviews. This complies with review platform policies and builds genuine trust.

---

## Rich Results / Schema

Once at least 1 Judge.me review exists:

1. Judge.me automatically adds `aggregateRating` to the product JSON-LD schema
2. Verify with [Google Rich Results Test](https://search.google.com/test/rich-results)
3. Test URL: `https://eastcoastlabs.com.au/shop/<product-slug>/`
4. Expected: `aggregateRating` with `ratingValue` and `reviewCount`

If Judge.me schema doesn't appear:
- Check **Judge.me → Settings → SEO** → enable "Product Rich Snippets"
- Verify Rank Math isn't conflicting (Rank Math → General Settings → Schema → ensure Product schema is enabled and Judge.me hooks into it)

---

## Compliance Checklist

- [ ] Moderation rule documented and shared with all staff who approve reviews
- [ ] Review request email mentions service/logistics/testing angles only
- [ ] No review request copy implies product efficacy
- [ ] Past-customer review incentive is for "any honest review", not "positive review"
- [ ] aggregateRating appears in Rich Results test once reviews exist
