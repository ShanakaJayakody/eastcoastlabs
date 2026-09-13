-- Extend the existing optimistic, audited settings transaction with public facts.
-- Empty identity fields are intentional: the business must supply real values.
create or replace function public.admin_save_settings(p_values jsonb,p_version bigint,p_actor text)
returns bigint language plpgsql security definer set search_path=public as $$
declare current_version bigint; k text; v jsonb; max_length integer; abn_value text; abn_sum integer; i integer; abn_weights integer[] := array[10,1,3,5,7,9,11,13,15,17,19];
begin
 select version into current_version from settings_revision where singleton for update;
 if p_version is null or p_version <> current_version then raise exception 'Settings changed in another editor. Reload and reconcile your draft before saving.'; end if;
 if jsonb_typeof(p_values) is distinct from 'object' then raise exception 'Invalid settings'; end if;
 for k,v in select key,value from jsonb_each(p_values) loop
  if k not in ('announcement_items','free_shipping_threshold','gift_threshold','support_email','payid_enabled','payid_identifier','payid_name','bank_transfer_enabled','bank_bsb','bank_account_number','bank_account_name','payment_window_hours','payment_expiry_hours','standard_shipping_cents','express_shipping_enabled','express_shipping_cents','express_free_threshold','legal_name','abn','public_address','support_hours','dispatch_notes','returns_notes') then raise exception 'Unknown setting %',k; end if;
  if k in ('free_shipping_threshold','gift_threshold','express_free_threshold','standard_shipping_cents','express_shipping_cents','payment_window_hours','payment_expiry_hours') then
   if jsonb_typeof(v) is distinct from 'number' or (v::text)::numeric < 0 or (v::text)::numeric > 100000000 or (k in ('standard_shipping_cents','express_shipping_cents') and (v::text)::numeric <> trunc((v::text)::numeric)) then raise exception 'Invalid shipping/payment numeric setting %',k; end if;
   if k in ('payment_window_hours','payment_expiry_hours') and ((v::text)::numeric < 1 or (v::text)::numeric > 720 or (v::text)::numeric <> trunc((v::text)::numeric)) then raise exception 'Invalid payment hours'; end if;
  end if;
  if k in ('legal_name','abn','public_address','support_hours','dispatch_notes','returns_notes') then
   max_length := case when k in ('legal_name','support_hours') then 160 when k='abn' then 11 when k='public_address' then 500 else 2000 end;
   if jsonb_typeof(v) is distinct from 'string' or length(v #>> '{}') > max_length then raise exception 'Invalid public business setting %',k; end if;
   if k='abn' and (v #>> '{}') <> '' then
    abn_value := v #>> '{}';
    if abn_value !~ '^[0-9]{11}$' then raise exception 'Invalid ABN'; end if;
    abn_sum := 0;
    for i in 1..11 loop
     abn_sum := abn_sum + ((substr(abn_value,i,1)::integer) - case when i=1 then 1 else 0 end) * abn_weights[i];
    end loop;
    if abn_sum % 89 <> 0 then raise exception 'Invalid ABN checksum'; end if;
   end if;
  end if;
 end loop;
 if p_values ? 'payment_window_hours' and p_values ? 'payment_expiry_hours' and (p_values->>'payment_window_hours')::numeric > (p_values->>'payment_expiry_hours')::numeric then raise exception 'Hold exceeds expiry'; end if;
 insert into settings(key,value,updated_at,updated_by) select key,value,now(),p_actor from jsonb_each(p_values)
 on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
 update settings_revision set version=version+1 where singleton returning version into current_version;
 insert into admin_audit_log(actor_email,action,entity_type,diff) values(p_actor,'settings.update','settings',jsonb_build_object('keys',(select jsonb_agg(key) from jsonb_each(p_values))));
 return current_version;
end $$;
revoke all on function public.admin_save_settings(jsonb,bigint,text) from public,anon,authenticated;
grant execute on function public.admin_save_settings(jsonb,bigint,text) to service_role;
