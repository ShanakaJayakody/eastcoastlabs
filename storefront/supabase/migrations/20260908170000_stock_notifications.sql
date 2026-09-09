-- Each explicit waitlist upsert is a new request, including a repeat after an
-- earlier alert. UUID identity avoids timestamp collisions and lifetime dedupe.
alter table public.stock_notifications
  add column request_id uuid not null default gen_random_uuid(),
  add column requested_at timestamptz not null default now();
create function public.refresh_stock_notification_request() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
 if new.notified=false and new.request_id is not distinct from old.request_id then
  new.request_id:=gen_random_uuid();new.requested_at:=clock_timestamp();
 end if;
 return new;
end $$;
create trigger refresh_stock_notification_request before update of notified on public.stock_notifications
for each row execute function public.refresh_stock_notification_request();

create function public.stock_notification_variant_available(p_variant uuid) returns boolean
language sql stable security invoker set search_path=public as $$
 select exists(
  select 1 from product_variants v join products p on p.id=v.product_id
  join product_variants pool on pool.product_id=p.id and pool.pack_size=1
  join inventory inv on inv.variant_id=pool.id
  where v.id=p_variant and v.active and pool.active and p.status='active'
   and inv.on_hand-inv.reserved>=v.pack_size
   and (p.slug<>'reconstitution-kit' or exists(
    select 1 from products water join product_variants wv on wv.product_id=water.id
    join inventory wi on wi.variant_id=wv.id
    where water.slug='bacteriostatic-water' and water.status='active' and wv.active and wv.pack_size=1 and wi.on_hand-wi.reserved>=1
   ))
 );
$$;

create function public.queue_back_in_stock(p_variant uuid) returns integer
language plpgsql security invoker set search_path=public as $$
declare product record;request record;queued integer:=0;
begin
 if not stock_notification_variant_available(p_variant) then return 0;end if;
 select p.slug,p.name,v.label into product from product_variants v join products p on p.id=v.product_id where v.id=p_variant;
 for request in select n.* from stock_notifications n where n.product_slug=product.slug and not n.notified
  and not exists(select 1 from subscribers s where s.email=n.email and s.unsubscribed_at is not null)
  order by n.id for update of n skip locked
 loop
  -- Failure aborts both the claim and all intents from this call. The current
  -- request has a different identity from earlier sent/cancelled notifications.
  insert into email_outbox(to_email,template,payload,related_type,related_id)
  values(request.email,'back_in_stock',jsonb_build_object(
   'product_name',product.name,'product_slug',product.slug,'variant_label',product.label,
   'url','/product/'||product.slug,'notification_id',request.id,'request_id',request.request_id,'variant_id',p_variant
  ),'stock_notification_request',request.request_id::text)
  on conflict(to_email,template,related_id) do nothing;
  if found then queued:=queued+1;end if;
  update stock_notifications set notified=true where id=request.id;
 end loop;
 return queued;
end $$;

create function public.back_in_stock_eligible(r public.email_outbox) returns boolean
language sql stable security invoker set search_path=public as $$
 select r.template='back_in_stock' and exists(
  select 1 from stock_notifications n join product_variants v on v.id::text=r.payload->>'variant_id'
  join products p on p.id=v.product_id and p.slug=n.product_slug
  where n.id::text=r.payload->>'notification_id' and n.request_id::text=r.payload->>'request_id'
   and n.request_id::text=r.related_id and n.email=r.to_email and n.notified
   and n.product_slug=r.payload->>'product_slug' and stock_notification_variant_available(v.id)
   and not exists(select 1 from subscribers s where s.email=n.email and s.unsubscribed_at is not null)
 );
$$;
revoke execute on function public.refresh_stock_notification_request(),public.stock_notification_variant_available(uuid),public.queue_back_in_stock(uuid),public.back_in_stock_eligible(public.email_outbox) from public,anon,authenticated;
grant execute on function public.refresh_stock_notification_request(),public.stock_notification_variant_available(uuid),public.queue_back_in_stock(uuid),public.back_in_stock_eligible(public.email_outbox) to service_role;


-- A stock-only cancellation before any authorised provider attempt may keep
-- the original explicit request waiting. A fresh intent ID is needed because
-- the old outbox row is terminal; this is not renewed marketing consent.
create function public.rearm_unsent_stock_notification(r public.email_outbox) returns boolean
language plpgsql security invoker set search_path=public as $$
begin
 if r.template<>'back_in_stock' or r.status not in ('queued','sending') or r.provider_attempted_at is not null then return false;end if;
 update stock_notifications n set notified=false,request_id=gen_random_uuid()
 where n.id::text=r.payload->>'notification_id' and n.request_id::text=r.payload->>'request_id'
  and n.request_id::text=r.related_id and n.email=r.to_email and n.notified
  and n.product_slug=r.payload->>'product_slug'
  and not exists(select 1 from subscribers s where s.email=n.email and s.unsubscribed_at is not null)
  and exists(select 1 from product_variants v join products p on p.id=v.product_id
   where v.id::text=r.payload->>'variant_id' and p.slug=n.product_slug and not stock_notification_variant_available(v.id));
 return found;
end $$;
revoke execute on function public.rearm_unsent_stock_notification(public.email_outbox) from public,anon,authenticated;
grant execute on function public.rearm_unsent_stock_notification(public.email_outbox) to service_role;
