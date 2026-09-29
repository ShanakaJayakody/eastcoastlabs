-- Size children inherit their parent's gallery. Require per-image provenance
-- before snapshotting a child; absent verified artwork has a neutral fallback.
create or replace function public.snapshot_order_item_media() returns trigger language plpgsql set search_path=public as $$
declare p products%rowtype; media jsonb;
begin
 if tg_op='UPDATE' and new.product_slug is not distinct from old.product_slug and new.variant_id is not distinct from old.variant_id then
  new.image_url_snapshot:=old.image_url_snapshot;new.email_image_url_snapshot:=old.email_image_url_snapshot;
  new.image_alt_snapshot:=old.image_alt_snapshot;new.size_label_snapshot:=old.size_label_snapshot;return new;
 end if;
 if new.variant_id is not null then
  select pr.* into p from products pr join product_variants v on v.product_id=pr.id where v.id=new.variant_id;
 else select * into p from products where slug=new.product_slug;end if;
 if p.size_label is not null and jsonb_typeof(p.images)='array' then
  select value into media from jsonb_array_elements(p.images)
   where lower(regexp_replace(value->>'size_label','\s','','g'))=lower(regexp_replace(p.size_label,'\s','','g')) limit 1;
 end if;
 if media is null and p.size_parent_id is null and nullif(p.images->0->>'size_label','') is null then media:=p.images->0;end if;
 new.image_url_snapshot:=media->>'src';
 new.email_image_url_snapshot:=coalesce(media->>'email_src',case when (media->>'src')~*'\.(png|jpe?g)$' then media->>'src' end);
 new.image_alt_snapshot:=coalesce(nullif(media->>'alt',''),p.name,new.product_name);
 new.size_label_snapshot:=p.size_label;
 return new;
end $$;
revoke all on function public.snapshot_order_item_media() from public,anon,authenticated;
