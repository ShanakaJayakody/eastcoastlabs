create table public.creator_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null check (char_length(name) between 2 and 80),
  email text not null check (char_length(email) between 3 and 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  social_url text not null check (char_length(social_url) between 8 and 500 and social_url like 'https://%'),
  portfolio_url text not null default '' check (char_length(portfolio_url) <= 500 and (portfolio_url = '' or portfolio_url like 'https://%')),
  discipline text not null check (discipline in ('photography','video','content')),
  focus text not null check (focus in ('fitness','health','biohacking','other')),
  region text not null check (region in ('ACT','NSW','NT','QLD','SA','TAS','VIC','WA')),
  pitch text not null check (char_length(pitch) between 30 and 1000),
  audience text not null default '' check (audience in ('','under-1k','1k-10k','10k-50k','50k-plus')),
  adult_australia boolean not null check (adult_australia),
  contact_consent boolean not null check (contact_consent),
  privacy_version text not null check (char_length(privacy_version) between 1 and 80),
  consent_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new','shortlisted','accepted','declined')),
  revision integer not null default 0 check (revision >= 0),
  reviewer_email text check (reviewer_email is null or char_length(reviewer_email) <= 254),
  internal_notes text not null default '' check (char_length(internal_notes) <= 5000),
  dedupe_key text not null check (dedupe_key ~ '^[a-f0-9]{64}$'),
  dedupe_day date not null,
  unique (dedupe_key, dedupe_day)
);

create table public.creator_application_requests (
  idempotency_key uuid primary key,
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  application_id uuid not null references public.creator_applications(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.creator_application_limits (
  bucket_key text not null check (bucket_key ~ '^[a-f0-9]{64}$'),
  window_start timestamptz not null,
  attempt_count integer not null check (attempt_count > 0),
  primary key (bucket_key, window_start)
);

create index creator_applications_created_idx on public.creator_applications (created_at desc, id desc);
create index creator_applications_status_created_idx on public.creator_applications (status, created_at desc, id desc);

alter table public.creator_applications enable row level security;
alter table public.creator_application_requests enable row level security;
alter table public.creator_application_limits enable row level security;

revoke all on public.creator_applications from public, anon, authenticated;
revoke all on public.creator_application_requests from public, anon, authenticated;
revoke all on public.creator_application_limits from public, anon, authenticated;
grant select, insert, update, delete on public.creator_applications to service_role;
grant select, insert, update, delete on public.creator_application_requests to service_role;
grant select, insert, update, delete on public.creator_application_limits to service_role;

create function public.creator_submit_application(
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
  if coalesce(p_input->>'audience','') not in ('','under-1k','1k-10k','10k-50k','50k-plus') then raise exception 'Invalid creator audience'; end if;
  if jsonb_typeof(p_input->'adult_australia') is distinct from 'boolean' or (p_input->>'adult_australia')::boolean is not true then raise exception 'Invalid creator age/location consent'; end if;
  if jsonb_typeof(p_input->'contact_consent') is distinct from 'boolean' or (p_input->>'contact_consent')::boolean is not true then raise exception 'Invalid creator contact consent'; end if;
  if coalesce(char_length(p_input->>'privacy_version'),0) not between 1 and 80 then raise exception 'Invalid creator privacy version'; end if;

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
    name,email,social_url,portfolio_url,discipline,focus,region,pitch,audience,
    adult_australia,contact_consent,privacy_version,dedupe_key,dedupe_day
  ) values (
    p_input->>'name',
    p_input->>'email',
    p_input->>'social_url',
    coalesce(p_input->>'portfolio_url',''),
    p_input->>'discipline',
    p_input->>'focus',
    p_input->>'region',
    p_input->>'pitch',
    coalesce(p_input->>'audience',''),
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

create function public.creator_review_application(
  p_id uuid,
  p_expected_revision integer,
  p_status text,
  p_notes text,
  p_actor text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.creator_applications%rowtype;
  old_status text;
  changed text[];
begin
  if p_status not in ('new','shortlisted','accepted','declined') then raise exception 'Invalid creator status'; end if;
  if p_expected_revision is null or p_expected_revision < 0 then raise exception 'Invalid creator revision'; end if;
  if coalesce(char_length(p_notes),0) > 5000 then raise exception 'Creator notes are too long'; end if;
  if coalesce(char_length(btrim(p_actor)),0) = 0 or char_length(btrim(p_actor)) > 254 then raise exception 'Creator reviewer required'; end if;

  select * into app from public.creator_applications where id = p_id for update;
  if not found then return jsonb_build_object('status','not_found'); end if;
  if app.revision <> p_expected_revision then
    return jsonb_build_object('status','stale','revision',app.revision,'currentStatus',app.status);
  end if;
  if p_status <> app.status and not (
    (app.status = 'new' and p_status in ('shortlisted','declined')) or
    (app.status = 'shortlisted' and p_status in ('accepted','declined'))
  ) then
    return jsonb_build_object('status','invalid_transition','currentStatus',app.status);
  end if;

  old_status := app.status;
  changed := array[]::text[];
  if p_status <> app.status then changed := array_append(changed, 'status'); end if;
  if coalesce(p_notes,'') is distinct from app.internal_notes then changed := array_append(changed, 'internal_notes'); end if;
  if array_length(changed, 1) is null then return jsonb_build_object('status','ok','revision',app.revision,'applicationStatus',app.status); end if;

  update public.creator_applications
  set status = p_status,
      internal_notes = coalesce(p_notes,''),
      reviewer_email = lower(btrim(p_actor)),
      revision = revision + 1,
      updated_at = now()
  where id = p_id
  returning * into app;

  insert into public.admin_audit_log(actor_email, action, entity_type, entity_id, diff)
  values (
    lower(btrim(p_actor)),
    'creator.' || p_status,
    'creator_application',
    p_id::text,
    jsonb_build_object('fields', changed, 'fromStatus', old_status, 'toStatus', p_status)
  );

  return jsonb_build_object('status','ok','revision',app.revision,'applicationStatus',app.status);
end $$;

create function public.creator_retention_sweep()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_apps integer;
  deleted_limits integer;
begin
  delete from public.creator_applications
  where created_at < now() - interval '180 days'
    and status in ('new','shortlisted','declined');
  get diagnostics deleted_apps = row_count;

  delete from public.creator_application_limits
  where window_start < date_trunc('hour', now() - interval '48 hours');
  get diagnostics deleted_limits = row_count;

  return jsonb_build_object('applicationsDeleted', deleted_apps, 'throttleBucketsDeleted', deleted_limits);
end $$;

revoke all on function public.creator_submit_application(jsonb, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.creator_review_application(uuid, integer, text, text, text) from public, anon, authenticated;
revoke all on function public.creator_retention_sweep() from public, anon, authenticated;
grant execute on function public.creator_submit_application(jsonb, uuid, text, text, text) to service_role;
grant execute on function public.creator_review_application(uuid, integer, text, text, text) to service_role;
grant execute on function public.creator_retention_sweep() to service_role;
