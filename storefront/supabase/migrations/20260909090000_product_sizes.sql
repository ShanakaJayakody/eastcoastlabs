-- Each size reuses an independent, fully audited SKU/stock pool. The parent is
-- the public product and also the original size, preserving existing carts.
alter table public.products
  add column size_parent_id uuid references public.products(id),
  add column size_label text,
  add column size_enabled boolean not null default true;
alter table public.product_variants add column size_previous_active boolean;
alter table public.products add constraint product_size_label_valid check (
  (size_label is null and size_parent_id is null) or
  (size_label is not null and length(btrim(size_label)) between 1 and 40)
);
create index products_size_parent on public.products(size_parent_id);
create unique index products_size_label_unique on public.products
  (coalesce(size_parent_id,id), lower(regexp_replace(size_label,'\s','','g')))
  where size_label is not null;

create function public.guard_product_size() returns trigger
language plpgsql set search_path=public as $$
declare parent products%rowtype;
begin
  if tg_op='UPDATE' and new.size_parent_id is distinct from old.size_parent_id then
    raise exception 'A size cannot be moved to another product';
  end if;
  if new.size_parent_id is null then return new; end if;
  select * into parent from products where id=new.size_parent_id;
  if not found or parent.size_parent_id is not null or parent.id=new.id or parent.size_label is null then
    raise exception 'A size must belong to a labelled parent product';
  end if;
  new.name:=parent.name;
  new.status:=case when parent.status='active' and not new.size_enabled then 'draft' else parent.status end;
  new.images:=parent.images;
  new.short_description:=parent.short_description;
  new.description:=parent.description;
  new.categories:=parent.categories;
  new.compound:=parent.compound;
  return new;
end $$;
create trigger guard_product_size before insert or update on public.products
  for each row execute function public.guard_product_size();

create function public.sync_product_sizes() returns trigger
language plpgsql set search_path=public as $$
begin
  if new.size_parent_id is null and
    (new.name,new.status,new.images,new.short_description,new.description,new.categories,new.compound)
    is distinct from (old.name,old.status,old.images,old.short_description,old.description,old.categories,old.compound) then
    update products set name=new.name,status=new.status,images=new.images,
      short_description=new.short_description,description=new.description,
      categories=new.categories,compound=new.compound,updated_at=now()
      where size_parent_id=new.id;
  end if;
  return new;
end $$;
create trigger sync_product_sizes after update on public.products
  for each row execute function public.sync_product_sizes();

