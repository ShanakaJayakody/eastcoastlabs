# ECL Creator Collective Implementation Plan

**Implementation status:** Executed locally using GPT-5.5 on `codex/creator-collective`. See the [implementation report](../../creator-program/IMPLEMENTATION.md) for completed work, verification results and the external staging/release steps that remain. The detailed checklist below is preserved as the implementation specification.

> **For agentic workers:** User has explicitly authorised execution using GPT-5.5. Use GPT-5.5 for implementation and read the [approved visual update](../specs/2026-09-09-creator-visual-update.md) before the original spec; it supersedes conflicting visual assumptions and adds the required content-focus field. Execute all tasks, recording progress and validation evidence. Steps use checkbox syntax for tracking.

**Goal:** Add a polished `/creators` page with truthful paid-brief rewards, an application CTA, durable private intake and a minimal protected reviewer workflow.

**Architecture:** Server-render the editorial page inside the existing `(store)` shell. Keep interactions in small client components; submit applications to a same-origin route handler backed by service-only Supabase RPCs. Add the review screen to the existing admin area and leave checkout, affiliate accounting, contracts, outreach and payouts outside this release.

**Tech stack:** Existing Next.js 15, React 19, TypeScript, Tailwind 4, Supabase, Vitest, Testing Library, PGlite and Playwright. Node 22.12+ within the 22.x line; npm 10.9.8. No new runtime dependency is needed.

**Spec:** [Program, copy and design](../specs/2026-09-09-creator-collective-design.md). Read this first: it defines the exact section order, public copy, proposed compensation, field rules and image usage constraints.

## Global constraints

- Implementation is authorised. Record what is built and verified; local implementation does not imply production deployment.
- Primary route `/creators`; primary CTA `Apply to the collective`; anchor `#apply`.
- Paid briefs start at proposed A$300; selection and work are not guaranteed. No affiliate commission offer in this release.
- Generated vial imagery is private concept work pending product-specific publication review; never describe fictional models as actual partners.
- Work in `storefront/`, not the legacy WordPress modules.
- Keep the dark store shell and scope new creator styles/font variables. Do not change `/1` experiment attribution.
- No automatic email, product shipment, payment, creator account or newsletter subscription on application or acceptance.
- Every successful application response represents a durable record. Never return synthetic success from a public application route.
- Every admin read/action calls `requireAdmin()`. Public application data and internal notes have no anonymous read access.
- Money is integer cents. Application fields and arbitrary URLs never go to analytics, URL queries or persistent browser storage.
- Existing migration checksums and deployment hold are preserved. Database changes use a new migration and the existing runner.
- Use the program/design spec's exact field limits, privacy retention and content licence defaults.

## File map

Paths below are relative to `storefront/` unless explicitly prefixed with `docs/`.

| File to create or modify | Responsibility |
|---|---|
| `lib/creators/content.ts` | Client-safe copy, FAQs, benefit data and reviewed asset manifest |
| `lib/creators/types.ts` | Application/reviewer types and enumerated result codes |
| `lib/creators/validation.ts` | Pure input validation and canonical normalisation |
| `lib/creators/applications.ts` | Server-only intake adapter, HMAC identifiers and RPC calls |
| `app/(store)/creators/page.tsx` | Metadata, fonts, server-rendered section composition |
| `app/(store)/creators/creators.module.css` | Scoped art direction, responsive layout, light section and motion |
| `app/(store)/creators/privacy/page.tsx` | Creator-specific privacy notice |
| `components/creators/CreatorLanding.tsx` | Pure editorial page markup excluding connected submission |
| `components/creators/CreatorApplicationForm.tsx` | Accessible form, field errors and submission states |
| `components/creators/CreatorStickyApply.tsx` | Mobile CTA visibility/focus behaviour |
| `components/creators/CreatorTracking.tsx` | Allowlisted application/CTA events |
| `app/api/creators/apply/route.ts` | Same-origin bounded request parsing and result-to-HTTP mapping |
| `supabase/migrations/20260909140000_creator_applications.sql` | Private tables, throttle, intake/reviewer RPCs, explicit grants |
| `lib/admin/creators.ts` | Protected paginated reads and guarded review mutations |
| `app/admin/(dashboard)/creators/page.tsx` | Private application list |
| `app/admin/(dashboard)/creators/[id]/page.tsx` | Private application detail |
| `app/admin/(dashboard)/creators/actions.ts` | Validated status/notes actions |
| `components/admin/CreatorReview.tsx` | Revision-aware review controls |
| `public/images/creators/` | Reviewed and optimised delivery images, not PNG masters |
| `components/Header.tsx`, `components/Footer.tsx` | Main store discovery links |
| `components/variant/v2/DossierHeader.tsx`, `DossierFooter.tsx` | `/1` discovery links |
| `components/MarketingOnly.tsx`, `ExitIntentModal.tsx` | Exclude `/creators` and its descendants |
| `lib/admin/nav.ts` | Creator review link in the People group |
| `lib/analytics.ts`, `app/sitemap.ts` | Explicit public-route integration |
| `tests/creators/`, `tests/browser/creators.spec.ts` | Behaviour, permission, persistence and responsive checks |
| `tests/preview/creators.html`, `creators.tsx` | Isolated component fixture with explicit fake adapters |
| `docs/CREATOR-PROGRAM-OPERATIONS.md` | Review cadence, retention and release/rollback |

