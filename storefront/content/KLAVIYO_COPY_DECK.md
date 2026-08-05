# Klaviyo Email Flow Copy Deck — Phase 5

> All copy is compliance-checked (research-use-only framing).
> Emails reference logistics, purity testing, COA verification, and restocking only.
> Never usage, effects, dosing, or benefits.

---

## 1. Welcome Flow

### Email 1 — Immediate (code + differentiation)

**Subject:** Your 10% off code is inside ↓
**Preview:** Welcome to East Coast Labs — independently tested peptides, dispatched from Australia.

**Body:**

```
Hi {{ first_name||"there" }},

Here's your code:

    WELCOME10

Enter it at checkout for 10% off your first order.

We do things differently from most peptide suppliers. Here's what sets East Coast Labs apart:

• Every batch is independently tested by JanoShik before it's listed for sale
• Purity results are published on our Lab Results page — no exceptions
• Every order ships with a Certificate of Analysis (COA) included
• If any independent lab test shows your batch below our purity guarantee, we refund or replace it — and we cover the cost of the test

No fabricated reviews. No fake sale prices. No "limited time" pressure tactics. Just lab-grade peptides with proof published before they ship.

Start here: [Shop bestsellers →](https://eastcoastlabs.com.au/shop/)

— East Coast Labs
```

---

### Email 2 — +2 days (COA verification walkthrough)

**Subject:** How to verify your batch COA
**Preview:** Step-by-step: check any East Coast Labs batch independently.

**Body:**

```
Hi {{ first_name||"there" }},

Every East Coast Labs order ships with a Certificate of Analysis. But you don't have to take our word for it — here's how to verify any batch independently:

1. Find your batch ID
   It's on the COA included with your order and printed on the product page.

2. Check our published results
   Go to [Lab Results](https://eastcoastlabs.com.au/lab-results/) and search for your batch ID. You'll see the purity percentage, test date, and lab name (JanoShik).

3. Verify with the lab directly
   Each COA includes a JanoShik verification link. Click it to confirm the result on the lab's own system — not just our website.

4. Test independently (optional)
   You can send any vial to a lab of your choice. If they find it below our purity guarantee (≥98%), we refund or replace the order and cover the cost of your test.

That's it. Every batch, independently verifiable, before and after you order.

[See latest batch results →](https://eastcoastlabs.com.au/lab-results/)

— East Coast Labs
```

---

### Email 3 — +4 days (bestsellers + per-vial pricing)

**Subject:** Most-ordered peptides — with per-vial savings
**Preview:** Buy in 3 or 6-vial packs and save up to 25% per vial.

**Body:**

```
Hi {{ first_name||"there" }},

These are our most-ordered compounds. Every peptide is available in 1-vial, 3-pack, and 6-pack options — the more you buy, the less you pay per vial.

**Tesamorelin**
From $78.67/vial in 6-packs
[View pack options →](https://eastcoastlabs.com.au/shop/tesamorelin/)

**MOTS-C**
From $52.33/vial in 6-packs
[View pack options →](https://eastcoastlabs.com.au/shop/mots-c/)

**Semax**
From $44.83/vial in 6-packs
[View pack options →](https://eastcoastlabs.com.au/shop/semax/)

**Selank**
From $48.67/vial in 6-packs
[View pack options →](https://eastcoastlabs.com.au/shop/selank/)

6-packs also include free Bacteriostatic Water and free Express Post.

Remember: use code WELCOME10 for 10% off your first order.

[Shop all peptides →](https://eastcoastlabs.com.au/shop/)

— East Coast Labs
```

---

## 2. Abandoned Cart Flow

### Email 1 — 1 hour after abandonment

**Subject:** Your cart is saved at East Coast Labs
**Preview:** Dispatch cutoff is 3:30pm AEST — order before then for same-business-day dispatch.

**Body:**

```
Hi {{ first_name||"there" }},

Your cart is still saved. Here's what's waiting:

{{ items.list }}

Order before 3:30pm AEST and your order dispatches the same business day. Free standard shipping on orders over $150.

[Complete your order →]({{ cart.url }})

Every order ships with an independent COA. Purity guaranteed — we cover the test.

— East Coast Labs
```

---

### Email 2 — 24 hours after abandonment

**Subject:** Still thinking it over? Here's what to check first.
**Preview:** How to verify any East Coast Labs batch before you order.

**Body:**

```
Hi {{ first_name||"there" }},

No pressure — but if you're deciding, here's how to vet us before you order:

• Check our published lab results: [eastcoastlabs.com.au/lab-results](https://eastcoastlabs.com.au/lab-results/)
• Every batch is tested by JanoShik (independent lab)
• Every order ships with a COA — verify it yourself
• If any independent test shows below 98% purity, we refund, replace, and cover the test cost

Your cart is still saved:

{{ items.list }}

[Complete your order →]({{ cart.url }})

— East Coast Labs
```

