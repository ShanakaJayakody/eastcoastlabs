alter table public.creator_applications
  add column if not exists phone text,
  add column if not exists focus_detail text,
  add column if not exists audience_size integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'creator_applications_phone_e164_check'
      and conrelid = 'public.creator_applications'::regclass
  ) then
    alter table public.creator_applications
      add constraint creator_applications_phone_e164_check
      check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'creator_applications_focus_detail_length_check'
      and conrelid = 'public.creator_applications'::regclass
  ) then
    alter table public.creator_applications
      add constraint creator_applications_focus_detail_length_check
      check (focus_detail is null or focus_detail = '' or char_length(focus_detail) between 2 and 160);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'creator_applications_audience_size_check'
      and conrelid = 'public.creator_applications'::regclass
  ) then
    alter table public.creator_applications
      add constraint creator_applications_audience_size_check
      check (audience_size is null or audience_size between 0 and 2147483647);
  end if;
end $$;

create or replace function public.creator_submit_application(
  p_input jsonb,
  p_idempotency_key uuid,
  p_payload_hash text,
  p_dedupe_key text,
  p_limit_key text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.creator_application_requests%rowtype;
  application_id uuid;
  attempts integer;
  utc_day date := (now() at time zone 'utc')::date;
  hour_start timestamptz := date_trunc('hour', now());
  has_detail_contract boolean;
  submitted_audience_size numeric;
  stored_audience text;
  stored_focus_detail text;
  stored_phone text;
begin
  if jsonb_typeof(p_input) is distinct from 'object' then raise exception 'Invalid creator input'; end if;
  if p_payload_hash !~ '^[a-f0-9]{64}$' or p_dedupe_key !~ '^[a-f0-9]{64}$' or p_limit_key !~ '^[a-f0-9]{64}$' then raise exception 'Invalid creator hashes'; end if;
  if coalesce(char_length(p_input->>'name'),0) not between 2 and 80 then raise exception 'Invalid creator name'; end if;
  if coalesce(char_length(p_input->>'email'),0) not between 3 and 254 or (p_input->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid creator email'; end if;
  if coalesce(char_length(p_input->>'social_url'),0) not between 8 and 500 or (p_input->>'social_url') not like 'https://%' then raise exception 'Invalid creator social URL'; end if;
  if coalesce(char_length(p_input->>'portfolio_url'),0) > 500 or (coalesce(p_input->>'portfolio_url','') <> '' and (p_input->>'portfolio_url') not like 'https://%') then raise exception 'Invalid creator portfolio URL'; end if;
  if (p_input->>'discipline') not in ('photography','video','content') then raise exception 'Invalid creator discipline'; end if;
  if (p_input->>'focus') not in ('fitness','health','biohacking','other') then raise exception 'Invalid creator focus'; end if;
  if (p_input->>'region') not in ('ACT','NSW','NT','QLD','SA','TAS','VIC','WA') then raise exception 'Invalid creator region'; end if;
  if coalesce(char_length(p_input->>'pitch'),0) not between 30 and 1000 then raise exception 'Invalid creator pitch'; end if;
  if jsonb_typeof(p_input->'adult_australia') is distinct from 'boolean' or (p_input->>'adult_australia')::boolean is not true then raise exception 'Invalid creator age/location consent'; end if;
  if jsonb_typeof(p_input->'contact_consent') is distinct from 'boolean' or (p_input->>'contact_consent')::boolean is not true then raise exception 'Invalid creator contact consent'; end if;
  if coalesce(char_length(p_input->>'privacy_version'),0) not between 1 and 80 then raise exception 'Invalid creator privacy version'; end if;

  has_detail_contract :=
    coalesce(p_input->>'privacy_version','') = 'creator-privacy-2026-09-09-v3'
    or p_input ? 'phone'
    or p_input ? 'focus_detail'
    or p_input ? 'audience_size';

  if has_detail_contract then
    stored_phone := p_input->>'phone';
    if stored_phone is null or stored_phone !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'Invalid creator phone'; end if;
    if p_input->>'audience_size' is null or (p_input->>'audience_size') !~ '^[0-9]+$' then raise exception 'Invalid creator audience size'; end if;
    submitted_audience_size := (p_input->>'audience_size')::numeric;
    if submitted_audience_size < 0 or submitted_audience_size > 2147483647 then raise exception 'Invalid creator audience size'; end if;

    if (p_input->>'focus') = 'other' then
      if jsonb_typeof(p_input->'focus_detail') is distinct from 'string' then raise exception 'Invalid creator focus detail'; end if;
      stored_focus_detail := btrim(p_input->>'focus_detail', U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
      if char_length(stored_focus_detail) not between 2 and 160 then raise exception 'Invalid creator focus detail'; end if;
    else
      stored_focus_detail := '';
    end if;

    stored_audience := case
      when submitted_audience_size < 1000 then 'under-1k'
      when submitted_audience_size < 10000 then '1k-10k'
      when submitted_audience_size < 50000 then '10k-50k'
      else '50k-plus'
    end;
  else
    if coalesce(p_input->>'audience','') not in ('','under-1k','1k-10k','10k-50k','50k-plus') then raise exception 'Invalid creator audience'; end if;
    stored_phone := null;
    stored_focus_detail := null;
    submitted_audience_size := null;
    stored_audience := coalesce(p_input->>'audience','');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('creator-application:' || p_idempotency_key::text, 0));

  select * into existing from public.creator_application_requests where idempotency_key = p_idempotency_key for update;
  if found then
    if existing.payload_hash = p_payload_hash then return jsonb_build_object('status','ok'); end if;
    return jsonb_build_object('status','conflict');
  end if;

  insert into public.creator_application_limits(bucket_key, window_start, attempt_count)
  values (p_limit_key, hour_start, 1)
  on conflict (bucket_key, window_start)
  do update set attempt_count = public.creator_application_limits.attempt_count + 1
  returning attempt_count into attempts;

  if attempts > 10 then
    return jsonb_build_object('status','limited');
  end if;

  insert into public.creator_applications(
    name,email,phone,social_url,portfolio_url,discipline,focus,focus_detail,region,pitch,audience,audience_size,
    adult_australia,contact_consent,privacy_version,dedupe_key,dedupe_day
  ) values (
    p_input->>'name',
    p_input->>'email',
    stored_phone,
    p_input->>'social_url',
    coalesce(p_input->>'portfolio_url',''),
    p_input->>'discipline',
    p_input->>'focus',
    stored_focus_detail,
    p_input->>'region',
    p_input->>'pitch',
    stored_audience,
    submitted_audience_size,
    (p_input->>'adult_australia')::boolean,
    (p_input->>'contact_consent')::boolean,
    p_input->>'privacy_version',
    p_dedupe_key,
    utc_day
  )
  on conflict (dedupe_key, dedupe_day) do nothing
  returning id into application_id;

  if application_id is null then
    select id into application_id from public.creator_applications
    where dedupe_key = p_dedupe_key and dedupe_day = utc_day
    for update;
  end if;

  insert into public.creator_application_requests(idempotency_key, payload_hash, application_id)
  values (p_idempotency_key, p_payload_hash, application_id);

  return jsonb_build_object('status','ok');
end $$;

revoke all on function public.creator_submit_application(jsonb, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.creator_submit_application(jsonb, uuid, text, text, text) to service_role;
