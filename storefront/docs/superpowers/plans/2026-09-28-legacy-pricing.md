# ECLLEGACY Legacy Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an indefinitely valid, email-restricted `ECLLEGACY` checkout code that restores every directly purchased snapshotted product variant to no more than its production price at activation time.

**Architecture:** A single migration extends the existing discount model, atomically snapshots active variant prices and historical qualifying customer emails, and adds service-only SQL helpers used by the transactional commerce boundary. The Next.js checkout supplies only normalized email and server-resolved item facts; both the quote path and `commerce_create_order` independently derive the exact legacy discount, while order items retain exact eligibility and allocation evidence for edits and refunds.

**Tech Stack:** PostgreSQL/Supabase migrations and RLS, TypeScript, Next.js server actions, React, Vitest, Testing Library, PGlite.

**Spec:** `docs/superpowers/specs/2026-09-28-legacy-pricing-design.md`

## Global Constraints

- The production snapshot migration must run before any 20–40% catalogue price increase.
- Code is exactly `ECLLEGACY`, matched case-insensitively.
- Eligibility is frozen at migration time from normalized emails on `paid`, `processing`, `shipped`, or `completed` orders.
- Snapshot every active variant belonging to an active product, including accessories and all pack sizes.
- Future variants, shipping, extra items, gifts, and stack/bundle price overrides are excluded.
- The effective price for an eligible direct variant is `min(current price, captured price)`.
- No expiry, minimum spend, usage limit, automatic eligibility growth, or code stacking.
- Browser input never supplies a trusted legacy price, membership decision, allocation, or discount amount.
- Generic `percent` and `fixed` discount behavior must remain byte-for-byte equivalent at the public interfaces.
- New tables and RPCs are denied to `anon` and `authenticated`; customer membership is never enumerable publicly.
- Do not include unrelated dirty-worktree changes in any commit.

## Review Focus

- A customer changing the email after applying `ECLLEGACY` must immediately invalidate the prior quote and require a new authoritative quote; Task 4 adds this browser test.
- A current price below the captured price must never be raised or produce a negative discount; Tasks 1 and 3 add database and application tests.
- Stack components and gifts carry real variant IDs but must remain excluded because they use price overrides; Tasks 2 and 3 test the exclusion flag at both boundaries.
- A pending legacy order edited after program deactivation must lose the code with an audit event without rewriting paid history; Task 2 tests both states.
- Exact per-line legacy allocation must survive odd cents, partial refunds, and quantity edits without proportional drift; Task 2 adds end-to-end financial tests.

---

## File Map

- Create `supabase/migrations/20260928100000_legacy_pricing.sql`: schema extension, immutable snapshots, private legacy calculator, commerce-function replacements, privileges, and indexes.
- Create `tests/legacy-pricing.test.ts`: pre-snapshot fixtures plus migration, security, transactional order, allocation, edit, and refund tests.
- Modify `lib/admin/orders.ts`: carry the server-derived `legacyDiscountEligible` item flag and supply shipping policy during legacy-aware reinstatement.
- Modify `lib/checkout.ts`: mark only direct variant items as legacy-eligible and leave all overrides/extras excluded.
- Modify `lib/admin/discounts.ts`: accept email and resolved lines, preserve generic discounts, and call the legacy quote RPC.
- Modify `app/(store)/checkout/actions.ts`: make email price-relevant, include it in quote hashing, and map transactional legacy errors.
- Modify `components/CheckoutForm.tsx`: re-quote legacy pricing when email changes and show code-specific guidance/summary copy.
- Modify `components/admin/DiscountsManager.tsx`: identify the legacy price-book program, retain its enable/disable control, and remove its delete control.
- Modify `app/admin/(dashboard)/discounts/actions.ts`: reject legacy-program deletion server-side while preserving generic code creation and deletion.
- Modify `tests/commerce-cart.test.ts`: prove direct versus overridden line eligibility.
- Modify `tests/checkout-orchestration.test.ts`: prove quote inputs, hash invalidation, lower-price behavior, and order payload integrity.
- Modify `tests/storefront/checkout.test.tsx`: prove accessible missing-email, eligible, ineligible, and changed-email flows.
- Create `tests/admin/discounts.test.tsx`: prove protected legacy-program rendering and controls.
- Create `tests/admin/discount-actions.test.ts`: prove the server rejects legacy-program deletion.
- Create `tests/admin/order-reinstatement.test.ts`: prove reinstatement supplies the selected shipping policy for safe legacy revalidation.
- Modify `tests/preview/actions.ts`: keep the preview action signature compatible without granting synthetic legacy pricing.
- Create `docs/LEGACY-PRICING.md`: activation, aggregate verification, emergency disable, and later controlled additions.

### Task 1: Immutable Price and Customer Snapshot

**Files:**
- Create: `supabase/migrations/20260928100000_legacy_pricing.sql`
- Create: `tests/legacy-pricing.test.ts`

