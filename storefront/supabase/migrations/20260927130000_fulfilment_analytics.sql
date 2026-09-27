-- Read-only fulfilment history. No order/event writes, repairs or notifications.
create index if not exists orders_fulfilment_paid_idx on public.orders(paid_at,id) where paid_at is not null;
create index if not exists orders_fulfilment_shipped_idx on public.orders(shipped_at,id) where shipped_at is not null;

create function public.admin_fulfilment_facts(p_as_of timestamptz)
returns table(id uuid,order_number text,customer_name text,status text,created_at timestamptz,paid_at timestamptz,shipped_at timestamptz,
 payment_seconds double precision,fulfilment_seconds double precision,total_seconds double precision,
 payment_wait_seconds double precision,fulfilment_wait_seconds double precision,total_wait_seconds double precision,quality_issue boolean)
language sql stable security invoker set search_path=public set timezone='UTC' as $$
 select o.id,o.order_number,o.customer_name,o.status,o.created_at,o.paid_at,o.shipped_at,
  case when o.created_at<=o.paid_at and o.paid_at<=p_as_of then extract(epoch from(o.paid_at-o.created_at))::double precision end,
  case when o.created_at<=o.paid_at and o.paid_at<=o.shipped_at and o.shipped_at<=p_as_of then extract(epoch from(o.shipped_at-o.paid_at))::double precision end,
  case when o.created_at<=o.shipped_at and o.shipped_at<=p_as_of then extract(epoch from(o.shipped_at-o.created_at))::double precision end,
  case when o.status='pending' and o.paid_at is null and o.created_at<=p_as_of then extract(epoch from(p_as_of-o.created_at))::double precision end,
  case when o.status in ('paid','processing') and o.shipped_at is null and o.created_at<=o.paid_at and o.paid_at<=p_as_of then extract(epoch from(p_as_of-o.paid_at))::double precision end,
  case when o.status in ('pending','paid','processing') and o.shipped_at is null and o.created_at<=p_as_of then extract(epoch from(p_as_of-o.created_at))::double precision end,
  (o.created_at>p_as_of or coalesce(o.paid_at>p_as_of,false) or coalesce(o.shipped_at>p_as_of,false)
   or coalesce(o.paid_at<o.created_at,false) or coalesce(o.shipped_at<o.created_at,false) or coalesce(o.shipped_at<o.paid_at,false)
   or (o.paid_at is null and (o.shipped_at is not null or o.status in ('paid','processing','shipped','completed')))
   or (o.shipped_at is null and o.status in ('shipped','completed')))
 from public.orders o;
$$;

create function public.admin_fulfilment_stats(p_values double precision[]) returns jsonb
language sql immutable security invoker set search_path=public as $$
 select jsonb_build_object('n',count(v),'median',percentile_cont(0.5) within group(order by v),
 'mean',avg(v),'p90',percentile_cont(0.9) within group(order by v),'max',max(v)) from unnest(p_values) v where v is not null;
$$;

create function public.admin_fulfilment_summary(p_from timestamptz,p_to timestamptz,p_as_of timestamptz) returns jsonb
language sql stable security invoker set search_path=public set timezone='UTC' as $$
 with f as materialized(select *,paid_at>=p_from and paid_at<p_to and paid_at<=p_as_of paid_in,
   shipped_at>=p_from and shipped_at<p_to and shipped_at<=p_as_of shipped_in from public.admin_fulfilment_facts(p_as_of))
 select jsonb_build_object(
 'payment',public.admin_fulfilment_stats(array_agg(payment_seconds) filter(where paid_in)),
 'fulfilment',public.admin_fulfilment_stats(array_agg(fulfilment_seconds) filter(where shipped_in)),
 'total',public.admin_fulfilment_stats(array_agg(total_seconds) filter(where shipped_in)),
 'paid_count',count(*) filter(where paid_in),'shipped_count',count(*) filter(where shipped_in),
 'distribution',jsonb_build_array(
 count(*) filter(where shipped_in and fulfilment_seconds<=86400),
 count(*) filter(where shipped_in and fulfilment_seconds>86400 and fulfilment_seconds<=172800),
 count(*) filter(where shipped_in and fulfilment_seconds>172800 and fulfilment_seconds<=259200),
 count(*) filter(where shipped_in and fulfilment_seconds>259200))) from f;
$$;

create function public.admin_fulfilment_report(p_grain text default 'week',p_range text default 'all',p_from date default null,p_to date default null,p_as_of timestamptz default null)
returns jsonb language plpgsql stable security invoker set search_path=public set timezone='UTC' as $$
declare
 at_time timestamptz:=coalesce(p_as_of,now()); first_at timestamptz; from_day date; to_day date;
 start_time timestamptz; end_time timestamptz; local_now timestamp; bucket timestamp; bucket_end timestamp;
 bucket_start_at timestamptz; bucket_end_at timestamptz; step interval; partial text[];
 periods jsonb:='[]'; queues jsonb; quality jsonb; matched jsonb;
 current_start timestamp; previous_start timestamp; previous_end timestamp; previous_days int;
