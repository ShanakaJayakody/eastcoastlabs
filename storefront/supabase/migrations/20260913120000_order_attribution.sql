-- Consent-approved first-party measurement is snapshotted separately from the
-- broader checkout request. The shape is deliberately too narrow for contact
-- data, referrers, query strings or arbitrary URLs.
create table public.measurement_campaigns (
 id text primary key check(id ~ '^[a-z0-9][a-z0-9._~-]{0,63}$'),
 active boolean not null default false,
 created_at timestamptz not null default now()
);
create function public.valid_measurement_variants(value text[]) returns boolean
language sql immutable set search_path=public as $$
 select cardinality(value) between 2 and 8 and cardinality(value)=cardinality(array(select distinct item from unnest(value) item))
   and not exists(select 1 from unnest(value) item where item !~ '^[a-z0-9][a-z0-9._~-]{0,63}$');
$$;
create table public.measurement_experiments (
 id text primary key check(id ~ '^[a-z0-9][a-z0-9._~-]{0,63}$'),
 variants text[] not null check(public.valid_measurement_variants(variants)),
 active boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.measurement_campaigns enable row level security;
alter table public.measurement_experiments enable row level security;
revoke all on public.measurement_campaigns,public.measurement_experiments from public,anon,authenticated;
grant all on public.measurement_campaigns,public.measurement_experiments to service_role;

alter table public.orders add column attribution jsonb;

create function public.valid_order_attribution(value jsonb) returns boolean
language plpgsql immutable set search_path=public as $$
declare acquisition jsonb;assignment jsonb;ids text[]:=array[]::text[];identifier constant text:='^[a-z0-9][a-z0-9._~-]{0,63}$';
begin
 if value is null then return true;end if;
 if jsonb_typeof(value)<>'object' or exists(select 1 from jsonb_object_keys(value) key where key not in ('acquisition','experiments'))
    or jsonb_typeof(value->'experiments')<>'array' or jsonb_array_length(value->'experiments')>8 then return false;end if;
 acquisition:=value->'acquisition';
 if acquisition is not null and (
   jsonb_typeof(acquisition)<>'object'
   or exists(select 1 from jsonb_object_keys(acquisition) key where key not in ('source','medium','campaign','landingPath'))
   or coalesce(acquisition->>'source','') not in ('google','bing','newsletter','creator','affiliate','instagram','facebook')
   or (acquisition ? 'medium' and coalesce(acquisition->>'medium','') not in ('cpc','paid-search','email','social','affiliate','organic'))
   or (acquisition ? 'campaign' and coalesce(acquisition->>'campaign','') !~ identifier)
   or coalesce(acquisition->>'landingPath','') !~ '^(\/|\/1|\/(shop|stacks|lab-results|learn|about|checkout|creators)|\/(product|collections|learn)\/[a-z0-9-]+)\/?$'
 ) then return false;end if;
 for assignment in select entry from jsonb_array_elements(value->'experiments') entries(entry) loop
   if jsonb_typeof(assignment)<>'object'
      or exists(select 1 from jsonb_object_keys(assignment) key where key not in ('experimentId','variant'))
      or coalesce(assignment->>'experimentId','') !~ identifier or coalesce(assignment->>'variant','') !~ identifier
      or assignment->>'experimentId'=any(ids) then return false;end if;
   ids:=array_append(ids,assignment->>'experimentId');
 end loop;
 return acquisition is not null or jsonb_array_length(value->'experiments')>0;
end $$;

-- Configuration can be retired while a consented first-touch cookie is still
-- alive. Optional stale dimensions are removed instead of turning checkout
-- into a dependency on measurement administration.
create function public.scrub_order_attribution(value jsonb) returns jsonb
language plpgsql stable set search_path=public as $$
declare sanitized jsonb;assignment jsonb;active_assignments jsonb:='[]'::jsonb;
begin
 if value is null then return null;end if;
 if not valid_order_attribution(value) then raise exception 'Invalid order attribution';end if;
 sanitized:=value;
 if sanitized#>>'{acquisition,campaign}' is not null and not exists(
   select 1 from measurement_campaigns where id=sanitized#>>'{acquisition,campaign}' and active
 ) then
   sanitized:=jsonb_set(sanitized,'{acquisition}',(sanitized->'acquisition')-'campaign');
 end if;
 select coalesce(jsonb_agg(entry order by ordinal),'[]'::jsonb) into active_assignments
 from jsonb_array_elements(sanitized->'experiments') with ordinality entries(entry,ordinal)
 where exists(select 1 from measurement_experiments
   where id=entry->>'experimentId' and active and entry->>'variant'=any(variants));
 sanitized:=jsonb_set(sanitized,'{experiments}',active_assignments);
 if sanitized->'acquisition' is null and jsonb_array_length(active_assignments)=0 then return null;end if;
 return sanitized;
end $$;

create function public.scrub_checkout_measurement(value jsonb) returns jsonb
language plpgsql stable set search_path=public as $$
declare attribution jsonb;
begin
 if value is null or not value ? 'orderAttribution' then return value;end if;
 attribution:=scrub_order_attribution(value->'orderAttribution');
 return case when attribution is null then value-'orderAttribution'
   else jsonb_set(value,'{orderAttribution}',attribution) end;
end $$;

create function public.capture_order_attribution() returns trigger
language plpgsql set search_path=public as $$
begin
 new.checkout_request:=scrub_checkout_measurement(new.checkout_request);
 new.attribution:=case when new.checkout_request ? 'orderAttribution' then new.checkout_request->'orderAttribution' else null end;
 if not valid_order_attribution(new.attribution) then raise exception 'Invalid order attribution';end if;
 return new;
