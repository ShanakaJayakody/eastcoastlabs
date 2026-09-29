# Admin Revamp with Real-Data Read-Only Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the approved revenue-led, light/dark admin design with a daily quote and publish an authenticated Vercel preview showing real store data without allowing business changes.

**Architecture:** Preserve the existing Next.js routes, admin allow-list and domain actions. Add an admin presentation layer, a dedicated read-side overview projection, and layered preview write protection: explicit action guards, a restricted Supabase transport and blocked non-admin routes/workers. No production promotion, database migration or external dashboard framework.

**Tech Stack:** Next.js 15.5, React 19, TypeScript, Tailwind 4, local Commissioner/Manrope assets, Lucide, Supabase, Vitest/Testing Library and Vercel; existing dependencies only. Node 22.

**Spec:** `docs/superpowers/specs/2026-09-30-admin-preview-integration-design.md`; original workflow constraints in `docs/superpowers/specs/2026-09-29-admin-revamp-design.md`.

## Global Constraints

- “Publish to a Vercel preview URL for owner review; do not promote to production or change the storefront's appearance.”
- “Those three lines must be removed.”
- “Rotate deterministically each Australia/Melbourne calendar day.”
- “No quote API, cron, new dependency, external tracking or database table.”
- “Preserve the latest ordered-product-strength improvements already present on main.”
- “Keep open-work counts independent of chart filters.”
- “Missing data is unavailable, not a successful zero.”
- “This design requires no database schema or business-rule changes.”
- “Authenticated live reads are permitted; business writes from the preview are not.”
- “Do not weaken login, deployment protection or allow-list checks to make a preview reachable.”
- Never import `tests/preview/admin-revamp-data.ts` or its frozen revenue ledger into an application route. Reuse the study's visual treatment, not its sample records or shipping simulation.
- Keep the production revenue/profit calculation API and callers intact. The new overview adapter supplies matched periods without silently changing legacy reporting semantics.
- Keep all Supabase service credentials server-side. Configure only this deployment/branch; do not alter other previews or production settings. Ordinary user-initiated authentication is the sole intentional auth-state exception to read-only review.

## Review Focus

1. A forged server-action call or a GET cron request must not write despite disabled UI controls; Task 1 tests both entry points and transport bypass attempts.
2. A Sydney/Melbourne midnight, DST transition, leap day or short previous month must not shift money/quote days; Tasks 3 and 5 pin calendar behavior.
3. A partial query failure or slow prior request must not replace valid data with zero or stale results; Tasks 5 and 6 test independent failure/retry and out-of-order responses.
4. A long product strength, narrow viewport, browser Back or blocked preference storage must not hide identity or lose the queue; Tasks 4 and 7 test these paths.
5. An existing admin session outside the allow-list, an expired OTP or a stale public cache must not reveal customer data; Tasks 2 and 8 test denial, private headers and normal sign-in.

## Delivery structure

Work in an isolated `codex/admin-revamp-preview` worktree using the worktree skill. Start from current main, which includes the ordered-size fix; never reset the shared working directory. Copy only the two design documents and the approved prototype source/assets needed as reference into the worktree if untracked there. Leave unrelated documents, customer research, local output and other worktrees untouched.

All paths below are repository-relative. Commands run from `storefront` unless a repository-root directory is stated. Each task includes its own red/green test cycle and a scoped commit. Native execution in this session is recommended because the shell, overview and deployment guard share interfaces; perform one independent security/regression review before deployment.

| Ownership | Files |
| --- | --- |
| Preview policy | `lib/admin/preview-policy.ts`, `lib/admin/preview-fetch.ts`, existing auth/middleware/provider boundaries |
| Quotes | `lib/admin/daily-quote.ts`, `components/admin/overview/DailyQuote.tsx` |
| Theme/navigation | existing `AdminShell`, `Sidebar`, `Topbar`, `CommandPalette`, `lib/admin/nav.ts`; new `AdminThemeProvider`, `SectionNav`, `AdminReadOnlyContext` |
| Revenue read model | `lib/admin/overview/types.ts`, `calendar.ts`, `revenue.ts`, `queries.ts`; new guarded overview action |
| Today presentation | `components/admin/overview/RevenueOverview.tsx`, `RevenuePlot.tsx`, `ProgressHighlight.tsx`, `OpenWork.tsx`, `OverviewSection.tsx` and overview CSS |
| Operational presentation | existing list/detail/forms plus a read-only `OrderQuickView` and server read action |
| Hosting evidence | `scripts/verify-admin-preview.mjs`, `docs/admin-revamp/preview-release.md` |

### Task 1: Enforce the real-data preview boundary