begin
 if p_grain is null or p_grain not in ('week','month') then raise exception 'Invalid fulfilment grain'; end if;
 if p_range is null or p_range not in ('all','12w','12m','custom') then raise exception 'Invalid fulfilment range'; end if;
 if at_time>now() or not isfinite(at_time) then raise exception 'Invalid report time';end if;
 if p_range='custom' and (p_from is null or p_to is null or p_from>p_to or not isfinite(p_from) or not isfinite(p_to)) then raise exception 'Invalid custom date range';end if;
 local_now:=at_time at time zone 'Australia/Sydney';
 select min(created_at) into first_at from orders where created_at<=at_time;
 from_day:=case p_range when 'custom' then p_from when '12w' then (date_trunc('week',local_now)-interval '11 weeks')::date
 when '12m' then (date_trunc('month',local_now)-interval '11 months')::date else coalesce((first_at at time zone 'Australia/Sydney')::date,local_now::date) end;
 -- Preserve requested bounds for drilldowns, including an empty future range.
 -- Only bucket generation is capped at the report day; facts exclude future events.
 to_day:=case when p_range='custom' then p_to else local_now::date end;
 start_time:=from_day::timestamp at time zone 'Australia/Sydney';
 end_time:=(to_day+1)::timestamp at time zone 'Australia/Sydney';
 step:=case p_grain when 'week' then interval '1 week' else interval '1 month' end;
 bucket:=date_trunc(p_grain,greatest(from_day::timestamp,(first_at at time zone 'Australia/Sydney')::date::timestamp));
 while first_at is not null and bucket<(least(to_day,local_now::date)+1)::timestamp and from_day<=local_now::date loop
  bucket_end:=bucket+step;
  bucket_start_at:=bucket at time zone 'Australia/Sydney'; bucket_end_at:=bucket_end at time zone 'Australia/Sydney';
  partial:='{}';
  if bucket_start_at<first_at then partial:=array_append(partial,'history');end if;
  if bucket_end_at>at_time then partial:=array_append(partial,'in_progress');end if;
  if bucket_start_at<start_time or (bucket_end_at>end_time and end_time<=at_time) then partial:=array_append(partial,'range');end if;
  periods:=periods||jsonb_build_array(public.admin_fulfilment_summary(greatest(bucket_start_at,start_time),least(bucket_end_at,end_time),at_time)||
   jsonb_build_object('key',bucket::date,'start_at',greatest(bucket_start_at,start_time),'end_at',least(bucket_end_at,end_time),
    'calendar_start',bucket_start_at,'calendar_end',bucket_end_at,'partial',to_jsonb(partial)));
  bucket:=bucket_end;
 end loop;
 select jsonb_build_object('paid',count(*) filter(where status in ('paid','processing') and shipped_at is null),
  'unpaid',count(*) filter(where status='pending' and paid_at is null and shipped_at is null)) into queues from orders where created_at<=at_time;
 select jsonb_build_object(
  'missing_payment',count(*) filter(where paid_at is null and (shipped_at is not null or status in ('paid','processing','shipped','completed'))),
  'missing_shipment',count(*) filter(where shipped_at is null and status in ('shipped','completed')),
  'invalid_payment',count(*) filter(where paid_at<created_at),
  'invalid_fulfilment',count(*) filter(where shipped_at<paid_at),
  'invalid_total',count(*) filter(where shipped_at<created_at),
  'future_timestamps',count(*) filter(where created_at>at_time or paid_at>at_time or shipped_at>at_time),
  'affected_orders',count(*) filter(where quality_issue)) into quality from public.admin_fulfilment_facts(at_time);
 current_start:=date_trunc(p_grain,local_now); previous_start:=current_start-step;
 if p_grain='week' then previous_end:=previous_start+(local_now-current_start);
 else
  previous_days:=extract(day from(current_start-interval '1 day'))::int;
  previous_end:=case when extract(day from local_now)>previous_days then current_start
   else previous_start+(extract(day from local_now)::int-1)*interval '1 day'+(local_now::time-time '00:00') end;
 end if;
 if first_at<=(previous_start at time zone 'Australia/Sydney') and start_time<=(current_start at time zone 'Australia/Sydney') and end_time>at_time then
  matched:=jsonb_build_object('current_start',current_start at time zone 'Australia/Sydney','current_end',at_time,
   'previous_start',previous_start at time zone 'Australia/Sydney','previous_end',previous_end at time zone 'Australia/Sydney','provisional',true,
   'current',public.admin_fulfilment_summary(current_start at time zone 'Australia/Sydney',at_time,at_time),
   'previous',public.admin_fulfilment_summary(previous_start at time zone 'Australia/Sydney',previous_end at time zone 'Australia/Sydney',at_time));
 end if;
 return jsonb_build_object('as_of',at_time,'first_order_at',first_at,'from',from_day,'to',to_day,'grain',p_grain,'range',p_range,
  'summary',public.admin_fulfilment_summary(start_time,end_time,at_time),'periods',periods,'queues',queues,'quality',quality,'matched',matched);
