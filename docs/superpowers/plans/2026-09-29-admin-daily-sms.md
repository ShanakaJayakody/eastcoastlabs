# Daily Admin SMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution or superpowers:subagent-driven-development if the user selects delegation. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one concise daily business and fulfilment SMS per unique phone in Mobile Message's ECL Directors list through Mobile Message, with delivery records and operational controls.

**Architecture:** Reuse daily-brief calculations, add a separate leased SMS outbox and a server-only Mobile Message adapter, and drive a Melbourne-time morning worker through existing schedulers. Resolve recipients from ECL Directors, protect delivery callbacks with signatures and expose list membership, previews, status and pause controls in admin Settings. Keep customer SMS automation outside this release.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase PostgreSQL, native fetch, Vitest, PGlite, disposable native PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-09-29-admin-daily-sms-design.md`

## Global Constraints

- `ADMIN_SMS_ENABLED=false` is the deployment gate. Missing configuration fails closed.
- ECL Directors list ID `28556` is the authoritative SMS recipient source, verified as four contacts/four unique phones. Fully paginate membership, normalize to `614xxxxxxxx`, respect opt-outs and deduplicate by phone/local send date.
- Manage recipient membership in Mobile Message and display it read-only in the platform; membership does not grant dashboard access.
- Preserve the user's exact five lines: `Daily ECL Director Update:`, `Yesterday's Revenue:`, `Overdue Orders to fulfil:`, `Monthly Revenue:`, `Low Stock:`. No added link, date, paid-order count or payment follow-ups in the body.
- Use current dashboard data: yesterday's paid revenue, exact paid/processing orders overdue by more than 24 hours in their fulfilment queue, current calendar-month revenue and current low-stock thresholds. AUD amounts retain cents.
- Working low-stock scope is the six products named by the user, in their stated order; an optional all-products clarification is pending. Deduplicate pack variants; Sema means Semaglutide, never Semax. Use `None` for no current alerts and fail on missing data.
- Maximum two GSM segments (306 septets for multipart messages); provider `max_parts=2`, Unicode disabled, URL shortening disabled. Show the exact segment count; do not silently shorten or omit required figures to fit.
- Proposed delivery window: 08:00–09:00 Australia/Melbourne daily, with recovery before noon; awaiting user confirmation.
- Customer SMS automation is excluded.
- Never expose credentials or use operational credentials in automated tests.
- Preserve unrelated working changes and use an isolated worktree at execution time.

## Review Focus

- Duplicate list contacts share one normalized phone: exactly one daily intent and provider message. Missing lists, incomplete pagination and failed membership reads must not fall back to cached recipients.
- A timeout followed by API credential rotation: retain the uncertain intent and reconcile rather than creating a second send.
- More than 25 overdue orders: report the true database count rather than the capped attention list.
- A callback arrives before the send response, arrives twice or covers only one of two SMS parts: preserve each part's monotonic state and report complete delivery only after all expected parts are delivered.
- An admin also exists as a customer: marketing unsubscribe/email corrections do not redirect internal alerts or silently alter SMS recipients.

## Shared interfaces

```ts
type AdminSmsSummary = {
  reportDate: string; asOf: string; month: string;
  yesterdayRevenueCents: number; monthRevenueCents: number;
  overdueFulfilment: number;
  lowStockNames: string[];
};
type FrozenSms = {
  id: string; toPhone: string; sender: string; body: string;
  idempotencyKey: string; credentialFingerprint: string;
};
type SmsSendResult =
  | { kind: 'accepted'; messageId: string; credits: number }
  | { kind: 'retryable' | 'rejected' | 'uncertain'; reason: string };
// lib/sms/format.ts
// normalizeAustralianMobile(input: string): string | null
// renderAdminSms(summary: AdminSmsSummary): string
// lib/sms/mobile-message.ts
// sendMobileMessage(message: FrozenSms): Promise<SmsSendResult>
// getMobileMessageBalance(): Promise<number>
// listAdminSmsRecipients(): Promise<Array<{contactId:number;name:string;phone:string}>>
// lib/admin/daily-sms.ts
// runDailyAdminSms(now?: Date): Promise<Record<string, number | string | boolean>>
```