**Files:**
- Create: `storefront/lib/admin/preview-policy.ts`, `storefront/lib/admin/preview-fetch.ts`.
- Modify: `storefront/lib/supabase.ts`, `storefront/lib/admin/auth.ts`, `storefront/middleware.ts`, `storefront/lib/email/sender.ts`, `storefront/lib/paid-analytics.ts`.
- Modify mutating action modules: `storefront/app/admin/(dashboard)/orders/{actions,cost-actions,refund-actions,fulfilment-actions}.ts`, `orders/new/actions.ts`, `products/actions.ts`, `customers/{actions,profile-actions}.ts`, `settings/{actions,admin-name-actions}.ts`, `coas/actions.ts`, `reviews/actions.ts`, `discounts/actions.ts`, `creators/actions.ts`, `automation/actions.ts`.
- Test: `storefront/tests/admin/preview-policy.test.ts`, `preview-fetch.test.ts`, `preview-mutations.test.ts`, `preview-routes.test.ts`.

**Interfaces:**
- Produces `isReadOnlyPreview(): boolean`, `assertPreviewWritable(): void`, constant `PREVIEW_READ_ONLY_MESSAGE`.
- Produces `createPreviewDataFetch(baseUrl: string, transport: typeof fetch): typeof fetch`.
- Produces `requireWritableAdmin(): Promise<AdminSession>`; existing `requireAdmin()` retains its read/auth contract.

- [ ] Write failing policy/transport tests, resetting environment and modules per test. Use synthetic URL/key and an injected fetch spy only; no real network in unit tests.

```ts
it('cannot turn preview writes on with a false flag', () => {
  vi.stubEnv('VERCEL_ENV', 'preview');
  vi.stubEnv('ADMIN_PREVIEW_READ_ONLY', '0');
  expect(isReadOnlyPreview()).toBe(true);
  expect(() => assertPreviewWritable()).toThrow(/read.only/i);
});
it('blocks a write before any network request', async () => {
  vi.stubEnv('VERCEL_ENV', 'preview');
  const transport = vi.fn();
  const guarded = createPreviewDataFetch('https://store.test', transport);
  await expect(guarded('https://store.test/rest/v1/orders', {
    method: 'PATCH', body: JSON.stringify({status:'shipped'}),
  })).rejects.toThrow(/read.only/i);
  expect(transport).not.toHaveBeenCalled();
});
it('also rejects a mutating RPC requested using GET', async () => {
  vi.stubEnv('VERCEL_ENV', 'preview');
  const transport = vi.fn();
  const guarded = createPreviewDataFetch('https://store.test', transport);
  await expect(guarded('https://store.test/rest/v1/rpc/admin_delete_order'))
    .rejects.toThrow(/read.only/i);
  expect(transport).not.toHaveBeenCalled();
});
```

- [ ] Run `npx vitest run tests/admin/preview-policy.test.ts tests/admin/preview-fetch.test.ts` and observe failure from missing implementation.
- [ ] Implement the environment policy with fail-closed preview semantics; query strings, cookies and client state never control it.

```ts
export const PREVIEW_READ_ONLY_MESSAGE = 'Read-only preview: store changes are disabled.';
export function isReadOnlyPreview(): boolean {
  return process.env.VERCEL_ENV === 'preview' || process.env.ADMIN_PREVIEW_READ_ONLY === '1';
}
export function assertPreviewWritable(): void {
  if (isReadOnlyPreview()) throw new Error(PREVIEW_READ_ONLY_MESSAGE);
}
// In auth.ts: authorization still precedes the write capability check.
export async function requireWritableAdmin(): Promise<AdminSession> {
  const session = await requireAdmin();
  assertPreviewWritable();
  return session;
}
```

- [ ] Implement the restricted data transport. Normalize string/URL/Request inputs and init method overrides. Validate the destination origin. Check RPC paths before generic GET/HEAD handling; block all RPCs except the exact audited read list below, including RPC GET. Reject unknown paths and all table/storage/auth-admin writes before calling the injected transport. A non-preview call delegates unchanged. Pass `redirect: 'error'` on permitted preview requests so a credentialed redirect is not followed.

```ts
const READ_RPCS = new Set([
  'admin_order_status_counts', 'admin_people_counts', 'admin_settings_snapshot',
  'admin_order_fulfilment', 'admin_lot_catalog', 'admin_fulfilment_report',
  'admin_fulfilment_orders', 'recovery_episode_metrics', 'commerce_reinstatement_preview',
]);
// Review the current SQL definitions for these names before enabling them.
// POST is allowed ONLY to these exact /rest/v1/rpc/<name> paths.
// Other permitted paths: GET/HEAD table/view reads under /rest/v1/ and
// GET/HEAD storage object reads. Unknown RPCs never inherit GET permission.
```

Wire the wrapper into `supabaseAdmin()` and `supabasePublic()` through Supabase `global.fetch`. Keep the cookie-bound auth client separate: it needs ordinary sign-in/session refresh. Block both public and service-role data mutation attempts on the server. Do not describe this as a database-enforced read-only credential: it is an application restriction around the existing key.