The proposed migration timestamp must be checked for a collision immediately before creation. If occupied, use a later unique timestamp and update its test references. Do not modify an existing migration.

## Task 1 — Lock the content and creative contract

**Files:** `lib/creators/content.ts`, `lib/creators/types.ts`, `public/images/creators/`, `docs/CREATOR-PROGRAM-OPERATIONS.md`.

**Consumes:** Spec sections 3–8; PNG masters and exact prompts in repository-root `docs/creator-program/`.

**Produces:** `creatorCopy`, `creatorFaqs`, `creatorAssets` and shared input/result types.

- [ ] Confirm the paid-brief offer, funded pilot, permitted page/creative scope and image publication decision. Keep an unapproved build on a local/staging preview with indexing disabled. This is an external business release dependency, not a reason to stop preparing a local implementation.
- [ ] Preserve source masters. Encode reviewed delivery images to WebP or AVIF and inspect the actual face, hand and label at each target crop. Aim at the image budgets in the spec; record exact dimensions/bytes, not a claim that changing extensions optimised them.
- [ ] Create the content manifest and copy the exact proposed public copy/FAQ from the spec. Use integer cents for compensation data:

```ts
export const creatorCopy = {
  name: "ECL Creator Collective",
  route: "/creators",
  cta: "Apply to the collective",
  applicationAnchor: "#apply",
  startingFeeCents: 30_000,
  currency: "AUD",
  heading: ["Your perspective.", "Our next chapter."],
} as const;

export type Discipline = "photography" | "video" | "content";
export type Region = "ACT" | "NSW" | "NT" | "QLD" | "SA" | "TAS" | "VIC" | "WA";
export type Audience = "under-1k" | "1k-10k" | "10k-50k" | "50k-plus";
export type ApplicationStatus = "new" | "shortlisted" | "accepted" | "declined";
export interface CreatorInput {
  name: string;
  email: string;
  socialUrl: string;
  portfolioUrl: string;
  discipline: Discipline;
  region: Region;
  pitch: string;
  audience: Audience | "";
  adultAustralia: boolean;
  contactConsent: boolean;
  website: string;
}
export type FieldErrors = Partial<Record<keyof CreatorInput, string>>;
export type ApplyResult =
  | { ok: true }
  | { ok: false; code: "validation"; fieldErrors: FieldErrors }
  | { ok: false; code: "rate_limited" | "unavailable" | "invalid_request" | "conflict" };
```

- [ ] Define `creatorAssets` entries with `src`, `width`, `height`, `alt`, `objectPosition`, `synthetic` and `publicationStatus: "concept" | "reviewed"`. A production release must not silently treat `concept` as reviewed. Do not introduce an environment switch that itself substitutes for the business decision.
- [ ] Confirm the first-frame review at 1440px and 390px with the actual chosen images before proceeding to the complete page. These are visual checks; do not write tests that merely assert the copy constants equal themselves.

