-- Immutable presentation facts, captured before commerce emits notification intent.
alter table public.order_items
 add column image_url_snapshot text,
 add column email_image_url_snapshot text,
 add column image_alt_snapshot text,
 add column size_label_snapshot text;
alter table public.orders add column order_access_version integer not null default 1 check(order_access_version>0);
alter table public.orders add column carrier_code text check(carrier_code in ('auspost','dhl','fedex','ups','sendle'));

create function public.snapshot_order_item_media() returns trigger language plpgsql set search_path=public as $$
declare p products%rowtype;
begin
 if tg_op='UPDATE' and new.product_slug is not distinct from old.product_slug and new.variant_id is not distinct from old.variant_id then
  new.image_url_snapshot:=old.image_url_snapshot;new.email_image_url_snapshot:=old.email_image_url_snapshot;
  new.image_alt_snapshot:=old.image_alt_snapshot;new.size_label_snapshot:=old.size_label_snapshot;return new;
 end if;
 if new.variant_id is not null then
  select pr.* into p from products pr join product_variants v on v.product_id=pr.id where v.id=new.variant_id;
 else select * into p from products where slug=new.product_slug;end if;
 new.image_url_snapshot:=p.images->0->>'src';
 new.email_image_url_snapshot:=coalesce(p.images->0->>'email_src',case when (p.images->0->>'src')~*'\.(png|jpe?g)$' then p.images->0->>'src' end);
 new.image_alt_snapshot:=coalesce(nullif(p.images->0->>'alt',''),p.name,new.product_name);
 new.size_label_snapshot:=p.size_label;
 return new;
end $$;
create trigger snapshot_order_item_media before insert or update on public.order_items for each row execute function public.snapshot_order_item_media();

create function public.customer_order_summary(p_order uuid) returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('order_id',o.id,'order_number',o.order_number,'access_version',o.order_access_version,
  'created_at',o.created_at,'status',o.status,'carrier_code',o.carrier_code,'tracking_number',o.tracking_number,
  'subtotal_cents',o.subtotal_cents,'discount_cents',o.discount_cents,'shipping_cents',o.shipping_cents,
  'total_cents',o.total_cents,'refunded_cents',o.refunded_cents,'currency',o.currency,
  'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'name',i.product_name,'variant_label',i.variant_label,
    'size_label',i.size_label_snapshot,'qty',i.qty,'refunded_qty',i.refunded_qty,
    'line_total_cents',i.line_total_cents,'discount_cents',i.discount_allocated_cents,
    'image_url',i.email_image_url_snapshot,'image_alt',i.image_alt_snapshot,
    'is_gift',coalesce(i.variant_label ilike '%free gift%',false)) order by i.id)
    from order_items i where i.order_id=o.id),'[]'::jsonb)) from orders o where o.id=p_order;
$$;
-- All transaction enqueue callers (including manual sends) receive the same safe snapshot.
-- This runs only for a new queue row; no sent or attempted provider body is rewritten.
create function public.attach_order_email_summary() returns trigger language plpgsql set search_path=public as $$
declare o orders%rowtype;
begin
 if new.template not in ('payment_instructions','payment_reminder','payment_expiring','payment_expired','order_confirmation','order_shipped','order_refunded') then return new;end if;
 new.payload:=coalesce(new.payload,'{}'::jsonb)-'order_summary_v1';
 if coalesce(new.payload->>'order_id','') !~ '^[0-9a-fA-F-]{36}$' then return new;end if;
 select * into o from orders where id::text=lower(new.payload->>'order_id') and lower(btrim(customer_email))=lower(btrim(new.to_email));
 if found then new.payload:=new.payload||jsonb_build_object('order_summary_v1',customer_order_summary(o.id));end if;
 return new;
end $$;
create trigger attach_order_email_summary before insert on public.email_outbox for each row execute function public.attach_order_email_summary();
revoke all on function public.snapshot_order_item_media(),public.customer_order_summary(uuid),public.attach_order_email_summary() from public,anon,authenticated;
grant execute on function public.customer_order_summary(uuid) to service_role;
