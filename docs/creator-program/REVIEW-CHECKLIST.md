# Creator Collective review criteria

Reviewer scope: the approved creator implementation in this worktree, baseline `9937afd`. The user explicitly requested GPT-5.5 execution after incorporating their screenshots and expanded imagery. The visual-update document takes precedence over older layout assumptions. Do not assess unrelated concurrent product-size work in the primary checkout.

## Required user-visible outcome

- `/creators` renders the actual ECL page with a clear reward-program explanation and working application CTA.
- Dominant celebratory group image contains at least 15 distinct fictional adult people, visibly varied poses, ECL product context and coherent brand styling.
- Three distinct image-led categories: fitness creators, relatable everyday health voices, biohacking storytellers.
- Strong visual execution: deliberate typography/spacing, rounded portrait panels, ECL dark/turquoise/silver palette, generous but useful layout, no placeholder content.
- Application/CTA is reachable early on phones; headings, vials, faces and field controls are not accidentally clipped or obstructed.
- Original fictional-model disclosure; no fabricated real partners, testimonials, medical credentials, follower/income metrics or efficacy claims.
- Offer remains paid briefs from A$300; terms are accurate about selection, rights and what is/is not included. Future affiliate proposal is not presented as operational.

## Functional and data boundaries

- Required content-focus field is correctly propagated through form, validator, canonical input, schema, admin and privacy notice; medium/discipline remains separate.
- Same-origin API checks actual bounded request body, strict expected fields and typed error/success shapes; never returns success on missing configuration or DB failure.
- Retry identity is stable for unchanged uncertain submissions; changed payloads cannot overwrite/reuse a committed request incorrectly.
- Private application tables and RPCs have appropriate role grants/RLS; anonymous and non-allowlisted users cannot read submitted records.
- Throttle is atomic and uses an explicitly trusted ingress identifier; it does not trust arbitrary client-provided forwarded addresses.
- Reviewer identity is derived server-side; status/revision/audit changes are atomic and stale writes are handled.
- Form is keyboard usable, labels/errors are associated, errors retain input and success confirms durable storage.
- External profile links are escaped and opened safely; no automatic URL fetch/embed.
- Application data, internal notes and secrets do not leak through GA4, browser storage, response bodies, logs, error messages or compiled client bundles.
- Retention has a concrete operator procedure/RPC and a clear distinction between unselected applicants and separately governed contractor records.

## Integration and evidence

- Both store and dossier navigation/footer expose the route; mobile link-count regressions addressed.
- Newsletter and exit-intent are suppressed only on the intended creator journey while checkout protections remain intact.
- Creator analytics admits only the public creator path and enumerated non-personal events; submit means durable success.
- Page metadata, privacy notice, sitemap/indexing and operational release constraints are consistent.
- Four new optimised delivery assets exist and match the original masters' intended compositions; record actual bytes/dimensions.
- Targeted behaviour and SQL tests, full regression suite, typecheck, lint, build and route budgets have fresh evidence. Browser validation covers actual components and distinguishes a fake-data fixture from real route/database integration.
- No production migration/deployment, outbound email, contract, order, product shipment or payment occurred as part of local testing.
- Deployment hold remains; no modifications of old migration files or unrelated storefront features.

Review findings should be actionable, identify exact file/line and explain a concrete consequence. Do not infer production-readiness from a local fixture or infer a defect solely from planned external staging steps. Resolve actual implementation omissions and regressions before delivery.