**Interfaces:**
- Consumes: existing `discounts`, `product_variants`, `products`, `orders`, and `order_items` tables.
- Produces: `discounts.kind = 'legacy_price'`; `legacy_discount_prices(discount_id, variant_id, price_cents, captured_at)`; `legacy_discount_customers(discount_id, email, source_order_id, captured_at)`; `order_items.legacy_discount_eligible`.

- [ ] **Step 1: Write the failing migration snapshot tests**

Build a PGlite test that applies every migration before `20260928100000_legacy_pricing.sql`, inserts active/inactive products and variants, and inserts orders for each status before applying the feature migration:

```ts
const feature = '20260928100000_legacy_pricing.sql';

beforeAll(async () => {
  db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema storage; create table storage.buckets(id text primary key,name text,public boolean);');
  for (const file of migrationFiles.filter(name => name < feature)) {
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
  }
  await db.exec(`
    insert into products(id,slug,name,status) values
      ('10000000-0000-0000-0000-000000000001','legacy-active','Legacy active','active'),
      ('10000000-0000-0000-0000-000000000002','legacy-archived','Legacy archived','archived'),
      ('10000000-0000-0000-0000-000000000003','legacy-accessory','Legacy accessory','active');
    insert into product_variants(id,product_id,sku,pack_size,label,price_cents,active) values
      ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','ACTIVE-1',1,'1 vial',5999,true),
      ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','ACTIVE-3',3,'3-pack',16100,true),
      ('20000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','ACTIVE-6',6,'6-pack',30500,true),
      ('20000000-0000-0000-0000-000000000012','10000000-0000-0000-0000-000000000001','INACTIVE-12',12,'12-pack',59000,false),
      ('20000000-0000-0000-0000-000000000090','10000000-0000-0000-0000-000000000003','ACCESSORY-1',1,'100 pack',1200,true),
      ('20000000-0000-0000-0000-000000000099','10000000-0000-0000-0000-000000000002','ARCHIVED-1',1,'1 vial',1000,true);
    insert into orders(customer_email,status) values
      (' Original@Example.Test ','paid'),
      ('original@example.test','completed'),
      ('processing@example.test','processing'),
      ('shipped@example.test','shipped'),
      ('pending@example.test','pending'),
      ('cancelled@example.test','cancelled'),
      ('refunded@example.test','refunded');
  `);
  await db.exec(readFileSync(`supabase/migrations/${feature}`, 'utf8'));
});

it('captures active current variants once without mutable prices', async () => {
  expect(await rows(`select v.sku,p.price_cents from legacy_discount_prices p join product_variants v on v.id=p.variant_id order by v.sku`)).toEqual([
    { sku: 'ACCESSORY-1', price_cents: 1200 },
    { sku: 'ACTIVE-1', price_cents: 5999 },
    { sku: 'ACTIVE-3', price_cents: 16100 },
    { sku: 'ACTIVE-6', price_cents: 30500 },
  ]);
});

it('freezes normalized customers from qualifying historical orders only', async () => {
  expect(await rows(`select email from legacy_discount_customers order by email`)).toEqual([
    { email: 'original@example.test' },
    { email: 'processing@example.test' },
    { email: 'shipped@example.test' },
  ]);
});
```

Also assert the program row has `active=true`, null expiry/limit, zero minimum, and that re-running only the two snapshot insert statements with `ON CONFLICT DO NOTHING` does not change captured prices or add an order created after `captured_at`. Assert captured price/customer rows reject updates and deletes while a later reviewed migration may still insert a new row.

- [ ] **Step 2: Run the snapshot tests and verify the expected failure**

Run:

```bash
npx vitest run tests/legacy-pricing.test.ts --reporter=verbose
```

Expected: FAIL because the migration and legacy tables do not exist.

- [ ] **Step 3: Add the schema, constraints, and atomic snapshot**

Start `20260928100000_legacy_pricing.sql` with explicit replacement of the two existing discount constraints, then insert the program and snapshots:

```sql
alter table public.discounts drop constraint discounts_kind_check;
alter table public.discounts drop constraint discounts_check;
alter table public.discounts add constraint discounts_kind_check
  check (kind in ('percent','fixed','legacy_price'));
alter table public.discounts add constraint discounts_value_check check (
  (kind='percent' and percent is not null)
  or (kind='fixed' and value_cents is not null)
  or (kind='legacy_price' and percent is null and value_cents is null)
);

create table public.legacy_discount_prices (
  discount_id uuid not null references public.discounts(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  price_cents integer not null check(price_cents>=0),
  captured_at timestamptz not null default now(),
  primary key(discount_id,variant_id)
);

create table public.legacy_discount_customers (
  discount_id uuid not null references public.discounts(id) on delete restrict,
  email text not null check(email=lower(trim(email)) and length(email) between 3 and 254),
  source_order_id uuid not null references public.orders(id) on delete restrict,
  captured_at timestamptz not null default now(),
  primary key(discount_id,email)
);

alter table public.order_items
  add column legacy_discount_eligible boolean not null default false;

insert into public.discounts(code,kind,min_spend_cents,usage_limit,starts_at,expires_at,active)
values('ECLLEGACY','legacy_price',0,null,null,null,true);

insert into public.legacy_discount_prices(discount_id,variant_id,price_cents)
select d.id,v.id,v.price_cents
from public.discounts d
join public.product_variants v on true
join public.products p on p.id=v.product_id
where d.code='ECLLEGACY' and d.kind='legacy_price' and d.active and v.active and p.status='active'
on conflict(discount_id,variant_id) do nothing;

insert into public.legacy_discount_customers(discount_id,email,source_order_id)
select d.id,e.email,e.order_id
from public.discounts d
cross join lateral (
  select distinct on (lower(trim(o.customer_email)))
    lower(trim(o.customer_email)) email,o.id order by lower(trim(o.customer_email)),o.created_at,o.id
  from public.orders o where o.status in ('paid','processing','shipped','completed')
) e
where d.code='ECLLEGACY'
on conflict(discount_id,email) do nothing;
```

