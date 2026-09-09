-- Explicit capture episodes preserve historical cohorts. Existing mutable data
-- cannot establish historic exposure; migrate it as legacy_unknown, never credit it.
create table public.recovery_episodes(
 id uuid primary key default gen_random_uuid(),email text not null,cart jsonb not null,subtotal_cents integer not null check(subtotal_cents>=0),captured_at timestamptz not null default now(),
 state text not null default 'active' check(state in ('active','superseded','stopped','order_created','legacy_unknown')),
 legacy_status text,legacy_order_id uuid,
 closed_at timestamptz,order_id uuid unique references orders(id),legacy_unknown boolean not null default false
);
create index recovery_episodes_capture_idx on recovery_episodes(captured_at,id);
create index recovery_episodes_email_idx on recovery_episodes(email,captured_at desc);
alter table recovery_episodes enable row level security;
grant all on recovery_episodes to service_role;
alter table cart_sessions add column current_episode_id uuid references recovery_episodes(id);
with imported as(
 insert into recovery_episodes(email,cart,subtotal_cents,captured_at,state,legacy_unknown,legacy_status,legacy_order_id)
 select email,cart,subtotal_cents,created_at,'legacy_unknown',true,status,recovered_order_id from cart_sessions returning id,email
) update cart_sessions c set current_episode_id=i.id from imported i where c.email=i.email;
create or replace function recovery_episode_immutable() returns trigger language plpgsql set search_path=public as $$
begin
 if (new.email,new.cart,new.subtotal_cents,new.captured_at,new.legacy_unknown,new.legacy_status,new.legacy_order_id) is distinct from (old.email,old.cart,old.subtotal_cents,old.captured_at,old.legacy_unknown,old.legacy_status,old.legacy_order_id) then raise exception 'Recovery capture snapshots are immutable';end if;
 if old.order_id is not null and new.order_id is distinct from old.order_id then raise exception 'Recovery order association is immutable';end if;
 return new;
end $$;
create trigger recovery_episode_immutable before update on recovery_episodes for each row execute function recovery_episode_immutable();
create or replace function recovery_capture(p_email text,p_cart jsonb,p_subtotal integer) returns uuid language plpgsql security definer set search_path=public as $$
declare current cart_sessions; episode recovery_episodes; result uuid; captured timestamptz:=clock_timestamp();
begin
 p_email:=lower(trim(p_email));
 if p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p_email)>320 or jsonb_typeof(p_cart)<>'array' or jsonb_array_length(p_cart) not between 1 and 100 or p_subtotal<0 then raise exception 'Invalid recovery capture';end if;
 -- Serialize first captures as well as updates, without any external session dependency.
 perform pg_advisory_xact_lock(hashtextextended('recovery:'||p_email,0));
 select * into current from cart_sessions where email=p_email for update;
 if found and current.current_episode_id is not null then
  select * into episode from recovery_episodes where id=current.current_episode_id for update;
  if episode.state='active' and not episode.legacy_unknown and episode.cart=p_cart and episode.subtotal_cents=p_subtotal and current.status='active' then return episode.id;end if;
  if episode.state='active' then update recovery_episodes set state='superseded',closed_at=captured where id=episode.id;end if;
 end if;
 insert into recovery_episodes(email,cart,subtotal_cents,captured_at) values(p_email,p_cart,p_subtotal,captured) returning id into result;
 insert into cart_sessions(email,cart,subtotal_cents,status,reminder_stage,reminder_sent_at,recovered_order_id,created_at,updated_at,current_episode_id)
 values(p_email,p_cart,p_subtotal,'active',0,null,null,captured,captured,result)
 on conflict(email) do update set cart=excluded.cart,subtotal_cents=excluded.subtotal_cents,status='active',reminder_stage=0,reminder_sent_at=null,recovered_order_id=null,created_at=captured,updated_at=captured,current_episode_id=result;
 return result;
end $$;
create or replace function recovery_complete(p_email text,p_order uuid,p_episode uuid default null) returns void language plpgsql security definer set search_path=public as $$
declare o orders; current cart_sessions; episode recovery_episodes;
begin
 p_email:=lower(trim(p_email));
 select * into o from orders where id=p_order;
 if not found or lower(trim(o.customer_email))<>p_email then raise exception 'Recovery order does not match customer';end if;
 perform pg_advisory_xact_lock(hashtextextended('recovery:'||p_email,0));
 select * into current from cart_sessions where email=p_email for update;
 -- Suppression and attribution are separate: an organic same-email order stops
 -- reminders, but only a concrete episode ID can link an episode to its order.
 if p_episode is not null then
  select * into episode from recovery_episodes where id=p_episode and email=p_email for update;
  if found and not episode.legacy_unknown and episode.captured_at<=o.created_at and (episode.order_id=p_order or (episode.order_id is null and current.current_episode_id=p_episode)) then
   update recovery_episodes set order_id=p_order,state='order_created',closed_at=o.created_at where id=p_episode;
  end if;
 end if;
 update recovery_episodes set state='stopped',closed_at=now() where id=current.current_episode_id and state='active';
 update cart_sessions set status='recovered',recovered_order_id=p_order,updated_at=now() where email=p_email and status='active';
end $$;