create function public.admin_add_product_size(p_slug text,p_input jsonb,p_actor text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare parent products%rowtype; child_id uuid:=gen_random_uuid(); child_slug text;
  label text:=btrim(p_input->>'label'); current_label text:=btrim(p_input->>'currentLabel');
  stock numeric:=coalesce((p_input->>'initialStock')::numeric,0); tier jsonb; labelled_tiers jsonb;
begin
  if coalesce(length(btrim(p_actor)),0) not between 1 and 320 or coalesce(length(label),0) not between 1 and 40 or stock<>trunc(stock) or stock not between 0 and 1000000 then raise exception 'Enter a size label and valid whole opening stock'; end if;
  select * into parent from products where slug=p_slug for update;
  if not found or parent.size_parent_id is not null then raise exception 'Parent product not found'; end if;
  if not exists(select 1 from product_variants where product_id=parent.id and pack_size=1) then raise exception 'Create the original size pricing first'; end if;
  if parent.size_label is null then
    if coalesce(length(current_label),0) not between 1 and 40 then raise exception 'Enter the current size first'; end if;
    update products set size_label=current_label where id=parent.id;
    parent.size_label:=current_label;
    update product_variants set label=split_part(product_variants.label,' · ',1)||' · '||current_label where product_id=parent.id;
  end if;
  if exists(select 1 from products where (id=parent.id or size_parent_id=parent.id)
    and lower(regexp_replace(size_label,'\s','','g'))=lower(regexp_replace(label,'\s','','g'))) then raise exception 'This size already exists'; end if;
  if (select count(*) from products where size_parent_id=parent.id)>=19 then raise exception 'A product can have up to 20 sizes'; end if;
  -- Immutable generated identities let labels change without orphaning carts.
  child_slug:=left(parent.slug,70)||'-size-'||replace(child_id::text,'-','');
  insert into products(id,slug,sku,name,status,size_parent_id,size_label)
    values(child_id,child_slug,'ECL-SIZE-'||replace(child_id::text,'-',''),parent.name,parent.status,parent.id,label);
  select jsonb_agg(value||jsonb_build_object('label',(value->>'label')||' · '||label)) into labelled_tiers from jsonb_array_elements(p_input->'variants');
  perform admin_product_tiers(child_id,'ECL-SIZE-'||replace(child_id::text,'-',''),labelled_tiers,stock::int,p_actor);
  update products set edit_version=edit_version+1 where id=parent.id;
  insert into admin_audit_log(actor_email,action,entity_type,entity_id,diff)
    values(p_actor,'product.size.add','product',parent.id::text,jsonb_build_object('size_id',child_id,'label',label,'opening_stock',stock));
  return jsonb_build_object('slug',child_slug);
end $$;

create function public.admin_save_product_size(p_parent_slug text,p_size_id uuid,p_label text,p_enabled boolean,p_variants jsonb,p_version bigint,p_actor text) returns bigint
language plpgsql security definer set search_path=public as $$
declare parent products%rowtype; child products%rowtype; result bigint;
begin
  if coalesce(length(btrim(p_actor)),0) not between 1 and 320 or coalesce(length(btrim(p_label)),0) not between 1 and 40 or p_enabled is null then raise exception 'Enter a valid size label'; end if;
  select * into parent from products where slug=p_parent_slug for update;
  if not found or parent.size_parent_id is not null then raise exception 'Parent product not found'; end if;
  select * into child from products where id=p_size_id and (id=parent.id or size_parent_id=parent.id) for update;
  if not found then raise exception 'Size does not belong to this product'; end if;
  if exists(select 1 from products where (id=parent.id or size_parent_id=parent.id) and id<>child.id
    and lower(regexp_replace(size_label,'\s','','g'))=lower(regexp_replace(p_label,'\s','','g'))) then raise exception 'This size already exists'; end if;
  perform admin_save_product(child.slug,'{}',p_variants,p_version,p_actor);
  update products set size_label=btrim(p_label),size_enabled=p_enabled,updated_at=now() where id=child.id;
  update product_variants set label=split_part(label,' · ',1)||' · '||btrim(p_label) where product_id=child.id;
  if child.size_enabled is distinct from p_enabled then
    if p_enabled then
      update product_variants set active=coalesce(size_previous_active,active),size_previous_active=null where product_id=child.id;
    else
      update product_variants set size_previous_active=active,active=false where product_id=child.id;
    end if;
  end if;
  select edit_version into result from products where id=child.id;
  insert into admin_audit_log(actor_email,action,entity_type,entity_id,diff)
    values(p_actor,'product.size.save','product',parent.id::text,jsonb_build_object('size_id',child.id,'label',p_label,'enabled',p_enabled));
  return result;
end $$;

create function public.admin_create_sized_product(p_input jsonb,p_actor text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare created jsonb; v_label text:=btrim(p_input->>'sizeLabel');
begin
  if coalesce(length(v_label),0) not between 1 and 40 then raise exception 'Enter a size label (maximum 40 characters)'; end if;
  created:=admin_create_product(p_input,p_actor);
  update products set size_label=v_label where slug=created->>'slug';
  update product_variants set label=split_part(product_variants.label,' · ',1)||' · '||v_label
    where product_id=(select id from products where slug=created->>'slug');
  return created;
end $$;

revoke all on function public.guard_product_size(),public.sync_product_sizes() from public,anon,authenticated,service_role;
revoke all on function public.admin_create_sized_product(jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_create_sized_product(jsonb,text) to service_role;

create function public.admin_duplicate_product_sizes(p_slug text,p_actor text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare original products%rowtype; source_size products%rowtype; tier_rows jsonb;
  created jsonb; child jsonb; copied_id uuid; copied_slug text;
begin
  select * into original from products where slug=p_slug for update;
  if not found or original.size_parent_id is not null or original.size_label is null then raise exception 'Sized product not found'; end if;
  for source_size in select * from products where id=original.id or size_parent_id=original.id
    order by (id=original.id) desc,created_at,id for share loop
    select jsonb_agg(jsonb_build_object('pack_size',v.pack_size,'label',split_part(v.label,' · ',1),'price_cents',v.price_cents) order by v.position,v.pack_size)
      into tier_rows from product_variants v where v.product_id=source_size.id;
    if source_size.id=original.id then
      created:=admin_create_sized_product(jsonb_build_object('name',left(original.name,293)||' (copy)',
        'slug',left(original.slug,110)||'-copy','sku',left(coalesce(original.sku,'ECL-COPY'),90)||'-COPY',
        'compound',original.compound,'short_description',original.short_description,'description',original.description,
        'status','draft','sizeLabel',original.size_label,'variants',tier_rows,'initialStock',0),p_actor);
      copied_slug:=created->>'slug';
    else
      child:=admin_add_product_size(created->>'slug',jsonb_build_object('label',source_size.size_label,'variants',tier_rows,'initialStock',0),p_actor);
      copied_slug:=child->>'slug';
    end if;
    update products set images=original.images,categories=original.categories,size_enabled=source_size.size_enabled
      where slug=copied_slug returning id into copied_id;
    update product_variants dest set active=src.active,size_previous_active=src.size_previous_active
      from product_variants src where src.product_id=source_size.id and dest.product_id=copied_id and dest.pack_size=src.pack_size;
  end loop;
  insert into admin_audit_log(actor_email,action,entity_type,entity_id,diff)
    values(p_actor,'product.duplicate','product',created->>'slug',jsonb_build_object('from',p_slug,'includes_sizes',true));
  return created;
end $$;
revoke all on function public.admin_duplicate_product_sizes(text,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_duplicate_product_sizes(text,text) to service_role;
revoke all on function public.admin_add_product_size(text,jsonb,text),public.admin_save_product_size(text,uuid,text,boolean,jsonb,bigint,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_add_product_size(text,jsonb,text),public.admin_save_product_size(text,uuid,text,boolean,jsonb,bigint,text) to service_role;

-- Keep physical stock choices distinct without changing compound matching.
create or replace function public.admin_lot_catalog() returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('pools',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'name',p.name,'sizeLabel',p.size_label,'onHand',inv.on_hand) order by p.name,v.id) from product_variants v join products p on p.id=v.product_id join inventory inv on inv.variant_id=v.id where v.pack_size=1 or not exists(select 1 from product_variants s where s.product_id=v.product_id and s.pack_size=1)),'[]'::jsonb),
 'lots',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'poolId',l.pool_variant_id,'code',l.lot_code,'units',l.units,'availableUnits',l.units-coalesce((select sum(units) from order_lot_allocations where lot_id=l.id),0),'receiptId',l.receipt_id,'coaId',l.coa_id) order by l.lot_code) from stock_lots l),'[]'::jsonb),
 'receipts',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'poolId',s.variant_id,'units',s.qty,'createdAt',s.created_at) order by s.created_at desc) from stock_movements s where s.reason='received' and s.qty>0 and not exists(select 1 from stock_movements r where r.reverses_receipt_id=s.id)),'[]'::jsonb),
 'certificates',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'batchId',c.batch_id,'compound',c.compound) order by c.batch_id) from coa_batches c where c.document_verified_at is not null and nullif(btrim(c.coa_url),'') is not null),'[]'::jsonb));
$$;