### Task 1: Workflow settings, exact totals and durable delivery state

**Files:** Create the next available `storefront/supabase/migrations/<timestamp>_admin_daily_sms.sql`, `storefront/tests/admin/daily-sms-sql.test.ts`, `storefront/scripts/postgres-admin-sms-checks.mjs`; modify `storefront/scripts/verify-postgres.mjs` to include the concurrency checks.

**Consumes:** Existing `admin_users`, order `action_queue_entered_at`, dashboard revenue windows and stock thresholds, admin audit log and email-outbox access patterns.

**Produces:** Admin workflow-settings RPCs, an exact operational-count RPC, and queue/claim/authorize/finish/report SMS RPCs with service-only permissions.

- [ ] Write PGlite tests applying the migration chain with synthetic admins and orders. Pin deduplication with two provider contacts sharing `61400000001`; pin true backlog counts with 60 paid orders.

```ts
const recipients = [
  {contactId:1,name:'Alex',phone:'61400000001'},
  {contactId:2,name:'Alex duplicate',phone:'61400000001'},
];
// Pass this verified recipient snapshot to the queue RPC twice for one date.
// Assert persisted intents, not fake-provider call counts.
expect((await db.query('select to_phone from admin_sms_outbox')).rows)
  .toEqual([{to_phone:'61400000001'}]);
```

- [ ] Run `npm test -- tests/admin/daily-sms-sql.test.ts`; confirm the expected missing-schema/behavior failure before writing the migration.
- [ ] Add default-paused settings and `admin_sms_outbox`. Use a unique `(local_send_date,to_phone)` key for the daily template; tests use separate explicit intent identities. Store source list/contact snapshots, frozen request fields, credential fingerprint, first-attempt time, expiry, lease, retry time, message ID, credits and error state.
- [ ] Implement atomic RPCs for settings saves with audit, enqueue, one-row leasing, last-moment authorization, outcome recording and monotonic callback updates. Authorization consumes a freshly verified provider-membership result and rechecks database pause/lease state. Restrict mutations to service-role callers and deny public/authenticated access.
- [ ] Implement an exact overdue-fulfilment count using `status in ('paid','processing')` and `action_queue_entered_at < now() - interval '24 hours'`; make query errors fail generation. Verify 60 qualifying orders remain 60 even when the attention display is capped, and exclude a freshly entered queue and an unpaid order.
- [ ] Persist delivery reports per intent/part with total part count, accepting early callbacks without losing them when the HTTP result arrives. Verify one delivered part out of two stays partially delivered, a failed second part surfaces failure, and both delivered parts yield complete delivery.
- [ ] Add synthetic separate-session races: overlapping queue calls create one row; competing claims obtain one lease; callback-before-finish preserves delivered parts; concurrent disable prevents an unstarted provider attempt.
- [ ] Run the SQL tests and native PostgreSQL checks, then inspect `git diff --check` and commit only this task's files.

### Task 2: Message formatting and provider boundary

**Files:** Create `storefront/lib/sms/types.ts`, `format.ts`, `mobile-message.ts`, `webhook.ts`, and matching `storefront/tests/sms/*.test.ts`; modify `storefront/tests/setup.ts` and `storefront/.env.example`.

**Consumes:** `AdminSmsSummary` and `FrozenSms` from the shared interfaces; server-only environment configuration.

**Produces:** Normalization, exact five-line formatter with GSM segment calculation, provider list/send/balance functions and raw-body webhook verification.

- [ ] Add the new provider credentials, sender, list ID, webhook secret and enable flag to the test-environment clearing list. Write failing tests for AU normalization, international-number rejection, large amounts/counts and empty/invalid data.

