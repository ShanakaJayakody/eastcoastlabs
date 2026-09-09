-- A payment commits its analytics intent, never a network request. The snapshot
-- contains only a GA client ID and commerce amounts/catalog identifiers.
create table public.paid_analytics_outbox (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  payload jsonb not null,
  occurred_at timestamptz not null,
  status text not null default 'queued' check (status in ('queued','sending','failed','accepted','dead')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error text,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index paid_analytics_due on public.paid_analytics_outbox(next_attempt_at) where status in ('queued','failed','sending');
alter table public.paid_analytics_outbox enable row level security;
revoke all on public.paid_analytics_outbox from public,anon,authenticated;
grant all on public.paid_analytics_outbox to service_role;

create function public.enqueue_paid_analytics() returns trigger
language plpgsql security invoker set search_path=public as $$
declare o public.orders%rowtype;client text;items jsonb;
begin
  if new.kind <> 'paid' then return new;end if;
  select * into o from public.orders where id=new.order_id;
  client:=o.checkout_request->>'analyticsClientId';
  -- A server-read GA cookie is required; absence is not replaced with an ID.
  if client is null or client !~ '^[0-9]{1,20}\.[0-9]{1,20}$' or o.paid_at is null then return new;end if;
  select jsonb_agg(jsonb_build_object(
    'item_id',left(coalesce(nullif(i.sku,''),nullif(i.product_slug,''),i.id::text),100),
    'item_name',left(coalesce(i.product_name,'Product'),100),
    'quantity',i.qty,
    'price',(i.line_total_cents-i.discount_allocated_cents)::numeric/i.qty/100,
    'discount',i.discount_allocated_cents::numeric/i.qty/100
  ) order by i.id) into items from public.order_items i where i.order_id=o.id and i.qty>0;
  insert into public.paid_analytics_outbox(order_id,occurred_at,payload)
  values(o.id,o.paid_at,jsonb_build_object(
    'client_id',client,'timestamp_micros',floor(extract(epoch from o.paid_at)*1000000),
    'validation_behavior','ENFORCE_RECOMMENDATIONS',
    'events',jsonb_build_array(jsonb_build_object('name','purchase','params',jsonb_build_object(
      'transaction_id',o.order_number,'currency',o.currency,
      'value',(o.subtotal_cents-o.discount_cents)::numeric/100,
      'shipping',o.shipping_cents::numeric/100,'items',coalesce(items,'[]'::jsonb)
    )))
  )) on conflict(order_id) do nothing;
  return new;
end $$;
create trigger enqueue_paid_analytics after insert on public.commerce_events
for each row execute function public.enqueue_paid_analytics();

create function public.claim_paid_analytics() returns setof public.paid_analytics_outbox
language plpgsql security invoker set search_path=public as $$
begin
  -- Leave a minute of transport margin: never rewrite an old payment timestamp.
  update public.paid_analytics_outbox set status='dead',last_error='Purchase delivery window or attempt limit exceeded',lease_token=null,lease_expires_at=null
  where status in ('queued','failed','sending')
    and (status<>'sending' or lease_expires_at<=now())
    and (occurred_at<=now()-interval '71 hours 59 minutes' or attempts>=8);
  return query with candidate as (
    select id from public.paid_analytics_outbox
    where ((status in ('queued','failed') and next_attempt_at<=now()) or (status='sending' and lease_expires_at<=now()))
      and occurred_at>now()-interval '71 hours 59 minutes' and attempts<8
    order by next_attempt_at,created_at,id for update skip locked limit 1
  ) update public.paid_analytics_outbox a set status='sending',attempts=a.attempts+1,
    lease_token=gen_random_uuid(),lease_expires_at=now()+interval '2 minutes'
    from candidate c where a.id=c.id returning a.*;
end $$;

create function public.finish_paid_analytics(p_id uuid,p_lease uuid,p_accepted boolean,p_permanent boolean,p_error text)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
  update public.paid_analytics_outbox set
    status=case when p_accepted then 'accepted' when p_permanent or attempts>=8 or occurred_at<=now()-interval '71 hours 59 minutes' then 'dead' else 'failed' end,
    accepted_at=case when p_accepted then now() else null end,
    last_error=case when p_accepted then null else left(p_error,200) end,
    next_attempt_at=now()+make_interval(secs=>least(21600,60*power(2,attempts-1))::int),
    lease_token=null,lease_expires_at=null
  where id=p_id and status='sending' and lease_token=p_lease and lease_expires_at>now();
  return found;
end $$;
revoke execute on function public.enqueue_paid_analytics(),public.claim_paid_analytics(),public.finish_paid_analytics(uuid,uuid,boolean,boolean,text) from public,anon,authenticated;
grant execute on function public.enqueue_paid_analytics(),public.claim_paid_analytics(),public.finish_paid_analytics(uuid,uuid,boolean,boolean,text) to service_role;

-- Include previously retired work in health reporting even when there is no
-- sendable claim. Operators must reconcile terminal failures explicitly.
create function public.paid_analytics_dead_count() returns integer
language sql stable security invoker set search_path=public as $$
  select count(*)::integer from public.paid_analytics_outbox where status='dead';
$$;
revoke execute on function public.paid_analytics_dead_count() from public,anon,authenticated;
grant execute on function public.paid_analytics_dead_count() to service_role;