end $$;

create function public.admin_fulfilment_orders(p_view text default 'waiting',p_from date default null,p_to date default null,p_sort text default 'wait',p_dir text default 'desc',p_offset int default 0,p_limit int default 50,p_as_of timestamptz default null,p_metric text default null)
returns jsonb language plpgsql stable security invoker set search_path=public set timezone='UTC' as $$
declare at_time timestamptz:=coalesce(p_as_of,now());result jsonb;
begin
 if p_view is null or p_view not in ('waiting','unpaid','payments','shipments','quality') then raise exception 'Invalid order timing view';end if;
 if p_sort is null or p_sort not in ('wait','payment','fulfilment','total','milestone') then raise exception 'Invalid order timing sort';end if;
 if p_dir is null or p_dir not in ('asc','desc') then raise exception 'Invalid order timing direction';end if;
 if p_metric is not null and p_metric not in ('payment','fulfilment','total') then raise exception 'Invalid order timing metric';end if;
 if p_limit is null or p_limit<1 or p_limit>500 or p_offset is null or p_offset<0 then raise exception 'Invalid order timing pagination';end if;
 if at_time>now() or not isfinite(at_time) then raise exception 'Invalid report time';end if;
 if p_from>p_to or not coalesce(isfinite(p_from),true) or not coalesce(isfinite(p_to),true) then raise exception 'Invalid order timing range';end if;
 with filtered as materialized(
  select f.*,case p_sort
   when 'payment' then coalesce(payment_seconds,payment_wait_seconds)
   when 'fulfilment' then coalesce(fulfilment_seconds,fulfilment_wait_seconds)
   when 'total' then coalesce(total_seconds,total_wait_seconds)
   when 'milestone' then extract(epoch from(case p_view when 'payments' then paid_at when 'shipments' then shipped_at when 'waiting' then paid_at else created_at end))::double precision
   else case when p_view='unpaid' then payment_wait_seconds else fulfilment_wait_seconds end end as sort_value
  from public.admin_fulfilment_facts(at_time) f
  where case p_view
   when 'waiting' then status in ('paid','processing') and shipped_at is null and created_at<=at_time
   when 'unpaid' then status='pending' and paid_at is null and shipped_at is null and created_at<=at_time
   when 'payments' then paid_at is not null and paid_at<=at_time
   when 'shipments' then shipped_at is not null and shipped_at<=at_time
   else quality_issue end
  and (p_view in ('waiting','unpaid','quality') or (
   (p_from is null or (case p_view when 'payments' then paid_at else shipped_at end)>=p_from::timestamp at time zone 'Australia/Sydney')
   and (p_to is null or (case p_view when 'payments' then paid_at else shipped_at end)<(p_to+1)::timestamp at time zone 'Australia/Sydney')))
  and (p_metric is null or case p_metric when 'payment' then payment_seconds is not null when 'fulfilment' then fulfilment_seconds is not null else total_seconds is not null end)
 ), paged as (
  select * from filtered order by case when p_dir='asc' then sort_value end asc nulls last,
   case when p_dir='desc' then sort_value end desc nulls last,id asc limit p_limit offset p_offset
 ) select jsonb_build_object('as_of',at_time,'total',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(to_jsonb(p)-'sort_value') from paged p),'[]'::jsonb)) into result;
 return result;
end $$;

revoke all on function public.admin_fulfilment_facts(timestamptz),public.admin_fulfilment_stats(double precision[]),public.admin_fulfilment_summary(timestamptz,timestamptz,timestamptz),public.admin_fulfilment_report(text,text,date,date,timestamptz),public.admin_fulfilment_orders(text,date,date,text,text,int,int,timestamptz,text) from public,anon,authenticated;
grant execute on function public.admin_fulfilment_facts(timestamptz),public.admin_fulfilment_stats(double precision[]),public.admin_fulfilment_summary(timestamptz,timestamptz,timestamptz),public.admin_fulfilment_report(text,text,date,date,timestamptz),public.admin_fulfilment_orders(text,date,date,text,text,int,int,timestamptz,text) to service_role;