**Deliverable:** Approved-for-build content and correctly documented artwork. Commit only task-owned changes after checking the diff.

## Task 2 — Build the editorial page and privacy destination

**Files:** Creator page, scoped CSS, `CreatorLanding.tsx`, `CreatorStickyApply.tsx`, privacy page.

**Consumes:** Task 1 manifest and the exact design/copy from the spec.

**Produces:** `CreatorLanding({ application }: { application: React.ReactNode })`; `CreatorStickyApply()`; complete server-rendered page with real anchors.

- [ ] Add page metadata with canonical `/creators`, title `Creator Collective` (root title template adds ECL), and a truthful description. No fake review, Person or earnings schema. The privacy page is `noindex, follow` and excluded from the sitemap.
- [ ] Scope the existing fonts on the creator page root using `newsreader.variable`, `inter.variable`, `plexMono.variable`. The page composes `CreatorLanding` with an application slot so the same real layout can be inspected in the isolated preview.
- [ ] Implement all eight spec sections in order. Use `<section aria-labelledby>`, one H1, native `<details>/<summary>` for FAQ and `<a href="#apply">` for CTAs. Keep the exact form section contract:

```tsx
<section id="apply" aria-labelledby="creator-apply-title" tabIndex={-1}>
  <h2 id="creator-apply-title">Let’s make something considered.</h2>
  {application}
</section>
```

- [ ] Implement the critical responsive geometry in a CSS module; extend it with the spacing, rewards and editorial grids in spec section 5:

```css
.root { --creator-paper: #f4f2ed; font-family: var(--font-grotesk), sans-serif; }
.container { max-width: 1200px; margin-inline: auto; padding-inline: 32px; }
.hero { display: grid; grid-template-columns: 5fr 7fr; gap: 40px; padding-block: 80px 104px; }
.headline { font-size: clamp(3rem, 6.1vw, 6rem); line-height: .98; letter-spacing: -.045em; }
.headline em { font-family: var(--font-serif), Georgia, serif; font-weight: 400; }
.heroMedia { position: relative; aspect-ratio: 1.25; overflow: hidden; }
.heroMedia img { object-fit: cover; object-position: 68% 50%; }
.apply { scroll-margin-top: 96px; }
.root :focus-visible { outline: 3px solid #2fd4c8; outline-offset: 4px; }
@media (max-width: 767px) {
  .container { padding-inline: 20px; }
  .hero { grid-template-columns: 1fr; gap: 28px; padding-block: 40px 64px; }
  .headline { font-size: clamp(2.375rem, 12vw, 3.375rem); }
  .heroMedia { aspect-ratio: 4 / 3; }
}
@media (prefers-reduced-motion: reduce) {
  .root *, .root *::before, .root *::after { animation: none !important; transition: none !important; }
}
```

- [ ] Render `next/image` with intrinsic sizes or a positioned `fill` container, appropriate `sizes`, hero priority and later lazy loading. Keep imagery captions outside the image; no baked-in HTML text.
- [ ] Implement sticky mobile application visibility using `IntersectionObserver` for the hero CTA and application section, focus-in/focus-out for form controls, plus existing `useUI()` cart state. Suppress it when the navigation modal is open using a small explicit state signal shared with the header or a scoped dialog observer; document the chosen mechanism. Disconnect observers on unmount. Focus the application heading after sticky activation without scrolling behind the header.
- [ ] Write the privacy notice described in spec section 7 and resolve the actual configured support email server-side. Do not add a global privacy route with unverified generic business identity text.
- [ ] Inspect at 320px, 390px, 768px and 1440px: headings, gutters, original image crop, reward typography, sticky CTA and keyboard focus. Correct composition before wiring data.

**Deliverable:** Finished page layout ready for the application component. No functional-looking fake submit form on the actual route.

## Task 3 — Implement and test pure validation

**Files:** `lib/creators/validation.ts`, `types.ts`, `tests/creators/validation.test.ts`.

**Consumes:** `CreatorInput` and spec field rules.

**Produces:** `validateCreatorInput(value: unknown): { ok: true; value: CreatorInput } | { ok: false; fieldErrors: FieldErrors }`; `canonicalCreatorPayload(input: CreatorInput): string`.

