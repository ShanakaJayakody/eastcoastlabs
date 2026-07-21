# TESTS — Sequential Testing Protocol

**Purpose:** Document and track all conversion rate optimization tests using sequential before/after methodology.  
**Baseline Reference:** [BASELINE.md](./BASELINE.md)  
**Current Volume:** <500 orders/month (sequential testing required)  
**Graduation Target:** ~500 orders/month (then A/B testing)

---

## Why Sequential Testing (Not A/B)?

At East Coast Labs' current order volume (<500 orders/month), **A/B testing is premature and statistically unsound**. Here's why:

### The Sample Size Problem
- **Statistical Power:** A/B tests require large sample sizes to detect meaningful differences. At 400 orders/month, a 5% lift in conversion rate would need ~8,000 visitors per variant to detect with 80% power — more than 2 months of traffic per variant.
- **Test Duration:** Running multiple variants means tests take 3-6 months, during which seasonality, market shifts, or other factors contaminate results.
- **False Confidence:** Low-volume A/B tests often show "significant" results that are actually statistical noise, leading to false positives.

### Sequential Testing Benefits
- **Faster Cycles:** Each test takes 2 weeks, not 2-6 months
- **Cleaner Data:** One change at a time means clear attribution
- **Practical Significance:** Focus on directional improvements that matter to revenue
- **Resource Efficient:** No need for complex A/B testing tooling or infrastructure

### When to Graduate to A/B Testing

**Volume Threshold:** ~500 orders/month sustained

**Signs You're Ready:**
1. Can achieve 80% statistical power in <4 weeks
2. Multiple test ideas competing for priority
3. Need to test multiple variants simultaneously
4. Have tooling budget and technical resources

**Recommended Tooling:**
- **WooCommerce-native:** Google Optimize (free) or VWO (paid)
- **Platform-agnostic:** Optimizely, Convert, or custom deployment
- **Analytics:** GA4 with experiments enabled

---

## Testing Rules

### Golden Rule: One Change at a Time
Never overlap tests. Ever. Each change must be isolated to maintain clear attribution.

### Required Protocol

1. **One Change Per Test Window**
   - Modify exactly one variable (copy, layout, pricing, etc.)
   - All other elements remain constant
   - Document what changed and what stayed the same

2. **2-Week Measurement Windows (Minimum)**
   - Run each test for 14 days minimum
   - Extends to 21 days if weekly seasonality is strong
   - Start tests on same day of week for consistency

3. **Compare Against BASELINE.md Metrics**
   - All results reference baseline values from BASELINE.md
   - Use identical calculation methods
   - Track: Primary metric, secondary metrics, revenue impact

4. **Document Every Test**
   Required fields for each test entry:
   - Hypothesis (what you believe and why)
   - Primary metric (the one thing that validates/falsifies the hypothesis)
   - Secondary metrics (guard rails and additional insights)
   - Start date (first day of test window)
   - End date (last day of test window)
   - Result (direction, magnitude, decision)

5. **Statistical Reality Check**
   - At current volume, look for **directional trends**, not p-values
   - 10%+ improvement in primary metric = consider it a win
   - 5% or less = inconclusive, needs longer test or bigger change
   - Negative result = valuable learning, document and move on

### Guard Rail Metrics

Every test must monitor these guard rails:
- **Conversion Rate:** Never sacrifice CR for AOV
- **Revenue per Session:** Sanity check that overall value isn't dropping
- **Cart Abandonment:** Ensure UX isn't degrading
- **Support Tickets:** Watch for customer confusion

If any guard rail degrades by >10%, kill the test immediately.

---

## Test Log

| # | Test | Hypothesis | Primary Metric | Secondary Metrics | Start | End | Result |
|---|---|---|---|---|---|---|---|
| 1 | 3-pack vs 6-pack as default tier | Pre-selecting the 6-pack instead of 3-pack increases AOV without reducing CR | AOV | CR, revenue per session | [TBD] | [TBD+14d] | — |
| 2 | Guarantee microcopy under ATC on/off | Adding "Purity guaranteed — we cover the test" under the ATC button increases CR | Conversion Rate | ATC click rate, checkout starts | [TBD] | [TBD+14d] | — |
| 3 | Free shipping threshold $150 vs $130 | Lowering threshold to $130 increases CR and cart completion without eroding margin | Conversion Rate | AOV, shipping cost %, cart abandonment | [TBD] | [TBD+14d] | — |

**Test Status Legend:**
- `—` = Not started (planned)
- `🔄 Running` = Actively collecting data
- `✅ Win` = Positive result, implemented
- `❌ Loss` = Negative result, reverted
- `❓ Inconclusive` = Needs longer run or bigger change

---

## Test Details

### Test 1: Default Tier Selection (3-pack vs 6-pack)

**Hypothesis:** Pre-selecting the 6-pack option instead of the 3-pack as the default tier will increase Average Order Value without reducing Conversion Rate.