Use a plain insert for `ECLLEGACY`: an unexpected pre-existing code must abort the migration instead of silently converting another promotion. Enable RLS on both snapshot tables, revoke all from `public`, `anon`, `authenticated`, and `service_role`, then grant only `SELECT, INSERT` to `service_role`; add indexes on normalized eligibility email and variant lookup. Add a shared trigger that rejects `UPDATE` and `DELETE` on captured rows; retain `INSERT` only so a future reviewed migration can make the explicitly approved additions described in the specification.

- [ ] **Step 4: Run the snapshot and full migration-chain tests**

Run:

```bash
npx vitest run tests/legacy-pricing.test.ts tests/migrations.test.ts --reporter=verbose
```

Expected: PASS; snapshot rows are immutable and the migration chain remains ordered.

- [ ] **Step 5: Commit the snapshot foundation**

```bash
git add supabase/migrations/20260928100000_legacy_pricing.sql tests/legacy-pricing.test.ts
git commit -m "Add immutable legacy pricing snapshot"
```

### Task 2: Transactional Legacy Pricing, Allocation, Edits, and Refunds

**Files:**
- Modify: `supabase/migrations/20260928100000_legacy_pricing.sql`
- Modify: `tests/legacy-pricing.test.ts`
- Modify: `lib/admin/orders.ts`
- Create: `tests/admin/order-reinstatement.test.ts`

**Interfaces:**
- Consumes: Task 1 snapshot tables and `order_items.legacy_discount_eligible`.
- Produces: service-only `commerce_legacy_discount_quote(text,text,jsonb)` returning `{ok, code, discountCents, allocations:[{lineIndex,discountCents}], reason}`; legacy-aware `commerce_create_order_unfiltered`, `commerce_allocate_discount`, and `commerce_order_operation` while retaining the existing public `commerce_create_order` attribution-scrubbing wrapper.

- [ ] **Step 1: Add failing SQL-boundary tests**

After the Task 1 snapshot, raise the live prices and test the full transaction:

```ts
it('returns captured prices only for a frozen eligible email', async () => {
  await db.exec(`update product_variants set price_cents=7999 where sku='ACTIVE-1'`);
  const lines = [{lineIndex:0,variantId:'20000000-0000-0000-0000-000000000001',qty:2,unitPriceCents:7999,legacyEligible:true,hasPriceOverride:false}];
  expect(await scalar(`select commerce_legacy_discount_quote('ECLLEGACY',' ORIGINAL@example.test ',$1::jsonb)`, [JSON.stringify(lines)])).toMatchObject({ok:true,discountCents:4000});
  expect(await scalar(`select commerce_legacy_discount_quote('ECLLEGACY','new@example.test',$1::jsonb)`, [JSON.stringify(lines)])).toMatchObject({ok:false,reason:'email_ineligible'});
});

it('uses exact line allocation and excludes overrides and future variants', async () => {
  const order = await createLegacyOrder({
    email:'original@example.test',
    items:[
      {variantId:legacyVariant,qty:2,expectedPriceCents:7999,legacyDiscountEligible:true},
      {variantId:legacyVariant,qty:1,expectedPriceCents:7999,priceOverrideCents:5000,legacyDiscountEligible:false,labelSuffix:' · Bundle'},
      {variantId:futureVariant,qty:1,expectedPriceCents:9000,legacyDiscountEligible:true},
    ],
  });
  expect(order.totalCents).toBe(25998);
  expect(await rows(`select legacy_discount_eligible,discount_allocated_cents from order_items order by line_total_cents desc`)).toEqual([
    {legacy_discount_eligible:true,discount_allocated_cents:4000},
    {legacy_discount_eligible:true,discount_allocated_cents:0},
    {legacy_discount_eligible:false,discount_allocated_cents:0},
  ]);
});
```

Add cases for a current price below the snapshot, two separate cart lines with the same variant ID, a cart containing no snapshotted eligible line, a non-variant `extraItems` line, code deactivation, forged `legacyDiscountEligible=true` on an overridden item, missing email, a catalogue price change between quote and order creation, partial refunds, odd-cent prices, pending quantity edits, reinstatement, paid-history preservation, paid usage-count idempotency, attribution-wrapper preservation, and RPC privileges. The lower-current-price case must return `ok:true` with a zero discount; only a cart with zero matched snapshot rows returns `no_eligible_items`.

