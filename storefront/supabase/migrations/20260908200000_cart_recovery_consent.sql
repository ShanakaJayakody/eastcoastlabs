-- Cart-specific permission is independent of newsletter subscription. Only
-- hashes and internal identities persist here; the sender derives private links.
create table public.recovery_requests (
 id uuid primary key, email text not null, token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 cart jsonb not null, subtotal_cents integer not null check(subtotal_cents>=0),
 requested_at timestamptz not null default clock_timestamp(),
 confirm_expires_at timestamptz not null default now()+interval '24 hours',
 restore_expires_at timestamptz not null default now()+interval '7 days',
 confirmed_at timestamptz, revoked_at timestamptz, episode_id uuid unique references recovery_episodes(id)
);
create index recovery_requests_email_idx on recovery_requests(email,requested_at desc);
alter table recovery_requests enable row level security;
revoke all on recovery_requests from public,anon,authenticated,service_role;
grant select on recovery_requests to service_role;

create function recovery_request(p_id uuid,p_email text,p_hash text,p_cart jsonb,p_subtotal integer) returns uuid
language plpgsql security definer set search_path=public as $$
declare outbox_id uuid;
begin
 if p_id is null or p_email is null or p_email<>lower(trim(p_email)) or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_cart is null or jsonb_typeof(p_cart)<>'array' or jsonb_array_length(p_cart) not between 1 and 50 or p_subtotal is null or p_subtotal<0 then raise exception 'Invalid cart link request';end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription:'||p_email,0));
 if exists(select 1 from recovery_requests where email=p_email and requested_at>now()-interval '1 hour') then return null;end if;
 update recovery_requests set revoked_at=clock_timestamp() where email=p_email and confirmed_at is null and revoked_at is null;
 insert into recovery_requests(id,email,token_hash,cart,subtotal_cents) values(p_id,p_email,p_hash,p_cart,p_subtotal);
 insert into email_outbox(to_email,template,payload,related_type,related_id)
 values(p_email,'cart_recovery_confirmation',jsonb_build_object('recovery_request_id',p_id),'recovery_request',p_id::text) returning id into outbox_id;
 return outbox_id;
end $$;

-- GET never calls this function. Confirmation and repeat restore are explicit
-- POST actions. Repeat use cannot create an episode or restart a sequence.
create function recovery_confirm(p_hash text) returns jsonb language plpgsql security definer set search_path=public as $$
declare r recovery_requests; recipient text; episode uuid;
begin
 select email into recipient from recovery_requests where token_hash=p_hash;
 if not found then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended('subscription:'||recipient,0));
 perform pg_advisory_xact_lock(hashtextextended('recovery:'||recipient,0));
 select * into r from recovery_requests where token_hash=p_hash for update;
 if r.revoked_at is not null or r.restore_expires_at<=now() or (r.confirmed_at is null and r.confirm_expires_at<=now())
 or exists(select 1 from subscribers where email=recipient and unsubscribed_at>=r.requested_at)
 or exists(select 1 from orders where lower(trim(customer_email))=recipient and created_at>=r.requested_at and status<>'cancelled') then return null;end if;
 if r.confirmed_at is null then
  update recovery_requests set revoked_at=clock_timestamp() where email=recipient and id<>r.id and revoked_at is null;
  update recovery_episodes set state='superseded',closed_at=clock_timestamp() where email=recipient and state='active';
  episode:=recovery_capture(recipient,r.cart,r.subtotal_cents);
  update recovery_requests set confirmed_at=clock_timestamp(),episode_id=episode where id=r.id returning * into r;
 end if;
 if not exists(select 1 from recovery_episodes where id=r.episode_id and state='active') then return null;end if;
 return jsonb_build_object('episode_id',r.episode_id,'cart',r.cart,'restore_expires_at',r.restore_expires_at);
end $$;