---

### Email 3 — 72 hours after abandonment

**Subject:** Last reminder — 10% off your order
**Preview:** Use code WELCOME10 for 10% off your first order.

**Body:**

```
Hi {{ first_name||"there" }},

This is the last nudge. Your cart is still saved, and if this is your first order, you can use WELCOME10 for 10% off at checkout.

{{ items.list }}

[Complete your order →]({{ cart.url }})

If you have questions before ordering, reply to this email or contact support@eastcoastlabs.com.au. We respond within one business day.

— East Coast Labs
```

---

## 3. Post-Purchase Flow

### Order Confirmation

**Subject:** Order confirmed — {{ order.number }}
**Preview:** We're preparing your order. Dispatch within 1 business day.

**Body:**

```
Hi {{ first_name||"there" }},

Order {{ order.number }} is confirmed. Here's what happens next:

1. We prepare your order
   Your products are pulled from the latest tested batch. Each vial includes a COA.

2. We dispatch within 1 business day
   Orders placed before 3:30pm AEST ship the same day.

3. You receive tracking
   We'll email you a tracking number as soon as your order ships.

4. You verify your batch
   Use the COA and the JanoShik verification link to confirm your batch independently.

Order summary:
{{ order.items }}

Total: {{ order.total }}
Shipping: {{ order.shipping_method }}

Questions? support@eastcoastlabs.com.au

— East Coast Labs
```

---

### Shipped

**Subject:** Your order has shipped — tracking inside
**Preview:** {{ order.shipping_method }} · Tracking: {{ tracking.number }}

**Body:**

```
Hi {{ first_name||"there" }},

Your order is on its way.

Tracking: {{ tracking.number }}
Carrier: {{ order.shipping_method }}

Your order has been packaged discreetly. No product names appear on the exterior packaging.

Expected delivery: {{ tracking.estimated_delivery }}

COA reminder: every vial in this order ships with an independent Certificate of Analysis. Find your batch ID on the COA and verify it at [Lab Results](https://eastcoastlabs.com.au/lab-results/).

— East Coast Labs
```

---

### Delivered +2 days — COA Verification Walkthrough

**Subject:** Your order arrived — here's how to verify your batch
**Preview:** A trust-building step most suppliers skip.

**Body:**

```
Hi {{ first_name||"there" }},

Your order should have arrived. Here's something most peptide suppliers don't tell you: verify your batch before you use it.

Your order included a Certificate of Analysis (COA). Here's how to confirm it's real:

1. Find the batch ID on your COA
2. Go to [eastcoastlabs.com.au/lab-results](https://eastcoastlabs.com.au/lab-results/)
3. Search for your batch ID — you'll see the purity result and test date
4. Click the JanoShik verification link to confirm on the lab's own system

If you want to go further, you can send any vial to an independent lab of your choice. If they find it below 98% purity, we refund or replace the order and cover the cost of the test.

That's our purity guarantee. We publish every result. We cover every test.

— East Coast Labs
```

---

### Delivered +14 days — Review Request

**Subject:** How was your order from East Coast Labs?
**Preview:** Share your experience — honest feedback only.

**Body:**

```
Hi {{ first_name||"there" }},

Your order was delivered about two weeks ago. We'd value your honest review.

We're specifically interested in:

• Dispatch speed — did your order arrive when expected?
• Packaging — was it discreet and secure?
• COA verification — did you check your batch against our published results?
• Independent testing — if you tested independently, what did you find?

[Leave a review →]({{ review.link }})

Every review helps other researchers make informed decisions. We never edit or remove reviews based on rating — honest feedback only.

— East Coast Labs
```

---

## 4. Replenishment Reminders

### Variant A — 1-vial buyer (+3 weeks)

**Subject:** Running low? Restock in one click + 10% off
**Preview:** It's been 3 weeks since your last order. Here's a quick restock link.

**Body:**

```
Hi {{ first_name||"there" }},

It's been about 3 weeks since your last order. If your lab supplies are running low, restocking takes one click.

Your last order:
{{ items.list }}

Restock now with code RESTOCK10 for 10% off:
[Reorder →]({{ reorder.url }})

Every restock ships from the latest tested batch with a COA included.

No longer need reminders? [Unsubscribe →]({{ unsubscribe.url }})

— East Coast Labs
```

---

### Variant B — 3-pack buyer (+10 weeks)

**Subject:** Time to restock? 10% off your next order
**Preview:** It's been about 10 weeks since your last 3-pack. Quick reorder inside.

**Body:**