- [ ] **Step 2: Run the focused database tests and verify failure**

Run:

```bash
npx vitest run tests/legacy-pricing.test.ts --reporter=verbose
```

Expected: FAIL because the quote RPC and transaction branches do not exist.

- [ ] **Step 3: Add the shared legacy calculator**

Implement the service-only quote function with strict JSON validation and the lower-price rule:

```sql
create function public.commerce_legacy_discount_quote(p_code text,p_email text,p_lines jsonb)
returns jsonb language plpgsql stable set search_path=public as $$
declare d discounts%rowtype; line record; allocation jsonb:='[]'::jsonb; amount int:=0; delta int; captured int; matched int:=0;
begin
  select * into d from discounts where code=upper(trim(p_code));
  if not found or not d.active or d.kind<>'legacy_price' then
    return jsonb_build_object('ok',false,'discountCents',0,'reason','invalid_code');
  end if;
  if coalesce(trim(p_email),'')='' then
    return jsonb_build_object('ok',false,'discountCents',0,'reason','email_required');
  end if;
  if not exists(select 1 from legacy_discount_customers c where c.discount_id=d.id and c.email=lower(trim(p_email))) then
    return jsonb_build_object('ok',false,'discountCents',0,'reason','email_ineligible');
  end if;
  if jsonb_typeof(p_lines) is distinct from 'array' then raise exception 'Invalid legacy lines'; end if;
  if jsonb_array_length(p_lines) not between 1 and 200 then raise exception 'Invalid legacy lines'; end if;
  for line in select value,ordinality from jsonb_array_elements(p_lines) with ordinality loop
    delta:=0;
    if coalesce((line.value->>'legacyEligible')::boolean,false) and not coalesce((line.value->>'hasPriceOverride')::boolean,false) then
      select price_cents into captured from legacy_discount_prices
       where discount_id=d.id and variant_id=(line.value->>'variantId')::uuid;
      if found then
        matched:=matched+1;
        delta:=greatest(0,(line.value->>'unitPriceCents')::int-captured)*(line.value->>'qty')::int;
      end if;
    end if;
    amount:=amount+delta;
    allocation:=allocation||jsonb_build_array(jsonb_build_object('lineIndex',(line.value->>'lineIndex')::int,'discountCents',delta));
  end loop;
  if matched=0 then
    return jsonb_build_object('ok',false,'discountCents',0,'reason','no_eligible_items');
  end if;
  return jsonb_build_object('ok',true,'code',d.code,'discountCents',amount,'allocations',allocation);
end $$;
```

Validate each unique, zero-based `lineIndex`, UUID, integer quantity `1..99`, non-negative unit price, booleans, and maximum array length before any cast. Use the input ordinal only to reject missing, duplicate, or out-of-order indexes; never key allocation by `variantId`, because the same variant can appear in both a direct and overridden line. Revoke execution from `public`, `anon`, and `authenticated`; grant only to `service_role`.

- [ ] **Step 4: Integrate the calculator into atomic creation and exact allocation**

Copy the complete current body of `commerce_create_order_unfiltered(jsonb)` (the function renamed by `20260913120000_order_attribution.sql`) into a `CREATE OR REPLACE` statement and change only the tested legacy-pricing branches. Do not replace or bypass the outer `commerce_create_order(jsonb)` wrapper, because it normalizes attribution and legacy idempotent replays.

In the replacement `commerce_create_order_unfiltered`:

```sql
legacy_eligible:=coalesce((line->>'legacyDiscountEligible')::boolean,false)
  and not (line ? 'priceOverrideCents');
insert into order_items(
  order_id,variant_id,product_slug,product_name,variant_label,sku,
  unit_price_cents,qty,line_total_cents,legacy_discount_eligible
)
values(
  o.id,v.id,v.slug,v.name,v.label||coalesce(line->>'labelSuffix',''),v.sku,
  unit,q,unit*q,legacy_eligible
);
```

When the locked discount row has `kind='legacy_price'`, build calculator lines from the inserted order items, call the shared function using `o.customer_email`, reject a non-`ok` result as `Discount unavailable`, and use its `discountCents`. Retain the existing percent/fixed calculation unchanged. Compare `expectedTotalCents` only after the database-derived legacy result. Add an attribution regression test proving the outer wrapper still scrubs and persists a valid checkout attribution snapshot.

Replace `commerce_allocate_discount(uuid)` so `legacy_price` orders allocate each eligible line exactly as `greatest(0, unit_price_cents - captured_price) * qty`; retain the current cumulative proportional algorithm for percent/fixed codes.

Copy the complete latest `commerce_order_operation` body from `20260908210000_operations_completion.sql` and change only its `edit_item` and unpaid `reinstate` legacy-discount branches. Recalculate legacy discounts after pending item edits from stored email, stored unit prices, current quantities, and `legacy_discount_eligible`. On reinstatement, revalidate/recalculate only when `discount_counted=false`; a formerly paid cancelled order retains its exact recorded financial history. If the program is inactive or membership is unavailable, clear the code and discount on the unpaid edited/reinstated order, recompute shipping from the supplied policy, and append explicit audit/commerce evidence. Leave generic percent/fixed reinstatement behavior unchanged.