end $$;
create trigger capture_order_attribution before insert or update of checkout_request on public.orders
for each row execute function public.capture_order_attribution();
alter table public.orders add constraint orders_attribution_valid check(public.valid_order_attribution(attribution));

-- Normalize both a new request and an existing stored request before the
-- original commerce function performs its exact legacy idempotency comparison.
-- The same advisory lock makes this wrapper safe for concurrent retries.
do $$ begin
 if to_regprocedure('public.commerce_create_order(jsonb)') is not null then
   execute 'alter function public.commerce_create_order(jsonb) rename to commerce_create_order_unfiltered';
 end if;
end $$;
create function public.commerce_create_order(p_input jsonb) returns jsonb
language plpgsql set search_path=public as $$
declare sanitized jsonb;request_key uuid;stored_request jsonb;stored_fingerprint text;incoming_request jsonb;
begin
 sanitized:=scrub_checkout_measurement(p_input);
 if sanitized->>'idempotencyKey' is not null then
   request_key:=(sanitized->>'idempotencyKey')::uuid;
   perform pg_advisory_xact_lock(hashtextextended(request_key::text,0));
   select checkout_request,checkout_fingerprint into stored_request,stored_fingerprint from orders where checkout_key=request_key;
   if found and stored_fingerprint is null then
     incoming_request:=sanitized-'idempotencyKey';
     incoming_request:=jsonb_set(incoming_request,'{email}',to_jsonb(lower(trim(sanitized->>'email'))));
     if scrub_checkout_measurement(stored_request)=incoming_request then
       -- Give the original function its exact immutable stored request so its
       -- legacy equality check succeeds without rewriting historical attribution.
       sanitized:=stored_request||jsonb_build_object('idempotencyKey',request_key);
     end if;
   end if;
 end if;
 return commerce_create_order_unfiltered(sanitized);
end $$;
revoke all on function public.commerce_create_order(jsonb) from public,anon,authenticated;
grant execute on function public.commerce_create_order(jsonb) to service_role;

-- Replace only the purchase snapshot builder. Payment/refund event identities,
-- timestamps, immutable evidence and idempotency remain unchanged.
create or replace function public.enqueue_paid_analytics() returns trigger
language plpgsql security invoker set search_path=public as $$
declare o public.orders%rowtype;client text;items jsonb;dimensions jsonb:='{}'::jsonb;
begin
  if new.kind <> 'paid' then return new;end if;
  select * into o from public.orders where id=new.order_id;
  client:=o.checkout_request->>'analyticsClientId';
  if client is null or client !~ '^[0-9]{1,20}\.[0-9]{1,20}$' or o.paid_at is null then return new;end if;
  select jsonb_agg(jsonb_build_object(
    'item_id',left(coalesce(nullif(canonical.slug,''),nullif(i.product_slug,''),nullif(i.sku,''),i.id::text),100),
    'item_name',left(coalesce(i.product_name,'Product'),100),
    'item_variant',left(coalesce(i.variant_label,'Unspecified'),100),
    'quantity',i.qty,
    'price',(i.line_total_cents-i.discount_allocated_cents)::numeric/i.qty/100,
    'discount',i.discount_allocated_cents::numeric/i.qty/100
  ) order by i.id) into items from public.order_items i
    left join public.product_variants selected_variant on selected_variant.id=i.variant_id
    left join public.products selected_product on selected_product.id=selected_variant.product_id
    left join public.products canonical on canonical.id=coalesce(selected_product.size_parent_id,selected_product.id)
    where i.order_id=o.id and i.qty>0;
  if o.attribution is not null then
    dimensions:=jsonb_strip_nulls(jsonb_build_object(
      'acquisition_source',o.attribution#>>'{acquisition,source}',
      'acquisition_medium',o.attribution#>>'{acquisition,medium}',
      'acquisition_campaign',o.attribution#>>'{acquisition,campaign}',
      'acquisition_landing_page',o.attribution#>>'{acquisition,landingPath}',
      'experiment_id',o.attribution#>>'{experiments,0,experimentId}',
      'experiment_variant',o.attribution#>>'{experiments,0,variant}'
    ));
  end if;
  insert into public.paid_analytics_outbox(order_id,occurred_at,payload)
  values(o.id,o.paid_at,jsonb_build_object(
    'client_id',client,'timestamp_micros',floor(extract(epoch from o.paid_at)*1000000),
    'validation_behavior','ENFORCE_RECOMMENDATIONS',
    'events',jsonb_build_array(jsonb_build_object('name','purchase','params',jsonb_build_object(
      'transaction_id',o.order_number,'currency',o.currency,
      'value',(o.subtotal_cents-o.discount_cents)::numeric/100,
      'shipping',o.shipping_cents::numeric/100,'items',coalesce(items,'[]'::jsonb)
    )||dimensions))
  )) on conflict(order_id) where event_kind='purchase' do nothing;
  return new;
end $$;

revoke execute on function public.valid_measurement_variants(text[]),public.valid_order_attribution(jsonb),public.scrub_order_attribution(jsonb),public.scrub_checkout_measurement(jsonb),public.capture_order_attribution() from public,anon,authenticated;
grant execute on function public.valid_measurement_variants(text[]),public.valid_order_attribution(jsonb),public.scrub_order_attribution(jsonb),public.scrub_checkout_measurement(jsonb),public.capture_order_attribution() to service_role;