-- Read-only checkout attribution: possession plus an exact, restored snapshot.
-- No contact fields are returned to the browser or inferred from a saved cart.
create function recovery_attribution(p_hash text,p_email text,p_cart jsonb) returns uuid language sql stable security definer set search_path=public as $$
 select r.episode_id from recovery_requests r join recovery_episodes e on e.id=r.episode_id
 where r.token_hash=p_hash and r.email=lower(trim(p_email)) and r.confirmed_at is not null and r.revoked_at is null and r.restore_expires_at>now()
 and e.state='active' and not exists(select 1 from subscribers s where s.email=r.email and s.unsubscribed_at>=r.requested_at)
 and (select jsonb_agg(jsonb_build_object('key',l->'key','slug',l->'slug','variantLabel',l->'variantLabel','variantId',l->'variantId','quantity',l->'quantity') order by l->>'key') from jsonb_array_elements(r.cart) l)
 = (select jsonb_agg(jsonb_build_object('key',l->'key','slug',l->'slug','variantLabel',l->'variantLabel','variantId',l->'variantId','quantity',l->'quantity') order by l->>'key') from jsonb_array_elements(p_cart) l);
$$;

-- Preserve general marketing suppression, and invalidate purpose-specific
-- credentials under the same lock used by requests and confirmation.
alter function suppress_marketing(text,text) rename to suppress_marketing_before_recovery;
revoke all on function suppress_marketing_before_recovery(text,text) from public,anon,authenticated,service_role;
create function suppress_marketing(p_email text,p_source text default 'unsubscribe') returns void language plpgsql security definer set search_path=public as $$
begin
 p_email:=lower(trim(p_email));
 perform pg_advisory_xact_lock(hashtextextended('subscription:'||p_email,0));
 perform pg_advisory_xact_lock(hashtextextended('recovery:'||p_email,0));
 perform suppress_marketing_before_recovery(p_email,p_source);
 update recovery_requests set revoked_at=clock_timestamp() where email=p_email and revoked_at is null;
 update cart_sessions set status='abandoned' where email=p_email and status='active';
end $$;

-- Leave all other template rules intact. Recovery has its own permission and
-- may follow a fresh request after an earlier general unsubscribe.
alter function email_delivery_ineligible(email_outbox) rename to email_delivery_ineligible_before_recovery;
revoke all on function email_delivery_ineligible_before_recovery(email_outbox) from public,anon,authenticated,service_role;
create function email_delivery_ineligible(r email_outbox) returns text language plpgsql stable security definer set search_path=public as $$
declare consent recovery_requests;
begin
 if r.template not in ('cart_recovery_confirmation','abandoned_cart','abandoned_cart_2','abandoned_cart_3') then return email_delivery_ineligible_before_recovery(r);end if;
 select * into consent from recovery_requests where id::text=r.payload->>'recovery_request_id' and email=r.to_email;
 if not found or consent.revoked_at is not null or exists(select 1 from subscribers where email=r.to_email and unsubscribed_at>=consent.requested_at) then return 'No current cart recovery permission';end if;
 if r.template='cart_recovery_confirmation' then
  if consent.confirmed_at is not null or consent.confirm_expires_at<=now() then return 'Cart confirmation expired or completed';end if;
  return null;
 end if;
 if consent.confirmed_at is null or consent.restore_expires_at<=now() or consent.episode_id::text is distinct from r.payload->>'recovery_episode_id' then return 'Cart recovery permission expired or changed';end if;
 if exists(select 1 from sequence_overrides where email=r.to_email and sequence='cart_recovery' and action='pause') then return 'Sequence paused';end if;
 if not exists(select 1 from cart_sessions c join recovery_episodes e on e.id=c.current_episode_id where c.email=r.to_email and c.current_episode_id=consent.episode_id and c.status='active' and e.state='active' and c.updated_at<=r.created_at and c.updated_at>now()-interval '7 days') then return 'Cart is no longer eligible';end if;
 if exists(select 1 from orders where lower(trim(customer_email))=r.to_email and created_at>=consent.confirmed_at and status<>'cancelled') then return 'Order already placed';end if;
 return null;
end $$;