Extend `reinstateOrder` in `lib/admin/orders.ts` to load the order's selected shipping method and supply the same `{baseCents, freeThresholdCents}` policy used by `updatePendingOrderItemQty`. Add `tests/admin/order-reinstatement.test.ts` to assert standard and enabled-express policy selection. This keeps discount removal from accidentally retaining free shipping. Run `commerce_allocate_discount` after a successful unpaid legacy recalculation or removal.

- [ ] **Step 5: Prove refund and mutation integrity**

Run:

```bash
npx vitest run tests/legacy-pricing.test.ts tests/commerce-integrity.test.ts tests/admin/order-reinstatement.test.ts tests/admin/refund-workflow.test.ts tests/admin/economics-refund-integration.test.ts tests/paid-analytics-commerce.test.ts --reporter=verbose
```

Expected: PASS; exact allocations sum to `orders.discount_cents`, partial refunds use the correct net line value, and existing generic discount tests are unchanged.

- [ ] **Step 6: Commit the transactional boundary**

```bash
git add supabase/migrations/20260928100000_legacy_pricing.sql tests/legacy-pricing.test.ts lib/admin/orders.ts tests/admin/order-reinstatement.test.ts
git commit -m "Enforce legacy pricing in commerce transactions"
```

### Task 3: Server Quote and Resolved-Line Integration

**Files:**
- Modify: `lib/admin/orders.ts`
- Modify: `lib/checkout.ts`
- Modify: `lib/admin/discounts.ts`
- Modify: `app/(store)/checkout/actions.ts`
- Modify: `tests/commerce-cart.test.ts`
- Modify: `tests/checkout-orchestration.test.ts`
- Modify: `tests/preview/actions.ts`

**Interfaces:**
- Consumes: `commerce_legacy_discount_quote(text,text,jsonb)` from Task 2.
- Produces: `NewOrderItem.legacyDiscountEligible?: boolean`; `DiscountQuoteLine`; `validateDiscount(input)`; `quoteCart(lines, discountCode?, shippingMethod?, email?)`.

- [ ] **Step 1: Write failing resolver and quote tests**

Add these assertions:

```ts
it('marks only direct product variants as legacy-price eligible', async () => {
  const direct = await resolveCart([{key:'sample',slug:'sample',variantLabel:'1 vial',quantity:1}]);
  expect(direct.items[0]).toMatchObject({legacyDiscountEligible:true});
});

it('never marks bundle, gift, or price-overridden lines eligible', async () => {
  const bundle = await resolveCart([{key:'stack:recovery',slug:'recovery',variantLabel:'Bundle',quantity:1}]);
  expect(bundle.items.filter(item => item.priceOverrideCents !== undefined))
    .toEqual(expect.arrayContaining([expect.not.objectContaining({legacyDiscountEligible:true})]));
});

it('passes normalized email and authoritative lines to legacy validation', async () => {
  m.discount.mockResolvedValue({ok:true,code:'ECLLEGACY',discountCents:2000});
  const quote = await quoteCart(cart,'ECLLEGACY','standard',' Original@Example.Test ');
  expect(m.discount).toHaveBeenCalledWith(expect.objectContaining({
    code:'ECLLEGACY',email:'original@example.test',subtotalCents:1000,
  }));
  expect(quote.discountCents).toBe(2000);
});
```

Extend the resolver fixture and assertion across direct 1-, 3-, and 6-pack lines plus one accessory. Add tests proving changing only the email changes `quote.version`; toggling the mocked program state or changing the mocked allocations changes it too; a transaction-time `Discount unavailable` result returns a fresh unconfirmed quote; a temporary legacy RPC failure fails closed without returning a successful discounted quote; gift and free-shipping thresholds use the post-legacy-discount goods total; and percent/fixed validators receive the same subtotal and return the same amount as before.

- [ ] **Step 2: Run application tests and verify failure**

```bash
npx vitest run tests/commerce-cart.test.ts tests/checkout-orchestration.test.ts --reporter=verbose
```

Expected: FAIL on the absent eligibility property and old quote/validator signatures.

- [ ] **Step 3: Carry eligibility in server-resolved items**

Extend the item type:

```ts
export interface NewOrderItem {
  variantId: string;
  qty: number;
  legacyDiscountEligible?: boolean;
  priceOverrideCents?: number;
  expectedPriceCents?: number;
  labelSuffix?: string;
}
```

In `resolveCart`, set `legacyDiscountEligible: true` only in the direct `variant` branch. Do not set it for stack components, gifts, or other `priceOverrideCents` items. Extra items have no `variantId` and never enter legacy calculation.

- [ ] **Step 4: Add a typed discount quote boundary**

Replace positional validator parameters with:

```ts
export interface DiscountQuoteLine {
  lineIndex: number;
  variantId: string;
  qty: number;
  unitPriceCents: number;
  legacyEligible: boolean;
  hasPriceOverride: boolean;
}

export interface ValidateDiscountInput {
  code: string;
  subtotalCents: number;
  email?: string;
  lines: DiscountQuoteLine[];
  now?: Date;
}

export async function validateDiscount(input: ValidateDiscountInput): Promise<DiscountValidation>;
```

Extend `DiscountValidation` with `allocations?: Array<{lineIndex:number; discountCents:number}>`. Return an ordered allocation array only for a successful `legacy_price` result; generic percent/fixed results keep the existing response shape.

Keep the existing date, limit, minimum, percent, and fixed paths unchanged. For `kind==='legacy_price'`, require email and call `commerce_legacy_discount_quote`. Map reasons exactly:

```ts
const LEGACY_ERRORS = {
  email_required: 'Enter the email used for your previous East Coast Labs order.',
  email_ineligible: 'Use the email from your previous East Coast Labs order.',
  no_eligible_items: 'ECLLEGACY does not apply to the products in this cart.',
  invalid_code: 'Invalid code.',
} as const;
```

- [ ] **Step 5: Make email part of authoritative quote identity**

Change the internal `resolveQuote` argument order to `(lines, discountCode?, shippingMethod?, email?)`. Change the exported function to delegate all four arguments exactly:

```ts
export async function quoteCart(
  lines: ClientCartLine[], discountCode?: string,
  shippingMethod?: ShippingMethod, email?: string,
): Promise<CartQuote> {
  return (await resolveQuote(lines, discountCode, shippingMethod, email)).quote;
}
```

Build `DiscountQuoteLine[]` only from `resolved.items`, using the resolved item array index as `lineIndex` and `priceOverrideCents ?? expectedPriceCents` as `unitPriceCents`. Require `expectedPriceCents` on every direct item; overridden items use only their server-derived override. Include normalized email plus the ordered `{lineIndex,discountCents}` allocations in the quote-version hash. In `placeOrder`, call `resolveQuote` with the normalized input email both before creation and after a `QUOTE_CHANGED` error. If the transaction returns `Discount unavailable` after a valid quote (for example, the active switch changed), also fetch and return the refreshed quote with a review-again message instead of falling through to the generic uncertain-order error. Pass `legacyDiscountEligible` into `createOrder` unchanged.

Update `tests/preview/actions.ts` to accept the fourth parameter but always return its existing synthetic invalid-code response for any code.

- [ ] **Step 6: Run focused and regression tests**

```bash
npx vitest run tests/commerce-cart.test.ts tests/checkout-orchestration.test.ts tests/checkout-gifts.test.ts tests/commerce-integrity.test.ts --reporter=verbose
```

Expected: PASS with generic promotions, gifts, stacks, and checkout replay unchanged.

- [ ] **Step 7: Commit the server quote integration**

```bash
git add lib/admin/orders.ts lib/checkout.ts lib/admin/discounts.ts 'app/(store)/checkout/actions.ts' tests/commerce-cart.test.ts tests/checkout-orchestration.test.ts tests/preview/actions.ts
git commit -m "Integrate legacy pricing with checkout quotes"
```

### Task 4: Accessible Checkout Email and Code Experience

**Files:**
- Modify: `components/CheckoutForm.tsx`
- Modify: `tests/storefront/checkout.test.tsx`

**Interfaces:**
- Consumes: Task 3 `quoteCart(lines, code, shippingMethod, email)` and `CartQuote.discountError`.
- Produces: email-sensitive quote refresh and clear `ECLLEGACY` summary/error behavior.

- [ ] **Step 1: Write failing browser-component tests**

```tsx
it('asks for the historic order email before applying ECLLEGACY', async () => {
  m.quote.mockResolvedValue({...quote,discountError:'Enter the email used for your previous East Coast Labs order.'});
  render(<CheckoutForm/>);
  fireEvent.change(screen.getByLabelText('Discount code'),{target:{value:'ECLLEGACY'}});
  fireEvent.click(screen.getByRole('button',{name:'Apply'}));
  expect(await screen.findByText(/email used for your previous/i)).toBeVisible();
  expect(screen.getByLabelText('Email address')).toHaveFocus();
});

it('requotes legacy pricing when the supplied email changes', async () => {
  m.quote.mockResolvedValue(quote);
  render(<CheckoutForm/>);
  fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'first@example.test'}});
  fireEvent.change(screen.getByLabelText('Discount code'),{target:{value:'ECLLEGACY'}});
  fireEvent.click(screen.getByRole('button',{name:'Apply'}));
  await waitFor(()=>expect(m.quote).toHaveBeenLastCalledWith(expect.anything(),'ECLLEGACY','standard','first@example.test'));
  fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'other@example.test'}});
  expect(screen.getByRole('button',{name:'Place order'})).toBeDisabled();
  await waitFor(()=>expect(m.quote).toHaveBeenLastCalledWith(expect.anything(),'ECLLEGACY','standard','other@example.test'));
});
```

