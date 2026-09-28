# ECLLEGACY production release record

This is the permanent, sanitized record for the one-time `ECLLEGACY` production activation prepared on 28 September 2026. It preserves the reviewed source identity, production-state evidence, exception boundaries, and required closeout fields without customer addresses, credentials, or individual order data.

The activation and matching application deployment had **not occurred at preparation**. Do not infer their current status from that historical statement. The operator must post the dated activation/application closeout on [PR #26](https://github.com/ShanakaJayakody/eastcoastlabs/pull/26); that comment is the durable operational outcome for this prepared release.

## Exact reviewed inputs

| Purpose | File | SHA-256 |
| --- | --- | --- |
| Already-applied predecessor; metadata reconciliation only | `20260927120000_order_status_counts.sql` | `66dab3af1846c189671ec772cb9376117c6aef51bdf035e050b2fb1d9405162c` |
| Already-applied predecessor; metadata reconciliation only | `20260927130000_fulfilment_analytics.sql` | `5197198b39e4ab06a423e77364a2ed9d0a1df2ab90dd52bed77221715bce3509` |
| Production capture migration | `20260928100000_legacy_pricing.sql` | `6d70ead2d4423dcad893353ac7a65b5c2dccc191b90026381d0f8328a3f00090` |
| Generated single-statement MCP activation envelope | local prepared artifact | `17aedf38acf42cdd22963feb4cbf63481a9d092c91eb27a6499487fcdfc89be2` |

The envelope hash identifies the reviewed generated transport artifact; the artifact itself is not the normal migration interface and is deliberately not tracked as a reusable migration. If the migration bytes or any verified production precondition changes before activation, stop, regenerate the envelope, repeat its rollback/success/replay checks and review, and record the newly reviewed hashes. Never use an internally consistent older envelope against changed release source.

## Verified preparation evidence

The final read-only production preflight at `2026-09-28T10:37Z` observed:

- the intended project and a 42-row ECL migration ledger whose ordered contents matched the release checkout; the observed ledger MD5 was `a6b90dd73184572313c315a58dc422cd`;
- both predecessor features already present, with their function bodies, signatures, configuration, ACLs, volatility, and indexes matching the reviewed local sources, but without the two ECL ledger rows listed above;
- no `ECLLEGACY` discount or legacy snapshot tables;
- 63 active variants, aggregate active price `1739579` cents, catalogue ID/price MD5 `343c4282eb66ec797efa6675ee1506f6`, and 120 qualifying normalized customer emails; and
- no production mutation, activation, application deployment, customer-address output, or individual-order output.

These observations are preparation-time evidence, not a substitute for the immediate pre-activation recheck or the closeout evidence below. Counts and catalogue state can change while production remains live.

## One-time reconciliation boundary

For only the production state described above, the reviewed envelope may insert ledger metadata for the two exact allowlisted predecessors and then execute the exact legacy migration in one outer `DO` statement. It must never execute either predecessor SQL file. The legacy migration and its non-baselined ledger row must commit in that same statement; any failure rolls back the two metadata rows, migration, and target ledger row together.

The reviewed envelope:

- takes the same migration advisory lock as the repository runner before locking the ledger, with a five-second local lock timeout;
- requires every existing ledger filename and SHA-256 to match the complete expected predecessor set;
- permits only the two exact missing predecessor rows above, fails on unknown history or checksum mismatch, verifies the six audited live function-body hashes, and refuses a prior legacy activation;
- inserts only filename, SHA-256, and `baselined=true` metadata for those two predecessors; and
- checks the embedded legacy source SHA-256 before execution and records the target row with the same source hash and `baselined=false`.

This is not permission to replay predecessor DDL, baseline unknown history, repair a checksum mismatch, or use the envelope for another installation. After this one-time production reconciliation, all future migrations use the normal ledger-verifying runner. Do not replay or re-baseline this history.

The envelope guards recheck function bodies, but do not independently recheck signatures, ACLs, volatility, configuration, or index definitions. Those properties were verified by the read-only preflight and must still be rechecked immediately before activation. Local PGlite rollback/success/replay evidence did not independently exercise hosted transport limits or concurrent hosted PostgreSQL sessions. These are explicit limitations of the reviewed exception, not general schema-equivalence proof.

## Activation and application closeout

The operator must first follow [the ECLLEGACY operations runbook](./LEGACY-PRICING.md), including its aggregate-only verification and no-email-export rule. Do not begin any catalogue price increase until both the production snapshot and matching application deployment are verified.

After the attempt, post one dated closeout comment on [PR #26](https://github.com/ShanakaJayakody/eastcoastlabs/pull/26). Record failures as failures; do not complete successful fields from planned or inferred results. The comment must include:

- actual activation attempt timestamp in UTC and outcome, including whether the transaction committed or rolled back;
- target project identifier and exact released commit, without credentials;
- the post-attempt migration-ledger evidence: both predecessor rows with their exact SHA-256 and `baselined=true`, the target filename with its exact SHA-256 and `baselined=false`, plus the checksum/digest and method used for the complete observed ledger;
- aggregate capture integrity: `captured_variants`, `current_active_variants`, `eligible_customers`, the completion marker's captured variant/customer counts, and `pre_increase_price_mismatches`; at activation the variant counts must agree and the mismatch count must be zero;
- confirmation that `ECLLEGACY` is `kind='legacy_price'`, active, has zero minimum spend, and has null start, expiry, and usage-limit values;
- the required protected `verify` CI check name, outcome, and run URL for the exact merged/released revision;
- production application revision, deployment timestamp, and deployment URL;
- non-purchasing production smoke results for public checkout loading, a generic code still quoting normally, `ECLLEGACY` without email showing the approved guidance, and an email change invalidating the quote; confirm that no real order was submitted; and
- whether the later, separately reviewed catalogue-price release is authorized to proceed. It is not authorized if any required activation, integrity, CI, deployment, or smoke check is missing or failed.

Eligible-success purchase behavior remains a synthetic staging check. Do not place a production order or expose a customer address to complete the smoke test.
