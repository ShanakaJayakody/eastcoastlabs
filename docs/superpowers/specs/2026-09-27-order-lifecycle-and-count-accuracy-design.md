# Order lifecycle and count accuracy design

## Goal

Make the admin order-status badges faithfully represent the active filter scope, restore the daily lifecycle job, and reconcile the 46 overdue shipped orders through the existing auditable transition path.

## Constraints

- Preserve the user's unrelated working-tree changes and work directly on `main` as requested.
- Do not run the full lifecycle route manually: it can enqueue eligible marketing emails.
- Apply the database change before deploying application code that depends on it.
- Do not update order rows directly. Recovery must call `commerce_order_operation` so every status change produces normal order events and audit records.
- Use the production Supabase MCP only for aggregate verification, the backward-compatible function migration, and the explicit completion-only recovery.

## Design

The lifecycle failure is caused by querying the JSONB `products.categories` field with a JavaScript array, which reaches PostgreSQL as a PostgreSQL array literal instead of valid JSON. The app will pass the JSON string `"[\"accessory\"]"` to Supabase's JSONB containment operator. A regression test will assert the exact query argument.

The Orders page will obtain tab badges from a new read-only PostgreSQL function, `admin_order_status_counts`. It accepts the same normalized search, Sydney-date bounds, and case-insensitive discount filter as `listOrders`, then performs one grouped database query. The page will pass its active scope to that function, allowing each tab to retain its filter and display a matching count. `All` and `To fulfil` remain deterministic sums of the database groups.

After local tests and the production migration, the application is deployed from `main`. A completion-only production recovery will select only current `shipped` orders with `shipped_at` older than ten days and invoke `commerce_order_operation(..., 'completed', ...)` for each. Post-recovery verification confirms the status totals, zero data-integrity anomalies, and one event/audit transition per recovered order.

## Success criteria

- The lifecycle JSONB category lookup no longer emits `invalid input syntax for type json`.
- Status badges use the active search/date/discount scope and a single grouped database read.
- The deployed database has the RPC and the deployed app can call it.
- The 46 audited overdue shipments are completed without sending lifecycle marketing mail.
- Post-release aggregates have no invalid status, timestamp, refund, or status-event consistency anomalies.
