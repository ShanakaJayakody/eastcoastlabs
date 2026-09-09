# Required creator application details — 9 September 2026

The owner requested three changes to the published guided application: a written answer when selecting Other for content focus, a required numeric audience size, and a required phone number. GPT-5.5 implements the interface and data changes; the existing authorisation to commit and publish applies.

## Behaviour and stored data

- Selecting Other reveals a required content-focus answer. Selecting another topic clears the custom answer from the submitted payload. Review and admin views show the custom topic.
- Audience size is a required whole-number count for the primary profile. An explicit zero is valid; a blank, negative, fractional or out-of-range answer is rejected. The application stores the exact count.
- Phone is a required contact question. Common Australian local formatting is normalised to an international number; international numbers include their country code. This does not verify ownership or send a message.
- The shared server validator enforces the requirements, and all three answers participate in request-payload hashes. The existing dedupe identity, private admin queue, consent and submission lock are preserved.
- The privacy notice version becomes `creator-privacy-2026-09-09-v3` and describes the new collection. Applicant answers remain absent from analytics and browser storage.

## Migration and compatibility

`20260909170000_creator_application_details.sql` adds nullable `phone`, `focus_detail` and `audience_size` columns and updates the private submission RPC. Existing applications retain their original values; absent historical details are not fabricated. The legacy audience range remains available for historical admin records. New records also retain a derived range for compatibility.

The database accepts the old payload during the deployment transition. A v3 payload, or a payload containing any new detail key, uses the required-details contract. The updated public API requires the new fields. Older open forms receive a refresh instruction when they try to submit their old payload.

A fresh production backup of `public` and `ecl_migrations` restored into a separate loopback-only PostgreSQL 17 database. All 40 table row digests and owners matched. Production initially had 35 verified migration records and no pending migrations. Credentials, backup data and operational scripts are stored privately outside the repository.

## Verification and release

Independent review found no outstanding issues after tightening SQL validation to require a JSON string and trim the complete ECMAScript whitespace set. This prevents whitespace-only or non-string Other answers through the private RPC as well as the public API.

Local verification:

- 490 unit tests passed across 93 files. The final SQL whitespace correction separately passed all 8 intake SQL tests and 11 isolated reviewer RPC checks.
- 22 native PostgreSQL checks passed across the complete 36-migration chain, including commerce concurrency, private grants and backup restoration.
- The final migration passed 7 checks against the freshly restored production backup: unchanged historical data, private grants, exact details including zero, invalid answers, legacy payload compatibility, concurrent retries and precise synthetic cleanup. Its SHA-256 is `73c2686e534a979fa7ee2bec91569a0670cec5188d0f2f7646fcea903f6da305`.
- Browser checks passed across 320px, 390px and desktop viewports: 57 checks in the full run plus the 3 corrected accessible-description assertions on rerun; 6 existing viewport-specific skips. The correction affected only test expectations; helper text remains attached to the audience input.
- Typecheck, lint, production build, all 6 route budgets and all 9 private response-header checks passed.
- A native browser walkthrough confirmed missing-phone and missing-Other focus, a blocked blank audience answer, an accepted explicit zero, and all new answers in the review screen.

Release sequence: commit and push the reviewed source, wait for the normal required GitHub `verify` check on that exact commit, apply the checksum-matched migration with verified TLS and recheck private grants, then fast-forward and push main for the production deployment. After the deployment is ready, verify the canonical application and API with an explicitly identified synthetic submission, confirm all new fields in private storage, and remove only that synthetic application. Private operational evidence is retained outside the repository.
