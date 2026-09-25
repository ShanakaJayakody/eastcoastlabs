# East Coast Labs rebrand explorations

Three isolated landing-page directions on `codex/rebrand-variants`. The existing `/` page, its shell, product pages, prices, inventory and checkout have not been redesigned. The old Dossier at `/1` is replaced; `/2` and `/3` are added. These routes are released through the normal GitHub/Vercel production pipeline; no homepage traffic is redirected.

| URL | Direction | Palette and emphasis |
| --- | --- | --- |
| `/1` | An Australian supplier of research peptides | Sage, deep green and ivory. A clear supplier introduction with a welcoming coastal portrait. |
| `/2` | See the reports behind our research peptides | Navy, mist blue and white. Product imagery and direct access to the original supplier reports. |
| `/3` | We supply research peptides across Australia | Plum, blush and warm cream. Coastal portrait, conversational introduction and accessible product support. |

## Reassurance preview — 25 September 2026

The [reassurance, design and copy audit](2026-09-25-reassurance-design-copy-audit.md) is being applied to a separate preview on `codex/rebrand-reassurance-preview`. All three routes now identify the peptide category in their H1, use a primary shopping action, show introductory copy before the retained image on phones, and place products before the longer report explanation. Matching historical supplier reports are linked beside product cards with their sample and date visible. Practical ordering and delivery information replaces the repeated resource section. Contact copy no longer refers to personal health stages.

This preview changes only the three landing pages. The audit's current-batch evidence reconciliation, shipping-settings reconciliation and downstream visual rollout remain separate follow-ups. No unverified testing procedure, founder story, shipping rate or guarantee has been added. The existing production site is not replaced by the preview deployment.

Verification: all 717 regression tests passed; TypeScript and targeted ESLint passed. Browser checks covered every route at 320, 390, 768 and 1440px, with no horizontal overflow, one H1 and no broken section anchors. At 390px, the primary shopping action begins at approximately 450–494px, compared with 719–867px in the audited version. Independent review found no actionable issues.

Each page has a responsive menu, shared shopping bag, catalogue filters, current product sizes/prices, original report links, supporting explanations and accessible native FAQ disclosures. Supporting text is enlarged for mobile and mature readers. The Commissioner font and image assets are local. No new runtime dependency was added.

On phones and touch devices, product size selectors, product links, footer links, secondary calls to action and the cart close button have a minimum 44-pixel touch area. Body copy and research-use notices have larger mobile type. Safe-area spacing accommodates display notches and home indicators. These adjustments are scoped to the three rebrand routes.

See the [initial copy and typography audit](2026-09-25-copy-and-type-audit.md) for the preceding revision and the [reassurance audit](2026-09-25-reassurance-design-copy-audit.md) for the current direction and wider-site findings.

## Evidence and copy

The catalogue remains research-use-only. Imagery and tone address the audience without promising weight loss, postpartum recovery, menopause treatment, hormone balance or clinical safety. At the owner’s request, coastal portraits and scenery give the pages a welcoming, friendly presentation. Portraits appear in the first and third heroes and accompany the navy route’s contact section. They are editorial brand imagery, not customer or staff testimonials. Original reports remain in the evidence sections and are linked beside matching products. Each route provides a direct email link and configured contact hours.

The report feature uses the existing unmodified historical GHK-Cu supplier report, including date and verification URL. Historical reports are explicitly sample-specific and not evidence of current shipped inventory. Current verified COAs appear separately only when returned by the existing `getAllCoa` service. Missing catalogue data gets a truthful empty state. No synthetic rating, customer count, endorsement or certificate is introduced.

Existing shared learning articles include broad all-batch claims, so the new reading room links to original documents, the report library and a measured in-page explanation. Those original shared articles have not been changed.

## Local preview

From `storefront` in this worktree:

```sh
npm run dev -- --hostname 127.0.0.1 --port 3107
```