create or replace view admin_recovery_episodes as
select e.id episode_id,e.email,e.cart,e.subtotal_cents,
 case when e.legacy_unknown then e.legacy_status when e.order_id is not null then 'recovered' when e.state in ('active','superseded','legacy_unknown') then 'active' else 'abandoned' end status,
 case when e.id=c.current_episode_id then coalesce(c.reminder_stage,0) else 0 end reminder_stage,
 case when e.id=c.current_episode_id then c.reminder_sent_at else null end reminder_sent_at,
 coalesce(e.order_id,e.legacy_order_id) recovered_order_id,e.captured_at created_at,e.captured_at updated_at,e.state,e.legacy_unknown,
 exposure.first_sent_at,
 o.created_at order_created_at,o.paid_at,case when o.paid_at is not null and o.status in ('paid','processing','shipped','completed','refunded') then greatest(0,o.total_cents-coalesce(o.refunded_cents,0)) else 0 end net_paid_cents,
 exposure.first_sent_at is not null and exposure.first_sent_at<=o.created_at and exposure.first_sent_at>=e.captured_at and not e.legacy_unknown attributable
from recovery_episodes e left join cart_sessions c on c.email=e.email left join orders o on o.id=coalesce(e.order_id,e.legacy_order_id)
left join lateral(select min(sent_at) first_sent_at from email_outbox where payload->>'recovery_episode_id'=e.id::text and template in ('abandoned_cart','abandoned_cart_2','abandoned_cart_3') and status='sent' and sent_at is not null) exposure on true;
revoke all on admin_recovery_episodes from public,anon,authenticated;
grant select on admin_recovery_episodes to service_role;
create or replace function recovery_episode_metrics(p_since timestamptz,p_until timestamptz) returns jsonb language sql security definer set search_path=public as $$
 select jsonb_build_object(
 'captured',count(*) filter(where not legacy_unknown),'legacy_unknown',count(*) filter(where legacy_unknown),
 'exposed',count(*) filter(where first_sent_at is not null and not legacy_unknown),
 'order_created',count(*) filter(where recovered_order_id is not null and not legacy_unknown),
 'paid',count(*) filter(where paid_at is not null and not legacy_unknown),
 'attributed_paid',count(*) filter(where attributable and paid_at is not null),
 'attributed_net_paid_cents',coalesce(sum(net_paid_cents) filter(where attributable),0)
 ) from admin_recovery_episodes where created_at>=p_since and (p_until is null or created_at<p_until);
$$;
revoke all on function recovery_capture(text,jsonb,integer),recovery_complete(text,uuid,uuid),recovery_episode_metrics(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function recovery_capture(text,jsonb,integer),recovery_complete(text,uuid,uuid),recovery_episode_metrics(timestamptz,timestamptz) to service_role;

-- Operator stop/suppression updates the current mutable cart; close its episode
-- without changing the capture or assigning a same-email order heuristically.
create or replace function recovery_close_episode() returns trigger language plpgsql set search_path=public as $$
begin
 if new.status<>'active' and old.current_episode_id is not null then
  update recovery_episodes set state='stopped',closed_at=now() where id=old.current_episode_id and state='active';
 end if;
 return new;
end $$;
create trigger recovery_close_episode after update on cart_sessions for each row execute function recovery_close_episode();

-- Claiming a stage and queuing its durable email are a single transaction.
-- No signing/network calls in SQL; sender supplies fresh unsubscribe details.
create or replace function recovery_queue_due(p_limit integer default 200) returns integer language plpgsql security definer set search_path=public as $$
declare cart record; stage integer; template_name text; inserted integer; queued integer:=0;
begin
 for cart in
  select c.*,e.captured_at from cart_sessions c join recovery_episodes e on e.id=c.current_episode_id
  where c.status='active' and e.state in ('active','legacy_unknown')
  and c.updated_at<=now()-interval '1 hour' and c.updated_at>now()-interval '168 hours'
  and coalesce(c.reminder_stage,0)<case when c.updated_at<=now()-interval '72 hours' then 3 when c.updated_at<=now()-interval '24 hours' then 2 else 1 end
  and exists(select 1 from subscribers s where s.email=c.email and s.unsubscribed_at is null and s.source not in ('unsubscribe','bounce','complaint') and s.source not like 'back_in_stock:%')
  and not exists(select 1 from sequence_overrides where email=c.email and sequence='cart_recovery' and action='pause')
  and not exists(select 1 from orders where customer_email=c.email and created_at>=e.captured_at and status<>'cancelled')
  order by c.updated_at,c.email for update of c skip locked limit greatest(1,least(coalesce(p_limit,200),200))
 loop
  stage:=case when cart.updated_at<=now()-interval '72 hours' then 3 when cart.updated_at<=now()-interval '24 hours' then 2 else 1 end;
  template_name:=case stage when 1 then 'abandoned_cart' when 2 then 'abandoned_cart_2' else 'abandoned_cart_3' end;
  insert into email_outbox(to_email,template,payload,related_type,related_id)
  values(cart.email,template_name,jsonb_build_object('cart',cart.cart,'subtotal_cents',cart.subtotal_cents,'recovery_episode_id',cart.current_episode_id,'captured_at',cart.captured_at),
   'cart_session',cart.email||':cart:'||stage||':'||floor(extract(epoch from cart.updated_at)*1000)::bigint)
  on conflict(to_email,template,related_id) do nothing;
  get diagnostics inserted=row_count;
  queued:=queued+inserted;
  update cart_sessions set reminder_stage=stage,reminder_sent_at=now() where email=cart.email;
 end loop;
 return queued;
end $$;
revoke all on function recovery_queue_due(integer) from public,anon,authenticated;
grant execute on function recovery_queue_due(integer) to service_role;