```ts
expect(normalizeAustralianMobile('0400 000 001')).toBe('61400000001');
expect(normalizeAustralianMobile('+61 400 000 001')).toBe('61400000001');
expect(normalizeAustralianMobile('+1 212 555 0100')).toBeNull();
const text = renderAdminSms({reportDate:'2026-09-29',asOf:'2026-09-29T22:10:00Z',
  month:'2026-09',yesterdayRevenueCents:124001,monthRevenueCents:1523456,
  overdueFulfilment:43,lowStockNames:['Alc Swabs','Sema','Tesa','SS31','IGF']});
expect(text).toBe([
  'Daily ECL Director Update:',
  "Yesterday's Revenue: $1,240.01",
  'Overdue Orders to fulfil: 43',
  'Monthly Revenue: $15,234.56',
  'Low Stock: Alc Swabs, Sema, Tesa, SS31, IGF',
].join('\n'));
expect(text.split('\n')).toHaveLength(5);
```

- [ ] Run `npm test -- tests/sms` and confirm the missing-implementation failures.
- [ ] Implement the exact five-line formatter using standard GSM-safe characters. Format AUD with two decimals, preserve every required line, use `None` for an empty validated stock list, and reject invalid/unknown amounts or counts. Verify 160/161 and 306/307 GSM-septet boundaries, including two-septet extension characters; never truncate content to satisfy the cap.
- [ ] Implement `listAdminSmsRecipients()` using `GET /v1/list-contacts?list_id=28556&limit=100&offset=0` and subsequent offsets until the total is satisfied. Validate the configured list through `/v1/lists`, deduplicate normalized numbers, and reject incomplete/malformed/error responses. Test multiple pages, empty/missing lists, duplicates and member removal between queueing and delivery.
- [ ] Implement `POST /v1/messages` using Basic authentication, one frozen message per request, `Idempotency-Key`, `max_parts:2`, `enable_unicode:false`, `shorten_urls:false` and `custom_ref` equal to the persisted intent UUID. Leave unsubscribe bypass disabled. Freeze the expected segment count with the body and use it for credit estimates and callback completeness.
- [ ] Test exact outgoing request identity with a fake provider, HTTP-200 recipient rejection, 401/403/429/5xx, malformed JSON, missing message identity and a network timeout. Classify ambiguous outcomes without inventing success; persist only redacted errors.
- [ ] Verify HMAC-SHA256 over timestamp plus raw body, constant-time comparison and a five-minute timestamp window. Test altered bodies, invalid signatures and delayed/replayed callbacks.
- [ ] Document configuration names with empty secret values in `.env.example`, run targeted tests and commit the provider/formatter deliverable.

### Task 3: Admin workflow, controls, delivery reports and alerts

**Files:** Create `storefront/lib/admin/daily-sms.ts`, `storefront/app/api/cron/admin-sms/route.ts`, `storefront/app/api/webhooks/mobile-message/route.ts`, `storefront/components/admin/AdminSmsSettings.tsx`, `storefront/app/admin/(dashboard)/settings/admin-sms-actions.ts`, and related worker/route/component tests. Modify Settings page, cron health, email template types/rendering and transactional classification.

**Consumes:** Task 1 database RPCs and task 2 provider/format functions.

**Produces:** A protected, observable admin SMS workflow with dry preview, explicit tests, pause, provider-list visibility and independent delivery tracking.

- [ ] Write failing worker tests for default-disabled behavior, missing configuration, duplicated phone numbers, dates across midnight/DST and callback-before-HTTP-response. Use injected clocks and synthetic database fixtures.

```ts
vi.stubEnv('ADMIN_SMS_ENABLED','false');
expect(await runDailyAdminSms(new Date('2026-09-28T22:15:00Z')))
  .toMatchObject({disabled:true});
// Integration fixture: invoke the enabled worker twice on the same local day;
// assert one persisted message/provider receipt per unique eligible phone.
```