Open `http://127.0.0.1:3107/1`, `/2` or `/3`. The local environment uses the existing database configuration for read-only catalogue/settings rendering; no test orders, emails or inventory writes were performed. With no configuration the pages render the unavailable-data state.

## Split-test readiness

The new experiment identity is `rebrand-2026q3` with arms `v1`, `v2`, `v3`. It is separate from `homepage-2026q3`, so the previous Dossier results are not reused. Merely opening preview URLs does not start an experiment.

When a traffic plan has been chosen, configure both values at build/deployment time:

```dotenv
NEXT_PUBLIC_REBRAND_EXPERIMENT_ACTIVE=1
NEXT_PUBLIC_MEASUREMENT_EXPERIMENTS=rebrand-2026q3:v1|v2|v3
```

Preserve other configured declarations in the comma-separated allowlist if needed. Configure GA4 through the existing setup. No values were enabled in this change.

Allocate comparable eligible visitors equally to the three URLs using the campaign/traffic allocator. Keep each visitor in one arm. Route choice is not randomisation; manually comparing these pages is a design review, not an experiment. Existing `stableExperimentVariant` can support deterministic external allocation. The main `/` route stays untouched and is not a fourth arm in this experiment.

Consent is required before storing attribution or sending events. First assignment wins; browsing another design does not generate a false impression of the originally assigned page. Previewing all three should use experiment-inactive mode. Returning visitors keep their first consented assignment.

Register event-scoped GA4 dimensions `rebrand_experiment_id` and `rebrand_variant`. They accompany consented browser funnel events, including product selection, add-to-cart and order-created, even if an older homepage assignment already exists. The impression also supplies the matching `experiment_id` and `experiment_variant` explicitly. Legacy dimensions remain intact for other events.

Primary paid-conversion analysis should join the exact `rebrand-2026q3` assignment in the existing order attribution snapshot to settled payment outcomes. `order_created` is not a paid purchase. The existing server-side GA4 paid-purchase worker still sends its original single primary experiment dimension; do not use that dimension alone to analyse overlapping experiments. No payment worker or financial reporting behavior was modified.

All three routes have `noindex, follow` metadata and a canonical URL pointing to `/`; they are not added to the sitemap. These are public preview paths if deployed, not password-protected pages.

## Verification

- New attribution regression tests initially failed for unsupported routes/configuration and overlapping experiment dimensions, then passed after implementation.
- 38 focused measurement/analytics tests passed.
- The release regression suite passed all 717 tests in 134 files; TypeScript and focused ESLint checks also passed after the mobile refinement.
- TypeScript check, focused ESLint check and production build passed. The final build was verified with database credentials disabled after an earlier credentialed prerender encountered transient fetch timeouts; live catalogue rendering was separately checked in the browser.
- Browser checks cover 320, 390, 820, 1024 and 1440-pixel widths, single H1, no horizontal overflow and noindex/canonical metadata.
- Mobile navigation, collection filtering (Cognitive & Focus resolves Semax/Selank), FAQ disclosure and shopping-bag opening were checked against the actual rendered pages.
- Shared-cart styling was rechecked after scoping: 14px heading; white CTA text on the dark accent background.
- The mobile refinement was checked at 320, 390, 768 and 844-pixel widths, including landscape, product filters, FAQ opening, menu Escape/focus return and the empty cart. Phone header visibility and minimum touch sizes were rechecked after the final CSS change.
- Independent review covered analytics coexistence, evidence wording and style isolation.

## Files

- Route shells: `storefront/app/(variant)/`
- Page/data assembly and scoped presentation: `storefront/components/rebrand/`
- New experiment: `storefront/lib/variant.ts`
- Consented attribution: `storefront/components/VariantTag.tsx`, `storefront/lib/attribution.ts`, `storefront/lib/analytics.ts`
- Tests: `storefront/tests/storefront/rebrand-measurement.test.tsx`, `storefront/tests/storefront/rebrand-analytics.test.ts`
- Asset provenance and exact generation prompts: [assets.md](assets.md)