- [ ] Write meaningful validation tests before the validator. Fixtures must use `example.test` email addresses and invented profiles; do not scrape or check whether a supplied profile exists.
- [ ] Require a plain object, field types and both consent booleans. Trim textual fields, lowercase email and enforce all spec lengths and enum membership. Strip URL fragments and tracking query parameters before storage. Reject embedded URL credentials and non-HTTPS schemes. Do not fetch any supplied URL.
- [ ] Use a hostname boundary check for the social allowlist:

```ts
const SOCIAL_HOSTS = ["instagram.com", "tiktok.com", "youtube.com", "youtu.be"];
export function isSocialHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return SOCIAL_HOSTS.some(base => host === base || host.endsWith(`.${base}`));
}
```

- [ ] Test rejection of `instagram.com.evil.test`, `javascript:`, embedded credentials, consent omitted/false, unknown enum values, overlong payload fields and whitespace-only inputs. Test acceptance of valid HTTPS subdomains, optional empty fields, 80-character names and 1000-character pitches. Normalise URLs consistently for idempotency.
- [ ] Build canonical JSON in a fixed property order from validated values only. Do not include the honeypot in accepted stored data, and never treat arbitrary incoming property order as an identity signal.
- [ ] Run `npx vitest run tests/creators/validation.test.ts`; verify failure before implementation and success afterward.

**Deliverable:** Client-safe, deterministic validation with demonstrated input boundaries.

## Task 4 — Add durable private intake and a bounded endpoint

**Files:** Migration, `applications.ts`, API handler, `tests/creators/intake.test.ts`, `tests/creators/intake-sql.test.ts`, `tests/creators/route.test.ts`.

**Consumes:** Validated/canonical application data.

**Produces:** `submitCreatorApplication(input: CreatorInput, context: { idempotencyKey: string; clientAddress: string }): Promise<ApplyResult>` and `POST /api/creators/apply`.

- [ ] Add the initial database columns and defaults below, with SQL `CHECK` constraints matching field lengths/enums/consent. Enable RLS, revoke all table/RPC access from `public`, `anon` and `authenticated`, then grant only explicitly required service-role permissions. Default PUBLIC function execution is already restricted in this repository; grant each new RPC explicitly.

```text
creator_applications
  id uuid primary key default gen_random_uuid()
  created_at timestamptz not null default now()
  updated_at timestamptz not null default now()
  name text not null; email text not null; social_url text not null
  portfolio_url text not null default ''; discipline text not null; region text not null
  pitch text not null; audience text not null default ''
  adult_australia boolean not null check (adult_australia)
  contact_consent boolean not null check (contact_consent)
  privacy_version text not null; consent_at timestamptz not null default now()
  status text not null default 'new'; revision integer not null default 0
  reviewer_email text; internal_notes text not null default ''
  dedupe_key text not null; dedupe_day date not null
  unique (dedupe_key, dedupe_day)

creator_application_requests
  idempotency_key uuid primary key
  payload_hash text not null
  application_id uuid not null references creator_applications(id) on delete cascade
  created_at timestamptz not null default now()

creator_application_limits
  bucket_key text not null; window_start timestamptz not null
  attempt_count integer not null
  primary key (bucket_key, window_start)
```

- [ ] Implement one transaction in `creator_submit_application(p_input jsonb, p_idempotency_key uuid, p_payload_hash text, p_dedupe_key text, p_limit_key text) returns jsonb`. Use a transaction-scoped advisory lock for the idempotency key; replay returns the original success only if its payload hash matches, otherwise conflict. Then atomically increment an hourly rate bucket using UPSERT/row lock. Maximum ten attempts per trusted client address per hour; over-limit requests commit their count and return a typed limited result. Then insert or reuse the email+social same-UTC-day record using the unique key and persist the idempotency request. Never overwrite an earlier application with a second applicant payload. Return only an internal success marker; do not expose the matched application or prior state.
- [ ] Define HMAC-SHA256 hashes with a new server-only `CREATOR_APPLICATION_SECRET`: canonical payload, email+social dedupe identity and client-address/hour bucket. Store no raw client address in these tables. Hash normalised email/social together for dedupe; application email itself remains private contact data. Fixed-order canonical payload must include `privacy_version`. The endpoint must use a deployment-verified trusted ingress address field, not arbitrary first `X-Forwarded-For`; local test fixtures can inject their context. If trusted client identity or required secret/database configuration is unavailable in production, return unavailable rather than disabling the throttle.
- [ ] Add `import "server-only"` in the server adapter and use `supabaseAdmin()` only there. Missing database, invalid RPC response and database errors map to unavailable. Do not log application payloads or sensitive database strings.
- [ ] Implement the handler with these concrete boundaries:

```text
Content-Type: application/json required
Origin: exact match against configured production/staging origins; no wildcard
Body: stream-read with a hard 16 KiB cap; Content-Length is only an early check
Idempotency-Key: required UUID
Invalid origin/type/body/key: HTTP 400 (oversize: 413)
Valid body with field errors or honeypot: HTTP 422
Committed or valid replay: HTTP 200, { "ok": true }
Same key with different payload: HTTP 409
Throttle: HTTP 429, Retry-After to end of current UTC hourly bucket
Missing service/unknown failure: HTTP 503, { "ok": false, "code": "unavailable" }
All responses: Cache-Control: no-store
```

- [ ] Test in disposable PGlite: same key twice gives one record, changed payload conflicts, simultaneous duplicate identities resolve to one record, ten requests allowed/eleventh limited, next bucket accepted, unauthorised roles cannot read or execute, malformed DB input fails, and storage failure never returns success. Separate-session concurrency remains a staging PostgreSQL test, because a single PGlite connection is not proof of inter-session locking.
- [ ] Test route-level origin, actual streamed size, type, idempotency and unavailable branches. Tests must not call production services. Run `npx vitest run tests/creators/intake.test.ts tests/creators/intake-sql.test.ts tests/creators/route.test.ts`.

**Deliverable:** A real, private application can be safely committed and retried without duplicate creation.

## Task 5 — Connect the accessible application form

**Files:** `CreatorApplicationForm.tsx`, creator page composition, `tests/creators/application-form.test.tsx`, isolated creator preview.

**Consumes:** Task 3 validator and Task 4 endpoint/result contract.

**Produces:** `CreatorApplicationForm({ submit }: { submit?: (input: CreatorInput, key: string) => Promise<ApplyResult> })`; default submission uses same-origin API, and only the isolated fixture passes a fake adapter.

- [ ] Write behavioural tests for first-invalid-field focus, pending duplicate-submit prevention, preserved inputs after error, successful replacement of form with confirmation, and retry identity after a transport failure.
- [ ] Implement visible labels, `autocomplete="name"`/`email`, appropriate URL/email input modes and the two unchecked confirmation boxes. Field errors have stable IDs referenced by `aria-describedby`; the first invalid field receives focus. Success uses a focusable heading and `role="status"`; global errors use `role="alert"`.
- [ ] Keep input state in memory. Store only a random UUID in `sessionStorage` for the outstanding request if available; if storage throws, use a memory UUID. Reuse it after an uncertain response with unchanged canonical input. Generate a new key after an input change or a completed submission. Never persist a canonical payload/hash to browser storage because it can represent applicant data.
- [ ] In the default submit adapter, distinguish server failure from network uncertainty. Parse only the enumerated result shape. A network error shows the spec's recoverable failure copy and preserves key/fields. HTTP 429 shows a retry message and retains fields. Do not automatically retry a potentially committed request with a fresh key.
- [ ] Connect the form to the actual page only when the endpoint is present. If applications are deliberately closed, render an honest unavailable/contact panel, not an enabled decorative submit button.
- [ ] In the isolated preview, provide explicit selectable fixture states: valid save, field error, unavailable, rate limit and uncertain response. Keep synthetic UI visibly labelled and outside Next app routes; no real request or email.
- [ ] Run `npx vitest run tests/creators/application-form.test.tsx` and inspect keyboard flow and mobile sticky visibility with an open keyboard/focused input.