- [ ] Implement morning gating and exact summary reads. Reuse `revenueWindow` for yesterday and the current calendar month, and current admin product availability/threshold calculations for stock. Map `bacteriostatic-water`, `alcohol-swabs`, `semaglutide`, `tesamorelin`, `ss-31` and `igf` to the requested aliases in that order; deduplicate variants. Verify stocked Bac Water is omitted, Semax is never shown as Sema, re-stocked products disappear, and missing products/data fail visibly. Test the first day of a new month and daylight-saving boundaries.
- [ ] Resolve the fully paginated provider list, atomically queue frozen summaries and sequentially process leases. Recheck membership before each send, cancel removed recipients and stop on membership lookup errors. Freeze request content and credential identity; stop expired or uncertain-credential retries. Record provider acceptance separately from complete multipart delivery.
- [ ] Add Settings controls for global pause, exact preview, selected-list-member test, balance and recent results. Display ECL Directors membership read-only with a Mobile Message management link. Protect every action with `requireAdmin`; resolve/normalize membership on the server without assigning dashboard access.
- [ ] Add a protected cron route and signed webhook. The callback must safely tolerate duplicates, reordered statuses and an early provider callback; it must match the expected phone/reference and validate `part_number`/`total_parts` against the frozen expected segment count. One delivered part must never label a two-part message completely delivered.
- [ ] Add `admin_sms_alert` through existing outbox/templates and a narrow database eligibility wrapper. Extend the existing internal-email protections for customer email corrections/marketing suppression. Verify this with tests where an admin is also a customer.
- [ ] Deduplicate low-credit/worker-failure emails per issue and local date; alert below 50 credits. Surface unresolved delivery in admin health. Keep the ordinary daily email route independent.
- [ ] Run the worker, settings, email and cron tests, then commit only the integrated workflow files.

### Task 4: Scheduling, full verification and controlled release

**Files:** Modify `.github/workflows/cron.yml`, `storefront/vercel.json`, `storefront/tests/cron-access.test.ts`; create `storefront/docs/ADMIN-SMS.md` with operation/recovery instructions.

**Consumes:** Reviewed workflow, verified ECL Directors list and confirmed delivery window.

**Produces:** A deployable release, operational configuration and evidence of the first real automatic run.

- [ ] Add `admin-sms` to the existing hourly scheduler and a daily Vercel backstop. Use local-time gating and database uniqueness so overlapping invocations cannot duplicate delivery.
- [ ] Test missing/wrong cron credentials, an authenticated dry run with no provider calls, daily recovery before noon and no new stale intents after expiry.
- [ ] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, applicable browser acceptance and `npm run test:postgres`. Report unrelated baseline failures separately instead of modifying the user's unrelated work.
- [ ] Review the exact branch diff and migration order. Confirm the current production schema and backup/restore procedure before applying the additive migration. Never apply unrelated pending migrations blindly.
- [ ] Save the supplied credentials, verified sender and `MOBILE_MESSAGE_ADMIN_LIST_ID=28556` to production configuration securely, with both the environment gate and database switch paused. Obtain the webhook signing secret through the provider settings and store it securely.
- [ ] Deploy the reviewed migration and matching application. Configure the signed delivery-report URL only after the route exists. Verify callback rejection/acceptance without leaking signing material.
- [ ] Read the configured list again and show its current unique recipients with the exact preview. Perform the explicitly authorized real test; verify both receipt records and the recipient's confirmation. Do not ask the user to re-enter the already-verified phone numbers.
- [ ] Enable the agreed daily window, verify the first scheduled run, and record unique recipients, delivery results and credits without credentials. Keep customer SMS automation unimplemented.

## Review and execution

Native execution is recommended: the database, sender and worker share a small set of tightly coupled interfaces. The user supplied the recipient source and all four numbers are API-verified. The 30 September message defines the exact five-line format and supersedes the earlier compact one-segment proposal. A live read-only preview has verified the dashboard source figures. Plan/spec review, the optional low-stock-scope clarification and delivery-window confirmation remain pending. No product code, provider send or production activation has been performed by this plan-preparation task.
