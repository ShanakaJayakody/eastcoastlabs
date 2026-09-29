-- Customer authority is established only by server-verified email OTP.
alter table public.orders add column customer_user_id uuid references auth.users(id) on delete set null;
alter table public.orders add column customer_claimed_at timestamptz;
create index orders_customer_history_idx on public.orders(customer_user_id,created_at desc,id desc);
create index orders_unclaimed_email_idx on public.orders(lower(btrim(customer_email))) where customer_claimed_at is null;
create table public.customer_login_challenges (
 id uuid primary key default gen_random_uuid(),email text not null,ip_hash text not null,
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '10 minutes',
 attempts integer not null default 0,lease uuid,lease_expires_at timestamptz,used_at timestamptz
);
create index customer_login_email_idx on public.customer_login_challenges(email,created_at);
create index customer_login_ip_idx on public.customer_login_challenges(ip_hash,created_at);
create table public.customer_sessions (
 token_hash text primary key check(token_hash~'^[a-f0-9]{64}$'),user_id uuid not null references auth.users(id) on delete cascade,
 email text not null,created_at timestamptz not null default now(),last_seen_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days'
);
alter table public.customer_login_challenges enable row level security;
alter table public.customer_sessions enable row level security;
revoke all on public.customer_login_challenges,public.customer_sessions from public,anon,authenticated;
grant all on public.customer_login_challenges,public.customer_sessions to service_role;

create function public.customer_claim_orders(p_user uuid) returns integer language plpgsql security definer set search_path=public as $$
declare mail text; n integer;
begin
 select lower(btrim(email)) into mail from auth.users where id=p_user and email_confirmed_at is not null and (banned_until is null or banned_until<=now());
 if mail is null then raise exception 'Verified customer required';end if;
 update orders set customer_user_id=p_user,customer_claimed_at=now()
  where customer_user_id is null and customer_claimed_at is null and lower(btrim(customer_email))=mail;
 get diagnostics n=row_count;return n;
end $$;
create function public.customer_begin_login(p_email text,p_ip_hash text) returns uuid language plpgsql security definer set search_path=public as $$
declare mail text:=lower(btrim(p_email)); result uuid;
begin
 if length(mail) not between 3 and 254 or mail!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(coalesce(p_ip_hash,'')) not between 1 and 128 then raise exception 'Invalid sign-in request';end if;
 perform pg_advisory_xact_lock(hashtextextended('customer-login-ip:'||p_ip_hash,0));
 perform pg_advisory_xact_lock(hashtextextended('customer-login-email:'||mail,0));
 if exists(select 1 from customer_login_challenges where email=mail and created_at>now()-interval '60 seconds')
  or (select count(*) from customer_login_challenges where email=mail and created_at>now()-interval '1 hour')>=5
  or (select count(*) from customer_login_challenges where ip_hash=p_ip_hash and created_at>now()-interval '1 hour')>=30 then raise exception 'Sign-in rate limit';end if;
 -- Invalidate older app challenges, even if the provider's OTP validity is longer.
 update customer_login_challenges set used_at=now() where email=mail and used_at is null;
 insert into customer_login_challenges(email,ip_hash) values(mail,p_ip_hash) returning id into result;
 return result;
end $$;
create function public.customer_reserve_verification(p_challenge uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare c customer_login_challenges%rowtype; nonce uuid:=gen_random_uuid();
begin
 select * into c from customer_login_challenges where id=p_challenge for update;
 if not found or c.used_at is not null or c.expires_at<=now() or c.attempts>=5 then raise exception 'Code expired or attempt limit reached';end if;
 if c.lease_expires_at>now() then raise exception 'Verification in progress';end if;
 update customer_login_challenges set attempts=attempts+1,lease=nonce,lease_expires_at=now()+interval '30 seconds' where id=c.id;
 return jsonb_build_object('email',c.email,'lease',nonce);
end $$;
create function public.customer_finish_verification(p_challenge uuid,p_lease uuid) returns void language sql security definer set search_path=public as $$
 update customer_login_challenges set lease=null,lease_expires_at=null where id=p_challenge and lease=p_lease;
$$;
create function public.customer_complete_login(p_challenge uuid,p_lease uuid,p_user uuid,p_token_hash text) returns void language plpgsql security definer set search_path=public as $$
declare c customer_login_challenges%rowtype; mail text;
begin
 select * into c from customer_login_challenges where id=p_challenge for update;
 if not found or c.used_at is not null or c.expires_at<=now() or c.lease is distinct from p_lease or c.lease_expires_at<=now() then raise exception 'Sign-in challenge expired';end if;
 select lower(btrim(email)) into mail from auth.users where id=p_user and email_confirmed_at is not null and (banned_until is null or banned_until<=now());
 if mail is null or mail<>c.email then raise exception 'Verified email does not match';end if;
 perform customer_claim_orders(p_user);
 insert into customer_sessions(token_hash,user_id,email) values(p_token_hash,p_user,mail);
 update customer_login_challenges set used_at=now(),lease=null,lease_expires_at=null where id=c.id;
end $$;
create function public.customer_read_session(p_hash text) returns jsonb language plpgsql security definer set search_path=public as $$
declare s customer_sessions%rowtype;
begin
 update customer_sessions cs set last_seen_at=now() from auth.users u
  where cs.token_hash=p_hash and cs.expires_at>now() and cs.last_seen_at>now()-interval '24 hours'
   and u.id=cs.user_id and u.email_confirmed_at is not null and lower(btrim(u.email))=cs.email
   and (u.banned_until is null or u.banned_until<=now()) returning cs.* into s;
 if not found then return null;end if;
 return jsonb_build_object('user_id',s.user_id,'email',s.email);
end $$;
revoke all on function public.customer_claim_orders(uuid),public.customer_begin_login(text,text),public.customer_reserve_verification(uuid),public.customer_finish_verification(uuid,uuid),public.customer_complete_login(uuid,uuid,uuid,text),public.customer_read_session(text) from public,anon,authenticated;
grant execute on function public.customer_claim_orders(uuid),public.customer_begin_login(text,text),public.customer_reserve_verification(uuid),public.customer_finish_verification(uuid,uuid),public.customer_complete_login(uuid,uuid,uuid,text),public.customer_read_session(text) to service_role;