Also test eligible discount display as `ECLLEGACY −$X.XX`, ineligible accessible error association, code removal, and that changing email during an uncertain attempt creates a distinct request identity.

- [ ] **Step 2: Run UI tests and verify failure**

```bash
npx vitest run tests/storefront/checkout.test.tsx --reporter=verbose
```

Expected: FAIL because email is not passed to quotes and no legacy-specific focus behavior exists.

- [ ] **Step 3: Make email price-relevant only while legacy code is applied**

Use normalized email in the request key and quote call when the applied code is `ECLLEGACY`:

```ts
const normalizedEmail = email.trim().toLowerCase();
const legacyEmail = appliedCode.trim().toUpperCase()==='ECLLEGACY' ? normalizedEmail : '';
const requestKey = JSON.stringify([payload,appliedCode,shippingMethod,legacyEmail]);

quoteCart(payload,appliedCode || undefined,shippingMethod,legacyEmail || undefined);
```

The existing `setQuotedKey('')` behavior disables submission immediately while the new quote is pending. On Apply with `ECLLEGACY` and an empty email, set the email field error and focus `#checkout-email`; still allow the server response to remain authoritative for malformed/ineligible addresses.

- [ ] **Step 4: Clarify the order summary without exposing membership data**

Render the applied code beside the discount:

```tsx
<dt className="text-muted">Discount{appliedCode ? ` · ${appliedCode}` : ''}</dt>
```

Keep the existing `role="alert"`, `aria-invalid`, and `aria-describedby` relationships. Do not show any customer list, eligibility count, captured price, or another email address.

- [ ] **Step 5: Run UI, orchestration, accessibility, and type checks**

```bash
npx vitest run tests/storefront/checkout.test.tsx tests/checkout-orchestration.test.ts --reporter=verbose
npm run typecheck
npx eslint components/CheckoutForm.tsx tests/storefront/checkout.test.tsx 'app/(store)/checkout/actions.ts' lib/admin/discounts.ts lib/checkout.ts lib/admin/orders.ts
```

Expected: all commands pass with no errors.

- [ ] **Step 6: Commit the checkout experience**

```bash
git add components/CheckoutForm.tsx tests/storefront/checkout.test.tsx
git commit -m "Add legacy pricing checkout experience"
```

### Task 5: Protected Admin Controls

**Files:**
- Modify: `components/admin/DiscountsManager.tsx`
- Modify: `app/admin/(dashboard)/discounts/actions.ts`
- Create: `tests/admin/discounts.test.tsx`
- Create: `tests/admin/discount-actions.test.ts`

**Interfaces:**
- Consumes: `discounts.kind = 'legacy_price'` and the existing audited enable/disable action.
- Produces: a recognizable `Legacy price book` row that can be disabled but cannot be deleted or created through the generic promotion form.

- [ ] **Step 1: Write failing admin UI and action tests**

Render `DiscountsManager` with an `ECLLEGACY` row and assert it displays `Legacy price book`, exposes `Disable`, and does not expose `Delete ECLLEGACY`. Render a normal percent row and assert its existing delete control remains present.

Mock the admin session and database chain for `deleteDiscount('ECLLEGACY')`; assert the action reads the row kind, returns this controlled error, performs no delete, and writes no success audit:

```ts
expect(result).toEqual({
  ok:false,
  error:'Legacy pricing programs cannot be deleted. Disable the program instead.',
});
```

Also assert deleting a normal fixed/percent code retains the existing behavior.

- [ ] **Step 2: Run the admin tests and verify failure**

```bash
npx vitest run tests/admin/discounts.test.tsx tests/admin/discount-actions.test.ts --reporter=verbose
```

Expected: FAIL because `legacy_price` is absent from the row type/display logic and the delete action has no program guard.

- [ ] **Step 3: Add the protected legacy-program presentation**

Extend only `DiscountRow.kind` to `"percent" | "fixed" | "legacy_price"`; keep the creation form and `DiscountInput.kind` restricted to percent/fixed. Display legacy rows as `Legacy price book`, keep the existing audited enable/disable button, and omit the trash button when `kind === 'legacy_price'`.

In `deleteDiscount`, normalize the code, read `kind` before deletion, and return the controlled error for `legacy_price`. Keep the database foreign-key restriction as the final race-condition defense. Do not add customer counts, customer lookup, snapshot prices, or membership controls to this screen.

- [ ] **Step 4: Run focused admin checks**

```bash
npx vitest run tests/admin/discounts.test.tsx tests/admin/discount-actions.test.ts --reporter=verbose
npx eslint components/admin/DiscountsManager.tsx 'app/admin/(dashboard)/discounts/actions.ts' tests/admin/discounts.test.tsx tests/admin/discount-actions.test.ts
npm run typecheck
```

Expected: all commands pass; generic promotion creation, deletion, and display remain unchanged.

- [ ] **Step 5: Commit the admin safeguards**

```bash
git add components/admin/DiscountsManager.tsx 'app/admin/(dashboard)/discounts/actions.ts' tests/admin/discounts.test.tsx tests/admin/discount-actions.test.ts
git commit -m "Protect legacy pricing administration"
```

