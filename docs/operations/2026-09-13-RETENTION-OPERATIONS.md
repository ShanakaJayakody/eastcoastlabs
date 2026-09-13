# Retention configuration and readout

No reminders, campaigns or provider settings were activated in implementation. No real emails were sent. Transactional confirmations, payment and dispatch notices remain outside the marketing holdout.

## Explicit reorder timing

`REORDER_REMINDER_DAYS` is a server-only deployment setting. Absent, blank, fractional, nonnumeric, zero or values above 365 disable the reorder reminder. An integer from 1 to 365 defines days after dispatch, with an existing 42-day eligibility window. Use measured reorder intervals or an operator-selected policy, and record the basis before changing deployment configuration. It is not a consumption estimate, prescribed usage schedule, delivery promise or default derived from pack size.

The sweep, customer sequence prediction, manual send gate and delivery worker use that same policy. The customer card explicitly says disabled when no valid timing exists. Enabled cards show configured days. No new public endpoint or settings API was added; existing per-customer sequence overrides support pauses only and do not pretend to hold buyer-specific timing preferences.

Purchase nudges respect unsubscribe, active consent, operator pause and existing database authorization. Reordering requires the latest fulfilled order, no partial/full refund and no newer noncancelled order. At delivery, a newer or unpaid/unfulfilled/refunded latest order suppresses purchase nudges. Operators must pause the appropriate marketing sequences for unresolved problems; no structured support-case resolution field exists to automate that judgment. Transactional notices continue under their existing order-state rules.

Reorder links use purchased catalogue slugs only after the existing stock-aware availability RPC confirms that SKU is purchasable. They link to the product for deliberate selection; quantities are never added or orders created automatically. Availability is checked when content is built and may change later. When no suitable link exists the template provides the catalogue. The reminder does not assume depletion or advertise an unverified coupon.

Old queued reorder intents with no explicit timing snapshot, or a timing snapshot that differs from current configuration, are cancelled. Existing dedupe identities remain unchanged: cancellation does not create a fresh automatic message for the same order. Previously frozen email bodies keep their delivery identity; ambiguous provider retries are not rewritten. Review/arrival copy rendered after release uses dispatch facts and asks whether the order arrived, without asserting delivery from an elapsed-day threshold. Administrative `completed` status still does not constitute carrier delivery evidence.

## Optional retention holdout

The holdout defaults off (`RETENTION_HOLDOUT_PERCENT` absent/blank/0). It applies only to reorder, winback 60/90 and second-purchase nudges. It excludes payment/dispatch/refund notices, reviews, arrival check-ins, welcome, stock alerts and cart recovery.

Activation requires all three server-only values:

| Setting | Constraint |
| --- | --- |
| `RETENTION_HOLDOUT_PERCENT` | Integer 1–100; default 0 |
| `RETENTION_EXPERIMENT_ID` | Stable ID, 1–80 letters, digits, hyphens or underscores |
| `RETENTION_HOLDOUT_KEY` | Secret HMAC key at least 24 characters; managed as a secret |

Invalid active configuration fails closed. Keep the ID, key and percentage fixed for an experiment. A server HMAC of experiment ID and normalized email selects a stable bucket across the included flows. The key and input email are not included in assignment metadata. The existing outbox already stores its authorized recipient identity.

Every newly queued applicable intent stores `payload.retention_experiment` with ID, arm, bucket and percentage alongside its immutable dedupe identity and `created_at`. Callers cannot inject an alternate assignment through the payload. Existing outbox rows retain their original assignment; changing config never rewrites historical intent or revives cancelled control messages. Old intents with no experiment metadata are outside the experiment.

At delivery, a control intent undergoes current source-order and read-only database eligibility checks. Eligible controls finish as `cancelled` with `error = 'Retention holdout: <ID>'`, without a provider call or `provider_attempted_at`. Consent/pauses/order ineligibility retain their actual reason. Treatment messages still pass the normal final delivery authorization and provider idempotency process. Provider failures remain failures, not successful exposure.

## Readout and remaining measurement work

Use one normalized customer per assignment cohort, not one outbox row per person. Preserve the experiment ID, fixed configuration, eligibility rules and assignment window. The durable outbox records candidate assignment (created_at), eligible control cancellation reason, treatment attempts, provider-accepted sends and source-order identities where available. This is enough to reconstruct candidate and delivery populations without inventing a marketing exposure.

The admin customer card exposes configured assignment context, but no experiment result dashboard is fabricated. A readout must explicitly distinguish assigned treatment, successful provider acceptance and ineligible/suppressed candidates. Use a predeclared intention-to-treat analysis and investigate eligibility exclusions symmetrically; comparing only delivered treatment with all controls introduces bias. The system has no universal completed-at timestamp for control eligibility decisions, so created_at is the assignment timestamp, not a claimed provider exposure time. A formal experimentation event ledger would be needed for more precise per-decision timing.

Join paid customer orders and actual-cost contribution to the assignment cohort, allowing seven-day transfer lag and mature 60/90-day purchase horizons. Separate assignment, attempts, acceptance, refunds and actual contribution coverage. Other marketing channels and excluded sequences remain potential contamination and must be documented. A held-out reminder does not mean the customer had no other marketing exposure. No uplift, statistical significance or incremental profit is claimed by this release.

Supplier data, reorder research, consent coverage, actual cost data, support pauses, experiment sample-size decisions and elapsed follow-up remain operational inputs. No new marketing vendor is required.