**Implementation:**
- Change default radio button from 3-pack to 6-pack on product pages
- Keep all pricing, copy, and layout identical
- Ensure 3-pack remains one click away

**Primary Metric:** AOV (target: +15% vs baseline)

**Secondary Metrics:**
- Conversion Rate (guard rail: must not drop >5%)
- Revenue per Session (should increase)
- Units per Order (should increase from 3 to 6)

**Duration:** 14 days minimum

**Success Criteria:**
- AOV increases by ≥15%
- Conversion Rate does not drop >5%
- Revenue per Session increases by ≥10%

**Risks:**
- Higher perceived upfront cost might reduce CR
- 6-pack might feel like "too much" for new customers

**Rollback Plan:** Revert to 3-pack default if CR drops >10%

---

### Test 2: Guarantee Microcopy Under Add-to-Cart

**Hypothesis:** Adding trust-building microcopy "Purity guaranteed — we cover the test" directly below the Add-to-Cart button will increase Conversion Rate by addressing purchase anxiety.

**Implementation:**
- Add text below ATC button on product pages
- Use small, italicized font with subtle styling
- Copy variation to test: "Purity guaranteed — we cover the test"

**Primary Metric:** Conversion Rate (target: +8% vs baseline)

**Secondary Metrics:**
- Add-to-Cart click rate (should increase)
- Checkout start rate (ATC → Checkout)
- Time on page (engagement signal)

**Duration:** 14 days minimum

**Success Criteria:**
- Conversion Rate increases by ≥8%
- ATC click rate increases
- No increase in support tickets about quality/purity

**Risks:**
- Might add visual clutter below button
- Could appear defensive if phrasing is off

**Rollback Plan:** Remove microcopy if no CR improvement after 21 days

---

### Test 3: Free Shipping Threshold Optimization

**Hypothesis:** Lowering the free shipping threshold from $150 to $130 will increase Conversion Rate and cart completion rate without significantly eroding margin.

**Implementation:**
- Change free shipping threshold in WooCommerce settings
- Update banner/messaging to reflect new $130 threshold
- Track shipping cost % of revenue

**Primary Metric:** Conversion Rate (target: +10% vs baseline)

**Secondary Metrics:**
- AOV (might decrease slightly — acceptable trade)
- Shipping cost as % of revenue (must not increase >5%)
- Cart abandonment rate (should decrease)
- Orders between $130-$150 (should increase)

**Duration:** 14 days minimum

**Success Criteria:**
- Conversion Rate increases by ≥10%
- Shipping cost % increases <5%
- Net revenue increases despite margin hit

**Risks:**
- Margin compression if AOV drops significantly
- Customers conditioned to $130 threshold (harder to raise later)

**Rollback Plan:** Revert to $150 if shipping cost % increases >7% or net revenue drops

---

## Future Test Backlog

After completing the first three tests, prioritize from this backlog:

### High Priority (Revenue Impact)
1. **Product Bundle Hero Section**
   - Test: Add "Most Popular" badge to 6-pack tier option
   - Hypothesis: Social proof badge increases 6-pack selection rate
   - Metric: 6-pack attachment rate, AOV

2. **Checkout Field Reduction**
   - Test: Remove optional fields from checkout (phone, company)
   - Hypothesis: Fewer fields reduces friction, increases CR
   - Metric: Checkout completion rate, CR

3. **Urgency Messaging (Limited Inventory)**
   - Test: Add "Low stock — order soon" messaging on bestsellers
   - Hypothesis: Scarcity urgency increases ATC rate
   - Metric: ATC rate, time-to-purchase

### Medium Priority (UX Optimization)
4. **Mobile-Focused ATC Button**
   - Test: Larger, bottom-sticky ATC on mobile product pages
   - Hypothesis: Improved mobile UX increases mobile CR
   - Metric: Mobile CR specifically

5. **Product Description Format**
   - Test: Bulleted benefits vs paragraph description
   - Hypothesis: Scannable format increases engagement and CR
   - Metric: Time on page, scroll depth, CR

### Lower Priority (Exploratory)
6. **Social Proof Testimonials**
   - Test: Add 3-star review snippet near ATC button
   - Hypothesis: Social proof increases trust and CR
   - Metric: CR, ATC click rate

7. **Cross-Sell in Cart**
   - Test: "Complete your research" — suggest related products in cart
   - Hypothesis: Increases AOV without harming CR
   - Metric: AOV, attachment rate, CR

---

## Graduation Criteria: Moving to A/B Testing

### Volume Threshold
**Target:** Sustained 500 orders/month (~16-17 orders/day)

### Readiness Checklist
- [ ] **Volume:** ≥500 orders/month for 3 consecutive months
- [ ] **Traffic:** ≥10,000 sessions/month (enough for sample size)
- [ ] **Tooling:** A/B testing platform selected and configured
- [ ] **Analytics:** GA4 experiments or alternative set up
- [ ] **Budget:** Allocated for paid testing tool (if needed)
- [ ] **Resources:** Developer/designer time available for variants

