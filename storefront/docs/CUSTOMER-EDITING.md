# Admin customer editing

Open **Customers → a customer → Edit details** to change email, name, phone or address. Optional details can be cleared. Names appear in customer search, the customer list and exports. Name, phone and address are customer profile details; existing order names and delivery addresses remain historical snapshots.

Email changes move the customer's operational records together in one transaction. Another customer's email cannot be used, and a stale editor cannot overwrite a newer save. Notes, tags, paid-order totals, pauses and marketing suppression follow the customer. Previous audit records and actual delivered-email recipients remain recorded. Original recovery captures stay immutable and retain a separate association to the current customer.

An email change ends active cart recovery and invalidates existing confirmation/recovery links. Previously sent unsubscribe links continue to work. Queued messages that have not reached the provider use the corrected address. If a message is sending or has an unresolved provider attempt, the save explains that delivery must be reconciled in **Automation** first. Concurrent customer activity may require retrying the save. Failed saves keep the form draft.

## Release

Apply `20260914100000_customer_details.sql` using the established [migration procedure](MIGRATIONS.md), then release the application. The migration adds profile fields, actual delivery recipient metadata, and a current-customer reference on recovery episodes; it also updates the service-only save operation and admin projections. Existing profiles fall back to the latest order's contact details until first edited. No migration or customer changes are applied to a hosted database by the test commands.

## Verification

- `npm test` covers validation, authorization, stale saves, collisions, rollback, email reversal, historical recipients and form drafts.
- `npm run test:postgres` applies the full migration chain to disposable PostgreSQL, checks concurrent edits/delivery claims and old unsubscribe links, and verifies backup restoration.
- `npm run test:browser -- tests/browser/customers.spec.ts` checks editing, failure recovery, accessibility and overflow at 320px, 390px and desktop widths using synthetic data.
- Local visual fixture: `/frame.html?page=customer-admin&bare=1` with `npm run preview:audit`.