### Task 6: Operations Runbook and Release Verification

**Files:**
- Create: `docs/LEGACY-PRICING.md`
- Modify: `docs/MIGRATIONS.md`

**Interfaces:**
- Consumes: completed migration, application tests, and repository migration runner.
- Produces: operator-safe activation and rollback instructions without exposing customer emails.

- [ ] **Step 1: Write the operations runbook**

Document these exact aggregate checks:

```sql
select
  (select count(*) from public.legacy_discount_prices lp
   join public.discounts d on d.id=lp.discount_id where d.code='ECLLEGACY') as captured_variants,
  (select count(*) from public.product_variants v
   join public.products p on p.id=v.product_id where v.active and p.status='active') as current_active_variants;

select count(*) as eligible_customers from public.legacy_discount_customers c
join public.discounts d on d.id=c.discount_id where d.code='ECLLEGACY';

select count(*) as pre_increase_price_mismatches
from public.legacy_discount_prices lp
join public.product_variants v on v.id=lp.variant_id
where lp.price_cents<>v.price_cents;
```

The third query must return zero before the later catalogue price increase; after that separate release it is expected to count the variants whose live prices changed, so it is not an ongoing corruption check. State that operators must never print or export `legacy_discount_customers.email` during verification. Include the emergency command:

```sql
update public.discounts set active=false where code='ECLLEGACY' and kind='legacy_price';
```

Explain that reactivation is the inverse `active=true`, snapshot rows must not be deleted, new eligibility/variants require a reviewed migration, and catalogue price increases cannot begin until the application deployment is verified.

- [ ] **Step 2: Update migration documentation**

Add `20260928100000_legacy_pricing.sql` to the production sequence in `docs/MIGRATIONS.md`, noting that its captured data is production-specific and must be applied exactly once before price changes.

- [ ] **Step 3: Run complete local verification**

```bash
npx vitest run --reporter=dot
npm run typecheck
npm run lint
npm run test:postgres
npm run build
git diff --check
```

Expected: all repository-required checks pass. If unrelated dirty-worktree tests fail, record the exact pre-existing files/failures and still require every legacy-pricing-focused test to pass before review.

- [ ] **Step 4: Request independent code review**

Use `superpowers:requesting-code-review` for the complete branch. The reviewer must focus on transactional trust, snapshot immutability, exact refund allocation, generic discount regressions, RLS/privileges, and whether any customer email can leak.

- [ ] **Step 5: Apply accepted review fixes and rerun affected checks**

For each accepted finding, write or strengthen the failing test first, make the minimal fix, rerun the focused test, then rerun the full verification commands from Step 3.

- [ ] **Step 6: Commit runbook and final verification changes**

```bash
git add docs/LEGACY-PRICING.md docs/MIGRATIONS.md
git commit -m "Document legacy pricing operations"
```

### Task 7: Controlled Production Activation

**Files:**
- No new source files; operate from the reviewed commits and `docs/LEGACY-PRICING.md`.

**Interfaces:**
- Consumes: approved, reviewed, passing implementation and explicit production-release authorization.
- Produces: one tracked production snapshot and a matching application deployment.

- [ ] **Step 1: Confirm release preconditions without exposing data**

Verify the production catalogue has not yet received the planned price increase, the target Supabase project is correct, no later untracked migration exists, and the reviewed commit is the one being released. Confirm the prior `main` branch-protection requirement is satisfied through the repository's normal PR/check workflow rather than bypassing it.

- [ ] **Step 2: Run the production migration dry-run or MCP preflight**

Use the authenticated project-scoped Supabase MCP to list the repository ledger and query only aggregate counts. Confirm `20260928100000_legacy_pricing.sql` is absent and its predecessor is present. Do not query or display eligible email rows.

- [ ] **Step 3: Apply the migration once and record the repository checksum**

Apply the exact reviewed migration using the versioned Supabase migration operation. Record its filename and SHA-256 in `ecl_migrations.schema_migrations` in the same atomic migration, following the existing repository migration-runner convention.

- [ ] **Step 4: Verify aggregate production snapshot integrity**

Run the three aggregate queries from `docs/LEGACY-PRICING.md`, verify the program is active with no expiry/limit, and confirm captured variant count equals the active production variant count at activation. Do not return customer emails.

- [ ] **Step 5: Deploy the matching application revision**

Merge through the protected `main` workflow after required `verify` checks pass and confirm the production deployment uses the reviewed commit. Do not deploy the dirty local checkout or unrelated files.

- [ ] **Step 6: Perform non-purchasing production acceptance**

Confirm the public checkout loads, generic codes still quote normally, entering `ECLLEGACY` without an email shows the approved guidance, changing the email invalidates the quote, and no real order is submitted. Use staging/synthetic data for the eligible-success order path.

- [ ] **Step 7: Authorize later price increases separately**

Treat the planned 20–40% catalogue increase as a separate reviewed migration/change. Before applying it, confirm an eligible synthetic staging customer still receives the captured legacy amount and an ineligible customer receives the new amount.