```
Hi {{ first_name||"there" }},

It's been about 10 weeks since your last order. If your supply is getting low, here's a quick restock link.

Your last order:
{{ items.list }}

Restock with code RESTOCK10 for 10% off:
[Reorder →]({{ reorder.url }})

Every restock ships from the latest tested batch with an independent COA included.

[Unsubscribe →]({{ unsubscribe.url }})

— East Coast Labs
```

---

### Variant C — 6-pack buyer (+22 weeks)

**Subject:** Your 6-pack restock reminder — 10% off
**Preview:** About 22 weeks since your last order. Time to restock?

**Body:**

```
Hi {{ first_name||"there" }},

It's been about 22 weeks since your last 6-pack order. If you're running low, restocking is quick.

Your last order:
{{ items.list }}

Restock with code RESTOCK10 for 10% off:
[Reorder →]({{ reorder.url }})

6-packs include free Bacteriostatic Water and free Express Post. Every batch ships with an independent COA.

[Unsubscribe →]({{ unsubscribe.url }})

— East Coast Labs
```

---

## 5. Winback Flow

### Email 1 — 60 days inactive

**Subject:** What's new at East Coast Labs
**Preview:** Latest batch results + new pack options.

**Body:**

```
Hi {{ first_name||"there" }},

We haven't seen you in a while. Here's what's new:

• New batch results published — all compounds tested and verified by JanoShik
• Bulk pack pricing on every peptide — save up to 25% per vial in 6-packs
• Free shipping over $150 · 1-business-day dispatch from Australia

[See latest batch results →](https://eastcoastlabs.com.au/lab-results/)
[Shop now →](https://eastcoastlabs.com.au/shop/)

— East Coast Labs
```

---

### Email 2 — 90 days inactive

**Subject:** 10% off — come back and restock
**Preview:** Code RESTOCK10 for 10% off your next order.

**Body:**

```
Hi {{ first_name||"there" }},

We'd like to welcome you back. Use code RESTOCK10 for 10% off your next order.

[Shop peptides →](https://eastcoastlabs.com.au/shop/)

Every order includes an independent COA. Every batch is tested by JanoShik before it's listed. Purity guaranteed — we cover the test.

[See all batch results →](https://eastcoastlabs.com.au/lab-results/)

— East Coast Labs
```

---

## 6. Popup Specification

**Trigger:** Exit-intent + 8-second delay (NOT instant — instant popups reduce trust for this audience)

**Suppressed for:**
- Existing Klaviyo subscribers
- Visitors on cart or checkout pages

**Copy:**

```
┌─────────────────────────────────────────┐
│                                         │
│        10% OFF YOUR FIRST ORDER         │
│                                         │
│  Lab-grade peptides. Independently      │
│  tested. COA included with every         │
│  shipment.                              │
│                                         │
│  [ Enter your email            ]        │
│  [ Get my code ]                        │
│                                         │
│  No spam. Unsubscribe anytime.          │
│  Code: WELCOME10 (auto-applied)         │
│                                         │
└─────────────────────────────────────────┘
```

**On submit:**
- Show success: "Check your inbox — your code WELCOME10 is on its way."
- Auto-apply WELCOME10 if they click through to shop from the success screen
- Add to "Welcome Flow" (Section 1 above)

---

## 7. Flow Trigger Config Table

| Flow | Trigger Event | Timing | Filters / Exclusions |
|------|--------------|--------|---------------------|
| Welcome | `Placed Order` OR `Subscribed to List` | E1: immediate · E2: +2d · E3: +4d | Exclude if already purchased (E2/E3 only) |
| Abandoned Cart | `Checkout Started` | E1: +1h · E2: +24h · E3: +72h | Exclude if order completed; suppress on checkout pages |
| Post-Purchase: Confirmation | `Placed Order` | Immediate | None |
| Post-Purchase: Shipped | `Order Shipped` (Fulfillment) | Immediate | None |
| Post-Purchase: COA Verify | `Fulfilled Order` | +2 days after fulfillment | Exclude if order cancelled/refunded |
| Post-Purchase: Review Request | `Fulfilled Order` | +14 days after fulfillment | Exclude if already reviewed; one-time per order |
| Replenishment (1-vial) | `Fulfilled Order` with 1-vial variant | +3 weeks | Exclude if reordered since; one-time per order |
| Replenishment (3-pack) | `Fulfilled Order` with 3-pack variant | +10 weeks | Same exclusions |
| Replenishment (6-pack) | `Fulfilled Order` with 6-pack variant | +22 weeks | Same exclusions |
| Winback 60d | `Placed Order` | +60 days since last order | Exclude if ordered in last 60d; max 1 send |
| Winback 90d | `Placed Order` | +90 days since last order | Exclude if ordered in last 90d; max 1 send |
| Popup | Exit-intent OR 8s delay on page | Once per session | Suppress for subscribers; suppress on cart/checkout |
