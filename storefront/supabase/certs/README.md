# Supabase database trust anchor

`supabase-prod-ca-2021.crt` is the public Supabase production CA, downloaded over verified HTTPS on 8 September 2026 from the URL published in [Supabase Studio's source configuration](https://github.com/supabase/supabase/blob/0e35cbf4a46eafe62a95d74fb7224fcc2e0050a9/apps/studio/hooks/custom-content/custom-content.json):

`https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`

SHA-256 certificate fingerprint: `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.

Validity: 28 April 2021 to 26 April 2031. This is a public trust certificate, not a private key or credential. It is scoped to the migration connection via `SUPABASE_DB_CA_FILE`; it does not alter OS or browser trust. The migration runner still verifies certificate chains and database hostname. Do not use it to disable TLS verification.

From `storefront/`, set `SUPABASE_DB_CA_FILE` to the absolute path of this file before the documented dry run/apply commands. Follow [Supabase's SSL guidance](https://supabase.com/docs/guides/platform/ssl-enforcement) and review a replacement fingerprint when Supabase rotates this CA. Other database hosts may require their own trusted CA.