**Deliverable:** Users can submit and recover from real failures without losing their work or receiving false confirmation.

## Task 6 — Add minimal protected review operations

**Files:** Admin creator data/actions/pages/control, `lib/admin/nav.ts`, migration reviewer RPC, `tests/creators/admin.test.ts`, `admin-sql.test.ts`.

**Consumes:** Private application records and existing `requireAdmin()` authentication.

**Produces:** `listCreatorApplications({ status, page })`, `getCreatorApplication(id)`, `reviewCreatorApplication({ id, expectedRevision, status, notes })`.

- [ ] Require the admin gate inside every data read and action, even when a surrounding layout is already protected. Validate UUIDs, page bounds, status enum and notes maximum 5000 characters. Page size is 50 with deterministic `created_at DESC, id DESC` ordering.
- [ ] Add the list and detail views with name, discipline, status, submission date and private profile links. Set external links to `target="_blank" rel="noopener noreferrer"`; no embedded remote profiles or automatic portfolio fetching. Escape all applicant and internal text through React.
- [ ] Add `creator_review_application(p_id uuid, p_expected_revision int, p_status text, p_notes text, p_actor text) returns jsonb`. Lock the application, reject stale revisions and illegal transitions, update status/notes/reviewer/revision, and insert `admin_audit_log` in the same transaction. Actor is supplied from `requireAdmin()` server-side, never trusted from the browser. Log changed field names/statuses rather than duplicating full applicant/notes text into an indefinitely retained audit payload.
- [ ] Allow note-only edits with unchanged status and increment revision. Legal status transitions: `new → shortlisted`, `new → declined`, `shortlisted → accepted`, `shortlisted → declined`. Accepted/declined are final in this first release; correct mistakes through a separately reviewed operations procedure rather than an unguarded reset button.
- [ ] Show stale-revision errors with a reload action; do not overwrite another reviewer's changes. Acceptance changes a record only; it sends no message, creates no contract and makes no payment.
- [ ] Add `Creators` to the admin `People` group. Test unauthenticated/not-allowlisted access, atomic audit rollback, stale status conflict, invalid state changes, note-only edits and escaped hostile application text. Run `npx vitest run tests/creators/admin.test.ts tests/creators/admin-sql.test.ts`.

**Deliverable:** A reviewer can find, shortlist and resolve an application with accountable changes.

## Task 7 — Integrate discovery, privacy-aware analytics and retention

**Files:** Both header/footer pairs, `MarketingOnly`, `ExitIntentModal`, `lib/analytics.ts`, `CreatorTracking`, sitemap, operations guide; creator integration tests.

**Consumes:** Working public page, confirmed submission callbacks and protected admin workflow.

**Produces:** Reachable creator journey and non-personal measurement.

- [ ] Add `{ href: "/creators", label: "Creators" }` to both nav arrays and add links in both footers. At intermediate widths, ensure links still fit; reduce nonessential header spacing or move the desktop-nav breakpoint rather than letting links overflow. Update the existing browser test's hard-coded mobile link counts from store 5/dossier 4 to store 6/dossier 5; also assert the new destination explicitly.
- [ ] Exclude creator root and descendants from both marketing components using `^/creators(?:/|$)`. Do not change transaction-route behaviour. Verify page navigation closes existing overlays appropriately.
- [ ] Add only `/creators` to `analyticsAllowed` and the sitemap. Keep `/creators/privacy`, all API routes, admin routes and identifiers excluded. Preserve query/hash/referrer stripping.
- [ ] Add an exported `trackCreatorEvent(event, params)` wrapper around the existing event pipeline. Types restrict event and placement values; explicitly construct allowed event properties instead of spreading form-derived objects. Event definitions:

```ts
type CreatorEvent = "creator_cta_click" | "creator_application_start"
  | "creator_application_submit" | "creator_application_error";
type CreatorPlacement = "hero" | "editorial" | "sticky" | "footer";
type CreatorErrorCode = "validation" | "rate_limited" | "unavailable"
  | "invalid_request" | "conflict" | "network";
```