- [ ] Add `requireWritableAdmin()` to every mutating admin server action before validation queries/side effects. Keep only the verified read actions using `requireAdmin`: search, revenue loading, `fetchMovements`, price suggestions, and the later overview/quick-view reads. Treat refund quote and carrier preview as blocked operations: names containing “preview” do not prove that their RPCs avoid token/staging writes. Preserve action return/error conventions. Inventory all exported action functions with `rg` and record the classification in the test fixture.
- [ ] Extend middleware's matcher to cover non-static requests, with production behavior unchanged. In read-only preview, redirect `/` to `/admin`, deny all non-admin application/API routes, allow bundled static/image assets, and retain normal admin auth. Explicitly deny GET cron, webhook, checkout, unsubscribe, recovery and subscription-confirmation routes. Do not treat POST as synonymous with mutation: authorized search/revenue actions are still POST requests. Entry-point action guards and transport restrictions remain authoritative even if middleware is skipped or an action ID is submitted to another URL.
- [ ] Guard `sendImmediately`, `drainOutbox`, `dispatchOrderEmails` and the paid-analytics worker with `assertPreviewWritable()` before provider access. Keep all provider/cron credentials absent from the deployment. Add early guards to any additional external side-effect entry point found by the repository scan before enabling live credentials.
- [ ] Add direct exported-action tests using real preview policy and mocked downstream services: payment confirmation, order deletion, stock receipt, product image upload, refund commitment, customer email send and carrier CSV preview each return/throw the read-only error with zero downstream calls. Test one production-mode success against a fake provider to prove ordinary production behavior remains unchanged. Test table POST/PATCH/DELETE, storage upload, encoded/unknown RPC paths, Request method overrides, external-origin requests and allowed report POST reads. Test the cron GET block directly through middleware.
- [ ] Re-run the four new test files and existing admin action/fulfilment/refund tests; typecheck. Commit only the policy, boundary changes and tests with `feat(admin): protect real-data preview from business writes`.

### Task 2: Preserve authentication and private responses

**Files:**
- Modify: `storefront/app/admin/login/actions.ts`, `storefront/lib/admin/auth-actions.ts`, `storefront/next.config.ts`.
- Create: `storefront/lib/admin/preview-origin.ts`.
- Test: `storefront/tests/admin/preview-auth.test.ts`, existing `login-link.test.ts`, `storefront/tests/admin/preview-headers.test.ts`.

**Interfaces:**
- Consumes `isReadOnlyPreview()` and the unchanged `requireAdmin()` allow-list.
- Produces `adminAuthOrigin(): string`; preview callback origin is the verified Vercel deployment/branch URL, never a request-controlled Host header.

- [ ] Write failing tests for preview OTP callback origin, missing preview origin (must error, never fall back to production), anonymous redirect, non-allow-listed 403 and no login/logout audit insert. Assert ordinary production login retains audit recording.

```ts
it('uses this preview for the callback without enabling store writes', () => {
  vi.stubEnv('VERCEL_ENV', 'preview');
  vi.stubEnv('VERCEL_URL', 'ecl-reviewed-preview.vercel.app');
  expect(adminAuthOrigin()).toBe('https://ecl-reviewed-preview.vercel.app');
});
```

- [ ] Run the new tests red, then implement the validated origin helper and use it for the existing OTP callback URL. Only accept the configured known origin; reject malformed values. Do not generate admin codes, bypass allow-list checks or copy a user's browser session.
- [ ] Skip `logAudit` only in preview authentication callers after successful login/logout; keep Supabase auth/session activity normal. Do not globally suppress business audit behavior or swallow failed writes.

```ts
if (!isReadOnlyPreview()) {
  await logAudit({ actor: clean, action: 'login' });
}
```

