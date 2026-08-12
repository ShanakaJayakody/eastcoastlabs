-- East Coast Labs — update support contact email.
-- The 20260725110000_settings.sql seed used ON CONFLICT DO NOTHING, so the
-- live row still holds the old support@eastcoastlabs.com.au value. Overwrite it.

update public.settings
set value = '"eclpeptides@gmail.com"'::jsonb,
    updated_at = now(),
    updated_by = 'migration:20260812000000_support_email_update'
where key = 'support_email';