### Recommended A/B Testing Tools

**Free/Cheapest:**
- **Google Optimize:** Free, integrates with GA4, good for beginners
- **PostHog:** Generous free tier, product analytics + experiments

**Mid-Tier ($100-300/mo):**
- **VWO:** WooCommerce-native, easy setup, good support
- **Convert:** Similar to VWO, strong targeting features

**Enterprise ($500+/mo):**
- **Optimizely:** Industry standard, advanced features
- **Split.io:** Developer-focused, feature flagging

### A/B Testing Protocol (Post-Graduation)

When you graduate to A/B testing:

1. **Minimum Sample Size:** Calculate before launch
   - Use power analysis: 80% power, 95% confidence
   - For 5% lift detection at 500 orders/month: ~8 weeks per test

2. **Test Duration:** 2-8 weeks
   - Shorter for big changes (>20% expected lift)
   - Longer for small changes (5-10% expected lift)
   - Always run full weeks to handle weekly seasonality

3. **Statistical Significance:**
   - Target: p < 0.05 (95% confidence)
   - Practical significance: minimum 5% lift
   - Watch for "p-hacking" — don't stop early just because it looks good

4. **Segment Analysis:**
   - Desktop vs Mobile
   - New vs Returning customers
   - Traffic source (organic, paid, direct)

5. **Multiple Variants:**
   - Start with 2 variants (control + 1 change)
   - Add variants only if you have volume to support it
   - More variants = longer test duration

---

## Test Documentation Template

Copy this template when adding new tests:

```markdown
### Test N: [Test Name]

**Hypothesis:** [What you believe and why]

**Implementation:**
- [Specific change being made]
- [What stays the same]
- [Where it applies (product pages, checkout, etc.)]

**Primary Metric:** [Metric name] (target: [X]% vs baseline)

**Secondary Metrics:**
- [Metric 1]
- [Metric 2]
- [Metric 3]

**Duration:** [X] days minimum

**Success Criteria:**
- [Primary metric improves by ≥X%]
- [Guard rail metrics do not degrade]
- [Revenue impact is positive]

**Risks:**
- [Risk 1]
- [Risk 2]

**Rollback Plan:** [What to do if test fails]

**Result:** [Fill after test completes]
- Direction: [✅ Win / ❌ Loss / ❓ Inconclusive]
- Primary metric change: [+X% / -X%]
- Secondary metrics: [Summary of impact]
- Revenue impact: [+-$X per month]
- Decision: [Implement / Revert / Iterate]
```

---

## Measuring Test Results

### Calculations

**For each test, calculate:**

1. **Primary Metric Change:**
   ```
   (Test Period Value - Baseline Value) / Baseline Value × 100%
   ```

2. **Secondary Metric Changes:**
   - Same formula for each secondary metric
   - Flag any that degrade >10%

3. **Revenue Impact (Monthly):**
   ```
   (Test Period Daily Revenue - Baseline Daily Revenue) × 30
   ```

4. **Statistical Signal:**
   - At <500 orders/month: directional trend only
   - Look for ≥10% change in primary metric
   - <10% = inconclusive, run longer or abandon

### Post-Test Decision Framework

**✅ Implement If:**
- Primary metric improves ≥10%
- Guard rail metrics do not degrade >10%
- Revenue impact is positive
- No negative customer feedback

**❌ Revert If:**
- Primary metric degrades >5%
- Any guard rail degrades >10%
- Revenue impact is negative
- Customer complaints increase

**❓ Iterate If:**
- Primary metric change is 5-10% (promising but inconclusive)
- Secondary metrics show mixed signals
- Revenue impact is neutral
- Hypothesis was partially correct

---

## Seasonality Considerations

### Factors That Can Skew Results
- **Monthly:** Payday effects (1st, 15th of month)
- **Weekly:** Weekends vs weekdays
- **Seasonal:** Holiday spikes, summer slowdowns
- **External:** Competitor promos, news events, market shifts

### Mitigation Strategies
1. **Run tests for full weeks** (Monday-Sunday) to smooth weekly cycles
2. **Avoid holiday periods** for major changes
3. **Document anomalies** (e.g., "Viral post on day 7 drove 2x traffic")
4. **Compare year-over-year** if running annual tests

### Recording Seasonality
After each test, document:
- Any unusual traffic spikes or drops
- External events that might have influenced results
- Day-of-week patterns observed during test

---

## Notes & Learning Log

**Test 1 Notes:**
- [Document any observations, customer feedback, or anomalies]

**Test 2 Notes:**
- [Document any observations, customer feedback, or anomalies]

**Test 3 Notes:**
- [Document any observations, customer feedback, or anomalies]

---

*This testing protocol prioritizes clear attribution and practical learning over statistical purity. At East Coast Labs' scale, sequential testing provides actionable insights faster than underpowered A/B tests. Graduate to A/B when volume justifies it.*