- [ ] Add `/admin/:path*` to the private response header configuration: `Cache-Control: private, no-store, max-age=0`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow, noarchive`. Middleware denials receive the same protection. Do not cache authenticated overview responses in a shared cross-user cache.
- [ ] Run auth/header tests and the existing login-link tests. Commit with `fix(admin): isolate preview sign-in and private responses`.

### Task 3: Replace the introduction with a daily quote

**Files:**
- Create: `storefront/lib/admin/daily-quote.ts`, `storefront/components/admin/overview/DailyQuote.tsx`.
- Modify: `storefront/tests/preview/admin-revamp-overview.tsx` (local reference parity only).
- Test: `storefront/tests/admin/daily-quote.test.ts`, `daily-quote-ui.test.tsx`.

**Interfaces:**
- Produces `dailyQuote(now: Date): {id: string; text: string; day: string}`, `nextQuoteDelay(now: Date): number` and `DailyQuote({initial}: {initial: ReturnType<typeof dailyQuote>})`.
- The server provides `initial` for hydration; the client updates after midnight and on visibility change.

- [ ] Write failing deterministic-date tests and a fake-timer UI test: the same local date yields the same quote; different local dates advance; a UTC date boundary alone does not; crossing Melbourne midnight does. Unmount cancels timers/listeners.

```ts
it('rotates on Melbourne midnight, not UTC midnight', () => {
  const before = dailyQuote(new Date('2026-09-30T13:59:59Z'));
  const after = dailyQuote(new Date('2026-09-30T14:00:00Z'));
  expect(before.day).toBe('2026-09-30');
  expect(after.day).toBe('2026-10-01');
  expect(before.id).not.toBe(after.id);
});
it('does not rotate twice when clocks change', () => {
  expect(dailyQuote(new Date('2026-10-03T15:30:00Z')).id)
    .toBe(dailyQuote(new Date('2026-10-03T16:30:00Z')).id);
});
```

- [ ] Run red, then create the initial original quote collection. No fabricated attributions:

```ts
export const QUOTES = [
  'Let your purpose set the direction. Let your discipline set the pace.',
  'Ambition becomes progress when it has a place in your calendar.',
  'Protect the standard, especially when no one is watching.',
  'Make today a clear step towards the work you want to be known for.',
  'Build the habits that make your goals believable.',
  'Do the important work before the comfortable work.',
  'A strong purpose deserves a consistent effort.',
  'Raise the quality of the work, and let the results follow.',
  'Choose the next right action. Then give it your full attention.',
  'The future you want is built in the decisions you repeat.',
  'Work with urgency. Think with patience.',
  'Keep your ambition high and your next step clear.',
  'Measure progress honestly. Celebrate it generously.',
  'Let excellence be a practice, not an occasion.',
  'Create something useful enough to earn its place in the world.',
  'Your standards are built one decision at a time.',
  'Start with purpose. Finish with care.',
  'Consistency gives ambition somewhere to go.',
  'The smallest meaningful action is worth more than a perfect intention.',
  'Make room for the work that moves the mission forward.',
  'Build trust at the same pace you build the business.',
  'A good day is one that moves the important things forward.',
  'Turn what you learn into how you work.',
  'Aim for a result you can be proud to stand behind.',
  'Be patient with the outcome and demanding of the effort.',
  'Give your best attention to what deserves your best work.',
  'A clear priority makes a thousand small decisions easier.',
  'Success is stronger when it serves a purpose beyond itself.',
  'Keep showing up for the future you believe in.',
  'Let the next step reflect the size of your ambition.',
  'Progress compounds when the standard stays high.',
] as const;
```

Use `Intl.DateTimeFormat(..., {timeZone:'Australia/Melbourne', year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(now)`; derive a civil `YYYY-MM-DD`, convert that civil day to a UTC day ordinal only for indexing, and select a normalized modulo of `QUOTES.length`. Do not index by elapsed local-midnight milliseconds across DST.
- [ ] Render a compact `<blockquote>` with no promotional eyebrow/subtitle and no invented author. Keep an accessible Today H1 in the topbar. Schedule the next local-day change with this helper, then reschedule after each tick and on visibility return; no background request or animation. Validate finite input dates in `dailyQuote`. Test timer/listener cleanup and the exact day boundary.

```ts
export function nextQuoteDelay(now: Date): number {
  const start = now.getTime();
  const day = dailyQuote(now).day;
  let low = start + 1, high = start + 27 * 60 * 60 * 1000;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (dailyQuote(new Date(middle)).day === day) low = middle + 1;
    else high = middle;
  }
  return Math.max(1, low - start);
}
```
- [ ] Replace the fixture's three intro lines with this component for parity; assert all three rejected strings are absent. Run quote tests green, then commit with `feat(admin): show a purposeful daily quote`.

### Task 4: Build the shared brand shell and complete themes

**Files:**
- Modify: `storefront/lib/admin/nav.ts`, `storefront/components/admin/{AdminShell,Sidebar,Topbar,CommandPalette,ConfirmModal}.tsx`, `storefront/app/admin/(dashboard)/layout.tsx`, `storefront/app/globals.css`.
- Create: `storefront/components/admin/{AdminThemeProvider,SectionNav,AdminReadOnlyContext}.tsx`, `storefront/components/admin/admin-workspace.css`.
- Test: `storefront/tests/admin/workspace-navigation.test.ts`, `workspace-theme.test.tsx`, `workspace-shell.test.tsx`.

**Interfaces:**
- Preserve `NAV` as the complete command-palette registry.
- Add `WORKSPACES`, `workspaceForPath(pathname: string): Workspace`, with `Workspace = {id: string; label: string; href: string; routes: readonly string[]}`.
- Produce `useAdminTheme(): {theme:'light'|'dark'; setTheme:(theme:'light'|'dark')=>void}` and `useAdminReadOnly(): boolean`. Read-only context receives a server boolean, never controls the server policy.

- [ ] Write failing tests that every original NAV destination is reachable, nested product/order routes select the correct workspace, `/admin/orders/fulfilment` remains reachable from both inventory and orders contexts, and Back navigation updates the active secondary tab. Use the exact mapping:

```ts
const mapping = {
  Today: ['/admin'],
  Orders: ['/admin/orders'],
  Catalogue: ['/admin/products','/admin/stock','/admin/pipeline','/admin/coas'],
  Customers: ['/admin/customers','/admin/recovery','/admin/reviews'],
  Marketing: ['/admin/creators','/admin/discounts','/admin/email-templates'],
  Reports: ['/admin/reports','/admin/fulfilment'],
  Settings: ['/admin/settings','/admin/automation','/admin/audit'],
};
```

- [ ] Run red; implement longest-path matching with an exact `/admin` special case. Seven sidebar destinations, subordinate links per workspace and all original routes in command search. Keep old bookmarks resolving; do not create placeholder destinations.
- [ ] Write and run failing theme tests for default light, saved dark, invalid stored preference, denied storage, route changes and matching toast/dialog styling. Implement an admin-scoped theme attribute and a cookie-backed initial preference (whitelisted to light/dark), then persist the user's switch. Storage/cookies contain appearance only, never records or credentials.

```css
.admin-theme[data-admin-theme="light"] {
  --color-ink: #f5f7fb; --color-ink-2: #ffffff;
  --color-surface: #ffffff; --color-surface-2: #edf3f7;
  --color-fg: #152e46; --color-fg-2: #334b62;
  --color-muted: #536577; --color-line: #dbe3e9;
  --color-accent: #245cff; --color-accent-2: #245cff;
  color-scheme: light;
}
.admin-theme[data-admin-theme="dark"] {
  --color-ink: #0d1420; --color-ink-2: #121d2d;
  --color-surface: #192638; --color-surface-2: #203149;
  --color-fg: #f1f5fb; --color-fg-2: #c8d4e3;
  --color-muted: #b1bfd1; --color-line: #35475e;
  --color-accent: #a8bdff; --color-accent-2: #a8bdff;
  color-scheme: dark;
}
```

Carry forward all remaining admin tokens with verified contrast, including warning/success/destructive and muted-2. Use scoped selectors; no blanket inversion of images or global storefront tokens. Match the fixture's local logo/fonts, 232px sidebar, calm cards and 44px controls. Remove aurora and route entrance effects inside this shell.
- [ ] Supply `readOnly={isReadOnlyPreview()}` from the guarded server layout. Show a small “Preview · real store data · read-only” label; no repeated promotional copy. Context is for clear disabled controls, not security. Audit portal containers for the theme attribute so dialogs/search/toasts inherit both modes.
- [ ] Test the mobile nav as an accessible dialog: focus enters it, Tab remains within it, Escape/backdrop closes it and focus returns. Reuse the existing `useDialogFocus` helper. Run new tests and typecheck green; commit with `feat(admin): add branded workspace navigation and light dark themes`.

### Task 5: Add an accurate live overview projection

**Files:**
- Create: `storefront/lib/admin/overview/{types,calendar,revenue,queries}.ts`, `storefront/app/admin/(dashboard)/overview-actions.ts`.
- Read/reuse, without changing legacy semantics: `storefront/lib/admin/{order-queries,paging,attention,products}.ts`.
- Test: `storefront/tests/admin/overview-calendar.test.ts`, `overview-revenue.test.ts`, `overview-queries.test.ts`.

**Interfaces:**

```ts
export type OverviewRange =
  | {kind:'today'|'week'|'month'}
  | {kind:'custom'; from:string; to:string};
export type PaidOrderFact = {id:string; paid_at:string; total_cents:number};
export type OverviewWindow = {
  from:string; until:string; previousFrom:string; previousUntil:string;
  labels:string[]; previousLabels:string[];
  bounds:({from:string;until:string}|null)[];
  previousBounds:({from:string;until:string}|null)[];
  label:string; comparisonLabel:string; timing:string;
};
export type RevenueOverviewData = {
  asOf:string; range:OverviewRange; window:OverviewWindow;
  points:{label:string; previousLabel:string; cents:number|null; previousCents:number|null}[];
  totalCents:number; previousTotalCents:number;
  paidOrderCount:number; averageCents:number|null; changePercent:number|null;
};
export function overviewWindow(range:OverviewRange, now:Date):OverviewWindow;
export function aggregatePaidRevenue(facts:PaidOrderFact[], range:OverviewRange, now:Date):RevenueOverviewData;
export async function getOverviewRevenue(range:OverviewRange, asOf?:Date):Promise<RevenueOverviewData>;
export async function loadOverviewRevenue(range:OverviewRange):Promise<RevenueOverviewData>;
```

- [ ] Write the range tests before implementation. Pin Today to matched wall-clock time yesterday; week to the seven completed local days and their immediately preceding seven; month to elapsed days/time versus the prior month, clamped to a shorter previous month; custom to inclusive completed dates with an equal-length preceding window. Cap custom spans at 366 days and reject malformed, impossible, reversed, future or partial-today custom dates with a clear error. Keep a zero-prior baseline as `changePercent: null`.

```ts
it('compares the same elapsed time for today', () => {
  const w = overviewWindow({kind:'today'}, new Date('2026-09-29T02:00:00Z'));
  expect([w.from,w.until]).toEqual(['2026-09-28T14:00:00.000Z','2026-09-29T02:00:00.000Z']);
  expect([w.previousFrom,w.previousUntil]).toEqual(['2026-09-27T14:00:00.000Z','2026-09-28T02:00:00.000Z']);
});
it('never converts an unavailable denominator into growth', () => {
  const data = aggregatePaidRevenue([], {kind:'week'}, new Date('2026-09-29T02:00:00Z'));
  expect(data.totalCents).toBe(0);
  expect(data.changePercent).toBeNull();
  expect(data.averageCents).toBeNull();
});
```

- [ ] Run red. Implement pure calendar helpers with `Australia/Melbourne` wall-clock components and verified UTC offsets. Civil-day arithmetic uses UTC date tuples, not `24h` additions to local-midnight instants. For hourly Today buckets, retain actual start/end instants on 23/25-hour days, label offset where duplicate hours occur, and aggregate without losing repeated-hour revenue. Align relative bucket positions; pad any unmatched bucket with a null bound/value and a “No matching interval” label, never invented zero revenue. The figures table shows each side's actual timestamp/label and preserves both totals. For daily comparisons use the same null padding and document short-month clamps in `timing`.
- [ ] Add paid-cohort tests: pending order excluded, refunded order retains gross paid takings, duplicate identical fact ID counted once, conflicting duplicate facts rejected, payment time—not creation time—sets its bucket, endpoint timestamps follow `[from,until)`, and all cents remain integers. Invalid timestamps, negative/unsafe/non-finite totals or missing paid totals must fail visibly rather than become zero. Verify totals equal sums of non-null points for current and prior periods, including a single-day custom range, DST unmatched intervals and leap-day month.
- [ ] Implement aggregation with distinct paid order IDs, integer cents and `averageCents = count ? Math.round(total/count) : null`. Format the visible metric explicitly as paid revenue before refunds; do not call it net revenue, profit or bank balance. Paid order facts contain no customer names/emails.
- [ ] Implement the server query using `adminDb()` and `fetchAll`: select `id,paid_at,total_cents`, require non-null paid_at, use the earliest current/prior start and latest end as bounds, order by unique `id`, and page until all rows are read. Throw on database or pagination failures. Tests mock a dataset exceeding 1,000 rows and a failure on the second page; neither may silently truncate into a plausible total.
- [ ] Implement the action with authorization and runtime input validation before querying:

```ts
export async function loadOverviewRevenue(range: OverviewRange) {
  await requireAdmin();
  return getOverviewRevenue(range);
}
```

`getOverviewRevenue` validates runtime discriminants and fields too; the TypeScript union is not a network validation boundary. Capture one `asOf` instant per request. Do not fetch an arbitrary number of days from an unvalidated input.
- [ ] Run all overview tests and legacy revenue/economics/count tests green, then commit with `feat(admin): project live paid revenue with matched periods`.

### Task 6: Integrate the quieter, revenue-led Today screen

**Files:**
- Modify: `storefront/app/admin/(dashboard)/page.tsx`, `storefront/app/admin/(dashboard)/reports/page.tsx`.
- Create: `storefront/components/admin/overview/{RevenueOverview,RevenuePlot,ProgressHighlight,OpenWork,OverviewSection}.tsx`, `storefront/components/admin/overview/overview.css`.
- Reuse: Task 3 `DailyQuote`, existing `RevenueChart` for detailed financial analysis, `ActionQueue`, `Nudges`, canonical order links.
- Test: `storefront/tests/admin/overview-ui.test.tsx`, `overview-sections.test.tsx`.

**Interfaces:**
- `RevenueOverview({initial}: {initial:RevenueOverviewData})` consumes `loadOverviewRevenue`.
- `RevenuePlot({data,compare}: {data:RevenueOverviewData;compare:boolean})` renders chart/keyboard points with exact values table available in the parent.
- `ProgressHighlight({month}: {month:RevenueOverviewData})` renders a verified month-to-date highlight, not an invented target.
- `OpenWork({counts}: {counts:{toFulfil:number;pendingPayment:number;lowStock:number}})` links to real filtered queues.
- `OverviewSection({title,children}: {title:string;children:React.ReactNode})` is a small client error boundary with a retry action, wrapping independently suspended server reads.

- [ ] Add failing interaction tests for period changes, comparison checkbox, custom validation, figures table, zero/negative periods, keyboard arrows/Home/End and out-of-order responses. Use deferred promises for an older response arriving after a newer selection. A rejected fetch must preserve the last successful chart and display an error, not invent zero.

```ts
it('opens real queues without passing the revenue period', () => {
  render(<OpenWork counts={{toFulfil:8,pendingPayment:3,lowStock:2}}/>);
  expect(screen.getByRole('link',{name:/orders to fulfil/i}))
    .toHaveAttribute('href','/admin/orders?status=to_fulfil');
  expect(screen.getByRole('link',{name:/awaiting payment/i}))
    .toHaveAttribute('href','/admin/orders?status=pending');
  expect(screen.getByRole('link',{name:/low stock/i}))
    .toHaveAttribute('href','/admin/products?low=1');
});
```

- [ ] Run red. Adapt the approved chart SVG/layout into production components using Task 5 data only. Use readable responsive axes, theme tokens, zero baseline, previous-period dashed line, roving keyboard focus, accessible data readout and View figures. Render null unmatched intervals as gaps/“No matching interval”, not $0; skip nonexistent chart-point buttons while preserving keyboard traversal of actual points. Do not carry the fixture's canned values/date captions or milestone data.
- [ ] Keep period state in validated URL parameters (`range`, `from`, `to`), separate from open work. Default to last seven completed days. Update history without discarding unrelated params; Back restores the displayed period. On router refresh, accept the new server data rather than retaining stale client totals. Use a monotonic request ID to discard out-of-order results.
- [ ] Replace the page introduction with the server-seeded daily quote and Open orders shortcut. Wrap revenue, monthly highlight, open-work counts, urgent failures and the oldest paid-order queue in independent suspense/error boundaries. Keep blocking operational failures visible above the chart. Fetch order rows using existing list queries; order paid/processing work by paid time when available with a deterministic fallback rather than claiming created time is payment age.
- [ ] Keep existing urgency logic from `attentionQueue`, and retain its review/restock/payment coverage. Present secondary recovery, pipeline, review and automation information through concise links/disclosures rather than silently removing it. Move detailed revenue/profit/refund/coverage analysis to Reports using the existing RevenueChart and its original API; retain existing report tabs and query parameters.
- [ ] Implement a truthful branded highlight: show month-to-date paid revenue and the strongest completed revenue day if positive. If there are no completed paid days, display a neutral month summary. No percentage ring against an invented $20,000 goal, no hard-coded $18,000 celebration. A dismissible milestone message is permitted only when the paid ledger proves a crossed threshold in the current month; do not infer first-ever success from one month's data.
- [ ] Match the reviewed responsive order: quote/shortcut → chart → all-open shortcuts → highlight → oldest work on mobile. Keep chart dominant beside the highlight on desktop. Use larger supporting type and restrained warm accents without additional slogans.
- [ ] Run component/section tests green and verify existing report tests. Commit with `feat(admin): integrate revenue-led Today overview`.

### Task 7: Adapt operational screens without changing domain behavior

**Files:**
- Modify: `storefront/components/admin/{OrdersFilters,OrdersTable,ProductsTable,ProductSearch,OrderActions,OrderItemsPanel,PackingMode,LotPacking,RefundReview,RefundSettlements,OrderCosts,ProductEditor,ProductSizesEditor,StockManagement,StockDrawer,StockHistory,CoaManager,SettingsForm,AdminNames,CustomerControls,CustomerDetails,DiscountsManager,ReviewModeration,CreatorApplicationDetail,EmailOperationControls,ActionQueue}.tsx` as needed for scoped presentation and explicit disabled write controls.
- Modify: existing Orders/Products page layouts; preserve their query/URL parsing and pagination.
- Create: `storefront/components/admin/OrderQuickView.tsx`, `storefront/app/admin/(dashboard)/orders/preview-actions.ts`.
- Test: `storefront/tests/admin/order-quick-view.test.tsx`, `workspace-operational-ui.test.tsx`; run existing domain interaction tests.

**Interfaces:**
- `loadOrderPreview(id:string): Promise<OrderDetail|null>` calls `requireAdmin` then `getOrder` after strict UUID validation; no writes.
- `OrderQuickView({orderId,onClose}: {orderId:string;onClose:()=>void})` is a read-only contextual view with a link to `/admin/orders/<id>` for the complete existing workflow.
- UI components consume `useAdminReadOnly`; server actions retain Task 1 protection regardless of UI state.

- [ ] Write failing tests that a detail preview leaves the list's URL, filters and selection unchanged; Escape closes and restores the initiating row focus. A missing/deleted order shows unavailable state and Close, not another order's cached details. Slow responses cannot overwrite a later selected order.
- [ ] Run red; add an explicit row “Quick view” control without removing the canonical order link. Show payment/status, full frozen product size identity, quantities, wait and total; reuse `orderItemVariantIdentity`. Do not build a second refund/dispatch state machine inside the drawer. Use the existing focus helper and full-screen narrow layout.
- [ ] Style Orders and Catalogue to the approved comfortable table/filter system through reusable tokens/classes. Preserve status counts, multi-selection, partial-failure reporting, search, sorting, date/discount filters and pagination. Preserve Catalogue's actual grouped sizes, low-stock semantics, stock accounting and unsaved-change handling.
- [ ] Wire read-only context into mutation controls using native disabled buttons or fieldsets with adjacent explanation. Do not disable search, tabs, filters, export, scrolling, appearance, quote or view-only dialogs. Add a full-action-source audit so no save, delete, upload, send, confirm, bulk, record or allocation control implies an available live operation. Business operations remain blocked server-side if a control is missed.

```tsx
const readOnly = useAdminReadOnly();
<button disabled={readOnly || pending} onClick={save}>
  Save changes
</button>
{readOnly && <p className="text-sm text-muted">Read-only preview. Store changes are disabled.</p>}
```

- [ ] Test an unusually long ordered size (`3-pack · 10 mg/mL` with a changed catalogue label), long customer names, status text without relying on color, 320px card layouts and disabled save controls. Run original partial-bulk-failure, refund, packing, product-size and deletion-confirmation tests in production-mode fixtures to prove no semantic regressions.
- [ ] Visit all seven workspace groups and every secondary destination. Apply scoped theme corrections to hard-coded white/dark surfaces in existing panels without replacing domain components. Do not silently drop any screen because only three appeared in the prototype. Commit with `feat(admin): streamline operational views and preserve workflows`.

### Task 8: Verify, review and deploy the guarded preview

**Files:**
- Create: `storefront/scripts/verify-admin-preview.mjs`, `docs/admin-revamp/preview-release.md`.
- Modify: `.vercelignore` only if the clean checkout still includes non-deployable evidence/reference files; never weaken secret exclusions.
- Test: all tests plus local browser scenarios and read-only hosted smoke checks.

**Interfaces:**
- Verification script accepts a URL as its sole argument, performs non-mutating HTTP checks only, emits status/headers rather than page contents or personal records, and exits nonzero on a failed assertion.
- Release note records branch/commit, real preview URL/deployment ID, actual test counts, data boundary, tested screens and remaining limitations. Never store customer records or credentials in evidence.

- [ ] Run the full unit/regression suite, typecheck, lint and a production build with isolated output. Keep real service/provider secrets out of the unit test process. Use synthetic build credentials or no credentials unless the build explicitly needs an authorized read; do not allow a build-time mutation.

```sh
npm test
npm run typecheck
npm run lint
NEXT_DIST_DIR=.next-admin-preview-check npm run build
git diff --check
```

- [ ] Inspect the diff for synthetic fixtures in app imports, auth bypasses, generated assets containing personal data and service-key exposure. Verify default non-preview behavior still permits domain writes in isolated tests. Request an independent security/regression review using the code-review skill; resolve findings before credentials or hosting changes.
- [ ] With the browser skill, check synthetic local interactions at 320/390/768/1440px in both modes. Verify keyboard/focus, quote date rollover, URL/back behavior, search, forms, comparison accuracy, figures, no overflow, dark portals and failure recovery. Mutating flow tests use synthetic/local fixtures only. Reset viewport overrides after checks.
- [ ] Reconfirm the existing Vercel project association and current CLI command help before deployment. Use a clean scoped checkout and branch `codex/admin-revamp-preview`, never the shared root containing unrelated untracked files. Deploy only reviewed changes; do not merge/push main or use `--prod`.
- [ ] Configure the exact preview deployment or this branch's Preview scope with only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `ADMIN_PREVIEW_READ_ONLY=1`. Obtain the existing values through authorized local/project configuration without printing, committing, placing secrets in shell arguments, or copying the complete production environment. No `DATABASE_URL`, Resend/SMS/GA4/payment/carrier keys, cron/webhook secrets or real analytics IDs. Set the auth callback origin from the verified Vercel system deployment URL. Confirm branch/deployment scoping is supported by the installed CLI before writing settings; do not broaden all-project preview configuration silently.
- [ ] Trigger the Preview deployment using the existing project, wait for a ready build, and record the actual URL. Leave deployment protection enabled. If Supabase rejects the exact new callback origin, report that specific auth configuration requirement; do not add a broad wildcard or bypass login. The owner can enter the normal admin OTP themselves; never mint a code with an admin escape hatch.
- [ ] Implement/run the read-only smoke verifier against the returned URL. Do not send a real order mutation to prove it fails: use harmless nonexistent synthetic identifiers only if needed and independently verified guard coverage; the primary write tests already use mocked/local transports. Check anonymous redirect, private headers and blocked cron/public write routes before browsing authenticated real data.

```js
// verify-admin-preview.mjs: no auth/session extraction, no response-body logging.
const target = new URL(process.argv[2]);
if (target.protocol !== 'https:') throw new Error('Use the HTTPS preview URL');
const result = await fetch(new URL('/admin', target), {redirect:'manual'});
if (![302,303,307,308,401,403].includes(result.status)) {
  throw new Error('Expected login redirect or deployment protection');
}
console.log({path:'/admin',status:result.status,cache:result.headers.get('cache-control')});
// Deployment-protection 401/403 is not proof of the application's auth gate;
// record it as an unverified app check until the owner signs in normally.
```

Expand assertions for application responses: no public cache, expected `/admin/login` redirect, business cron routes denied, no customer data returned anonymously. Distinguish Vercel protection from application authorization; never label an untested protected response as a full pass.
- [ ] After normal owner sign-in, visually inspect Today, Orders, an order detail, Catalogue and secondary workspace navigation using real reads only. Do not click write controls or trigger outbound messages. Do not retain screenshots containing real names/emails/order details in the repository; use synthetic screenshots for handoff visuals.
- [ ] Record exact verification results and any checks requiring owner login. Deliver the ready Preview URL and clearly state that production was not promoted and all business mutations are disabled. Commit the non-sensitive release note. The production release remains a separate user decision.

## Plan self-review

- Quote, full themes, all destinations, new date presets, honest revenue/milestones, mobile priorities and operational preservation each map to Tasks 3–7.
- Real-data authorization, server enforcement, outbound suppression and auth privacy map to Tasks 1–2 and the pre-credential review in Task 8.
- All five Review Focus items have explicit tests in their owning task. Data/model/component/action names are consistent between tasks.
- No new service/project, migration, quote API, production release or mutation smoke test against a customer record is included.
- Execution is gated on owner review of this plan and selection of native or subagent-driven execution.