create or replace function recovery_queue_due(p_limit integer default 200) returns integer language plpgsql security definer set search_path=public as $$
declare cart record; stage integer; template_name text; inserted integer; queued integer:=0;
begin
 for cart in
  select c.*,e.captured_at,r.id request_id from cart_sessions c join recovery_episodes e on e.id=c.current_episode_id join recovery_requests r on r.episode_id=e.id
  where c.status='active' and e.state='active' and r.confirmed_at is not null and r.revoked_at is null and r.restore_expires_at>now()
  and not exists(select 1 from subscribers s where s.email=c.email and s.unsubscribed_at>=r.requested_at)
  and c.updated_at<=now()-interval '1 hour' and c.updated_at>now()-interval '168 hours'
  and coalesce(c.reminder_stage,0)<case when c.updated_at<=now()-interval '72 hours' then 3 when c.updated_at<=now()-interval '24 hours' then 2 else 1 end
  and not exists(select 1 from sequence_overrides where email=c.email and sequence='cart_recovery' and action='pause')
  and not exists(select 1 from orders where lower(trim(customer_email))=c.email and created_at>=e.captured_at and status<>'cancelled')
  order by c.updated_at,c.email for update of c skip locked limit greatest(1,least(coalesce(p_limit,200),200))
 loop
  stage:=case when cart.updated_at<=now()-interval '72 hours' then 3 when cart.updated_at<=now()-interval '24 hours' then 2 else 1 end;
  template_name:=case stage when 1 then 'abandoned_cart' when 2 then 'abandoned_cart_2' else 'abandoned_cart_3' end;
  insert into email_outbox(to_email,template,payload,related_type,related_id)
  values(cart.email,template_name,jsonb_build_object('cart',cart.cart,'subtotal_cents',cart.subtotal_cents,'recovery_episode_id',cart.current_episode_id,'recovery_request_id',cart.request_id,'captured_at',cart.captured_at),
   'cart_session',cart.current_episode_id::text||':'||stage)
  on conflict(to_email,template,related_id) do nothing;
  get diagnostics inserted=row_count;queued:=queued+inserted;
  update cart_sessions set reminder_stage=stage,reminder_sent_at=now() where email=cart.email;
 end loop;
 return queued;
end $$;
revoke all on function recovery_request(uuid,text,text,jsonb,integer),recovery_confirm(text),recovery_attribution(text,text,jsonb),suppress_marketing(text,text),email_delivery_ineligible(email_outbox),recovery_queue_due(integer) from public,anon,authenticated;
grant execute on function recovery_request(uuid,text,text,jsonb,integer),recovery_confirm(text),recovery_attribution(text,text,jsonb),suppress_marketing(text,text),email_delivery_ineligible(email_outbox),recovery_queue_due(integer) to service_role;

-- Operator purpose stop also revokes requests which have not yet confirmed.
-- It does not change the customer's newsletter permission.
create function recovery_stop(p_email text) returns void language plpgsql security definer set search_path=public as $$
begin
 p_email:=lower(trim(p_email));
 perform pg_advisory_xact_lock(hashtextextended('subscription:'||p_email,0));
 perform pg_advisory_xact_lock(hashtextextended('recovery:'||p_email,0));
 update recovery_requests set revoked_at=clock_timestamp() where email=p_email and revoked_at is null;
 update cart_sessions set status='abandoned' where email=p_email and status='active';
end $$;

-- Assemble manual intent from the same consent and episode as the sweep. The
-- last-moment delivery check still runs after queueing; concurrent changes fail closed.
create function recovery_manual_payload(p_email text,p_episode uuid,p_stage integer) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare r recovery_requests; candidate email_outbox; body jsonb; template_name text;
begin
 if p_stage is null or p_stage not between 1 and 3 then return null;end if;
 select * into r from recovery_requests where email=lower(trim(p_email)) and episode_id=p_episode;
 if not found then return null;end if;
 template_name:=case p_stage when 1 then 'abandoned_cart' when 2 then 'abandoned_cart_2' else 'abandoned_cart_3' end;
 body:=jsonb_build_object('cart',r.cart,'subtotal_cents',r.subtotal_cents,'recovery_episode_id',r.episode_id,'recovery_request_id',r.id,'captured_at',r.confirmed_at);
 candidate:=jsonb_populate_record(null::email_outbox,jsonb_build_object('to_email',r.email,'template',template_name,'created_at',now(),'payload',body));
 if email_delivery_ineligible(candidate) is not null then return null;end if;
 return jsonb_build_object('payload',body,'related_id',r.episode_id::text||':'||p_stage);
end $$;
revoke all on function recovery_stop(text),recovery_manual_payload(text,uuid,integer) from public,anon,authenticated;
grant execute on function recovery_stop(text),recovery_manual_payload(text,uuid,integer) to service_role;
