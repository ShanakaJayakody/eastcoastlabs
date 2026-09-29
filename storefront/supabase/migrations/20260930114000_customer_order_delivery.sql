-- The selected carrier must be committed before the shipment event snapshots it.
alter function public.commerce_order_operation(uuid,text,jsonb) rename to commerce_order_operation_before_carrier;
revoke all on function public.commerce_order_operation_before_carrier(uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.commerce_order_operation(p_order uuid,p_action text,p_options jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o orders%rowtype; carrier text;
begin
 if p_action in ('shipped','tracking') and p_options ? 'carrierCode' then
  select * into o from orders where id=p_order for update;
  if not found then raise exception 'Order not found';end if;
  -- Let the original operation validate/replay its complete request first.
  if (p_options->>'idempotencyKey' is not null and exists(select 1 from commerce_operations where order_id=p_order and operation_key=p_options->>'idempotencyKey')) or (p_action='shipped' and o.status='shipped') then
   return commerce_order_operation_before_carrier(p_order,p_action,p_options);
  end if;
  carrier:=nullif(p_options->>'carrierCode','');
  if carrier is not null and carrier not in ('auspost','dhl','fedex','ups','sendle') then raise exception 'Unknown carrier';end if;
  update orders set carrier_code=carrier where id=p_order;
 end if;
 return commerce_order_operation_before_carrier(p_order,p_action,p_options);
end $$;
revoke all on function public.commerce_order_operation(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.commerce_order_operation(uuid,text,jsonb) to service_role;

create function public.customer_order_contact_changed() returns trigger language plpgsql set search_path=public as $$
begin
 if lower(btrim(new.customer_email)) is distinct from lower(btrim(old.customer_email)) then
  new.order_access_version:=old.order_access_version+1;
  new.customer_user_id:=null;new.customer_claimed_at:=null;
 end if;
 return new;
end $$;
create trigger customer_order_contact_changed before update of customer_email on public.orders for each row execute function public.customer_order_contact_changed();

alter table public.email_outbox add column rendered_text text,add column rendered_reply_to text,add column rendered_extras_frozen boolean not null default false;
create function public.prepare_email_delivery_v3(p_id uuid,p_lease uuid,p_subject text,p_html text,p_from text,p_text text default null,p_reply_to text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r email_outbox%rowtype; result jsonb;
begin
 select * into r from email_outbox where id=p_id and status='sending' and lease_token=p_lease and lease_expires_at>now() for update;
 if not found then raise exception 'Delivery lease lost';end if;
 if not r.rendered_extras_frozen then
  -- A previously frozen/attempted legacy body has no extras. Freeze that absence.
  update email_outbox set rendered_text=case when r.provider_attempted_at is null and r.rendered_html is null then p_text end,
   rendered_reply_to=case when r.provider_attempted_at is null and r.rendered_html is null then p_reply_to end,
   rendered_extras_frozen=true where id=p_id;
 end if;
 result:=prepare_email_delivery_v2(p_id,p_lease,p_subject,p_html,p_from);
 select * into r from email_outbox where id=p_id;
 return result||jsonb_build_object('text',r.rendered_text,'reply_to',r.rendered_reply_to);
end $$;
-- Customer-email edits may reset an unattempted frozen message. Never attach new
-- material to an attempted request or rewrite its historical presentation facts.
create function public.refresh_unattempted_order_mail() returns trigger language plpgsql set search_path=public as $$
declare o orders%rowtype;
begin
 if old.provider_attempted_at is not null or old.provider_message_id is not null or old.sent_at is not null then return new;end if;
 if new.rendered_html is null and old.rendered_html is not null then
  new.rendered_text:=null;new.rendered_reply_to:=null;new.rendered_extras_frozen:=false;
 end if;
 if new.to_email is distinct from old.to_email and new.template in ('payment_instructions','payment_reminder','payment_expiring','payment_expired','order_confirmation','order_shipped','order_refunded') then
  new.payload:=coalesce(new.payload,'{}'::jsonb)-'order_summary_v1';
  select * into o from orders where id::text=new.payload->>'order_id' and lower(btrim(customer_email))=lower(btrim(new.to_email));
  if found then new.payload:=new.payload||jsonb_build_object('order_summary_v1',customer_order_summary(o.id));end if;
 end if;
 return new;
end $$;
create trigger refresh_unattempted_order_mail before update on public.email_outbox for each row execute function public.refresh_unattempted_order_mail();

-- The provider proof and DB compare must cover the same optional frozen fields.
alter function public.admin_reconcile_email(uuid,text,jsonb,text,text) rename to admin_reconcile_email_before_extras;
revoke all on function public.admin_reconcile_email_before_extras(uuid,text,jsonb,text,text) from public,anon,authenticated,service_role;
create function public.admin_reconcile_email(p_id uuid,p_provider_id text,p_snapshot jsonb,p_actor text,p_reason text) returns text
language plpgsql security definer set search_path=public as $$
declare r email_outbox%rowtype;
begin
 select * into r from email_outbox where id=p_id for update;
 if coalesce(p_snapshot->>'text','') is distinct from coalesce(r.rendered_text,'') or coalesce(p_snapshot->>'reply_to','') is distinct from coalesce(r.rendered_reply_to,'') then raise exception 'Frozen provider extras changed; refresh reconciliation';end if;
 return admin_reconcile_email_before_extras(p_id,p_provider_id,p_snapshot-'text'-'reply_to',p_actor,p_reason);
end $$;
revoke all on function public.customer_order_contact_changed(),public.refresh_unattempted_order_mail(),public.prepare_email_delivery_v3(uuid,uuid,text,text,text,text,text),public.admin_reconcile_email(uuid,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.prepare_email_delivery_v3(uuid,uuid,text,text,text,text,text),public.admin_reconcile_email(uuid,text,jsonb,text,text) to service_role;
