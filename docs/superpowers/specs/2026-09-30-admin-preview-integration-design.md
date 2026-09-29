# ECL admin — approved visual direction, integrated preview design

Date: 30 September 2026.
Status: visual direction and integration scope approved; owner selected real store data on 30 September 2026. Detailed implementation plan awaiting review.

## Intent

Bring the approved revision-3 design into the existing authenticated Next.js admin, with light and dark modes, central revenue and simpler access to daily work. Replace the promotional introduction with one inspiring daily quote. Publish to a Vercel preview URL for owner review; do not promote to production or change the storefront's appearance.

The owner approved the visual study, except for the opening eyebrow, headline and subtitle. Those three lines must be removed. The localhost fixture is a design reference, not application code to deploy unchanged: its records, chart values, milestone and order mutations are synthetic.

This document supersedes the deployment and introduction portions of the [original design](2026-09-29-admin-revamp-design.md). Its business safeguards and route-preservation requirements remain applicable.

## Daily quote

- Show a single compact quote in the space previously occupied by the introductory copy; keep Open orders readily available. Keep the page's accessible Today heading in the shell.
- Rotate deterministically each Australia/Melbourne calendar day. All admins see the same quote that day; reloads do not shuffle it. Update at the day boundary and when a backgrounded tab returns.
- Use a bundled curated collection about discipline, ambition, purpose and meaningful achievement. Default to original ECL lines, without invented famous-person attribution. Example: “Let your purpose set the direction. Let your discipline set the pace.”
- No quote API, cron, new dependency, external tracking or database table. No animation or automatic carousel within the day.
- Tests cover stable daily selection, successive days, local-midnight and daylight-saving boundaries, and removal of the three rejected lines.

## Integration approach

Recommended: adapt the existing application in an isolated development worktree. Reuse its real authentication, queries, actions and domain components. Introduce the new presentation through shared admin-scoped tokens, navigation and overview components.

Two alternatives were considered: hosting the existing mockup would not provide a real admin integration; replacing domain workflows wholesale would introduce unnecessary payment, stock and fulfilment risk. Neither is the proposed approach.

### Shared workspace

- Apply the approved brand assets, calmer surfaces, typography, spacing and focus states to the admin only. Light is the initial default; an explicit persistent light/dark control remains available on every admin page.
- Replace the 17-link sidebar with the seven approved destinations: Today, Orders, Catalogue, Customers, Marketing, Reports and Settings. Secondary navigation preserves access to every current tool. Existing deep links and the command palette remain usable.
- Theme mobile navigation, command search, detail panels, forms, loading/error states and confirmation dialogs. Remove decorative aurora/glow/route-entrance effects.
- Preserve the latest ordered-product-strength improvements already present on main.

### Today

- Daily quote and order shortcut; dominant paid-revenue chart; concise supporting counts; open orders, payment and stock shortcuts; genuine milestone/highlight; oldest paid-order queue.
- Connect to authenticated reads, never sample values. Retain gross paid-order revenue, refunds and gross-profit distinctions. Keep existing detailed analytics reachable in Reports.
- Support Today, last seven completed days, month to date and validated custom ranges with explicit dates and timezone. New overview range adapters must use actual paid timestamps and matched elapsed comparisons; do not relabel the existing full-prior-period calculation as a matched comparison.
- Keep open-work counts independent of chart filters. Preserve existing urgency thresholds and surface blocking failures without waiting for a revenue query.
- Keep independent loading and failure boundaries. Missing data is unavailable, not a successful zero.
- Do not carry the sample $20,000 target or $18,000 achievement into the real dashboard. When no actual goal exists, use a verifiable period highlight in that space; suppress unearned celebrations. Configurable target management is outside this presentation change.
- On phones, place open-work shortcuts immediately after the chart, ahead of the milestone/highlight.

### Operational areas

- Adapt Orders and Catalogue lists and contextual presentation to the approved study while retaining real filters, URLs, pagination, eligibility checks and error handling.
- Retain the canonical order detail, packing, lot checks, item sizes, refunds, deletion confirmations, tracking and shipping semantics. Do not reuse the fixture's React-only shipping simulation.
- Apply shared styling and grouped navigation to Customers, Marketing, Reports and Settings. Keep their existing working screens and features; do not replace them with the mockup's planned-screen placeholders.
- Preserve stock-pool/size accounting, receipt reversals, COA associations, audit logging and transactional email guards. This design requires no database schema or business-rule changes.

## Preview hosting and data boundary

Read-only checks confirmed the existing Vercel project is `eastcoastlabs`, with Next.js rooted at `storefront` and Node 22. The CLI account can inspect it. On 30 September, `vercel env ls preview` returned no preview variables.

**Selected: real data, read-only review.** The owner's reply “real store data” selects the read-only real-data option presented in the preceding review. Authenticated live reads are permitted; business writes from the preview are not. Block mutations on the server, not merely in the interface. Keep service-role credentials out of the client and preserve the normal admin allow-list. Test mutation flows against isolated fixtures, not customer records.

Connect only the required Supabase URL, public key and server-side service credential to this guarded preview. Do not copy the production environment wholesale or enable payment, carrier, email/SMS, analytics or cron credentials. Read-only refers to business data: normal user-initiated admin authentication/session refresh is permitted, including the requested sign-in code email. Skip preview login/logout entries in the store's audit table rather than creating business audit records during review.

Do not weaken login, deployment protection or allow-list checks to make a preview reachable. Do not create or purchase infrastructure without approval.

Deploy a clean, scoped checkout to Vercel's preview environment, from the repository root using the existing project. Do not upload unrelated documents, research, local outputs or secrets from the shared working directory. Do not use `--prod`, promote an alias, merge to main or change production environment settings.

## Verification and review gates

1. Owner reviews this integration scope and chooses the data boundary. The detailed implementation plan and execution method follow that approval.
2. Before implementation, isolate the work and establish the existing test baseline. Use test-first changes for quote selection, navigation/theme behavior, revenue windows and any preview write guard.
3. Run focused interaction and domain regression tests, typecheck, lint and a production build. Verify that no synthetic fixture is imported into application routes and no server credential enters the client bundle.
4. Browser-check light/dark at 320, 390, 768 and 1440px: chart readability, no overflow, focus/keyboard controls, dialog containment, date validation, loading/error states and retained operational flows. Use isolated data for mutating checks.
5. Deploy only to preview. Verify deployment readiness, anonymous login redirect, admin authorization, private response headers, asset loading, data boundary and the intended write behavior. Owner signs in normally if authentication is needed for visual review.
6. Deliver the actual preview URL, scope implemented, test evidence and any remaining limitations. Production release requires a separate explicit instruction.

## Acceptance

The owner can open the authenticated preview, see the approved revenue-led design with the quieter daily-quote introduction, switch between complete light and dark themes, reach all existing admin tools, and review the working integration without unapproved production data changes.
