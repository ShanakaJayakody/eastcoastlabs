-- SS-31 was seeded as a 10mg coming-soon product, then activated with that
-- placeholder identity intact. The stocked vial is 50mg.
update public.products
set
  sku = 'ECL-SS31-50',
  images = case
    when jsonb_typeof(images) = 'array' and jsonb_array_length(images) > 0
      then jsonb_set(
        images,
        '{0,alt}',
        to_jsonb('SS-31 50mg research peptide vial – East Coast Labs Australia'::text),
        true
      )
    else images
  end,
  updated_at = now()
where slug = 'ss-31'
  and (
    sku is distinct from 'ECL-SS31-50'
    or (
      jsonb_typeof(images) = 'array'
      and jsonb_array_length(images) > 0
      and images->0->>'alt' is distinct from 'SS-31 50mg research peptide vial – East Coast Labs Australia'
    )
  );