- [ ] Emit start once per page session on meaningful input, submit only after `{ ok: true }`, and error only with an allowed code. Do not trigger form events on `/creators/privacy`. Analytics failure must never block submission. Test that submitted profile URLs, pitches and emails cannot appear in event payloads.
- [ ] Document a weekly authorised maintenance procedure using a service-only retention RPC: delete applications older than 180 days with status `new`, `shortlisted` or `declined`; cascade request keys; delete throttle buckets older than 48 hours. Accepted contractor records follow their separately established retention basis. Never log deleted record contents. Test age/status boundaries and cascading request cleanup. Arrange a named operator before release; do not silently install a recurring automation during implementation.
- [ ] Run the creator integration tests and the existing shared-component suites: `npx vitest run tests/creators tests/storefront/analytics.test.ts tests/storefront/analytics-loader.test.tsx tests/storefront/exit-intent.test.tsx tests/storefront/discovery.test.tsx`.

**Deliverable:** The page is discoverable, focused and measurable, with an operational privacy lifecycle.

## Task 8 — Verify, stage and hand off release

**Files:** `tests/browser/creators.spec.ts`, fixture, operations guide and task evidence.

**Consumes:** Tasks 1–7 complete. All public launch dependencies remain explicit.

**Produces:** Verified candidate release, screenshots and a release decision the owner can review.

- [ ] Add an isolated creator fixture route/file that imports actual page/form components and local image assets. Keep external network disabled in browser tests as the existing harness does. Extend fixture-specific code without changing real checkout adapters.
- [ ] Add browser checks for all CTA anchors, application focus, FAQ keyboard behaviour, 320/390/1440px fit, hero product/face crop, reduced motion, sticky suppression, backend error states and successful confirmation. Use Axe on the actual rendered creator content. Start browser tests on the existing loopback fixture, not production.
- [ ] Run from `storefront/` and inspect every result:

```sh
npx vitest run tests/creators
npm run typecheck
npm run lint
npm run test:browser -- tests/browser/creators.spec.ts
npm test
npm run build
npm run check:budgets
```

- [ ] Run the existing browser suite once because shared header/footer/overlay behaviour changed. Add a creator-specific 1440px visual inspection if the project config's desktop viewport remains 1280px. A fixture pass is not a real route/database integration pass.
- [ ] In staging with a non-production database, apply only the new migration through the existing runner after reading `docs/MIGRATIONS.md`. Verify actual role grants, two-session races, origin handling behind the deployed proxy, one durable application, a replay, admin read/status change and no outbound emails/payments. Confirm the deployed route has canonical metadata and final chosen images.
- [ ] Capture desktop/mobile screenshots, measured image bytes, accessibility findings and command results in a task-specific evidence directory. Fix issues and rerun only the checks affected by changes, then record remaining external dependencies accurately.
- [ ] Prepare the release sequence: database migration first; application build second; verify route and permissions; then enable public discovery/indexing only with approved scope, offer and imagery. Respect the repository's current deployment hold and coordinated release runbook. Do not deploy automatically just because a build passed.
- [ ] Prepare rollback: remove public links/indexing and disable intake with a truthful unavailable state; roll back application code if needed; retain private submitted applications and schema for review/retention. No destructive down-migration or deletion of legitimate applications as a rollback shortcut.

**Deliverable:** A concrete, reviewable creator-page release with no unverified success claims.

## Conditional future phase — referral program

Do not attach a superficial affiliate link tracker to this release. When products/channels and economics are established, write a separate implementation spec for:

1. Creator agreements, eligibility registry and immutable rate versions.
2. Server-validated referral/code precedence and privacy-aware 30-day attribution, kept separate from `ecl_variant`.
3. Eligible-line discount application within the authoritative quote/order RPCs.
4. Idempotent accrual on actual payment, 30-day vesting, refund adjustments and per-line commission snapshots.
5. A commission/payout ledger with unique payout-line allocation, manual bank reconciliation and balances distinct from transfers actually sent.
6. Synthetic and staging tests for duplicate payment events, cancellations, partial/full refunds, cross-device attribution limits, code abuse, rate changes and payouts after termination.

The proposed 15%/20% commission and 10% customer code economics are specified in the companion design. No current ECL tracking, payout capability or product advertising eligibility is implied.
