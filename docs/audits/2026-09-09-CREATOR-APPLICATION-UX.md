# Creator application experience — 9 September 2026

## Scope

The owner requested a beautiful, dynamic Typeform-style application experience and previously authorised publishing completed creator-page work. GPT-5.5 is the implementation executor. This refinement uses the existing native application endpoint and private admin queue.

The interaction design presents one question at a time with conversational headings, ECL's dark and cyan visual language, visible progress, native choice controls, and Back/Continue navigation. Optional portfolio and audience answers can be skipped. A final review allows individual answers to be edited before explicit submission. Editing an answer returns directly to review.

The existing offer, applicant fields, consent requirements, privacy version, validation rules, idempotency contract and server storage remain in scope as preservation requirements. Applicant answers are not added to browser storage or analytics. Existing campaign images continue to use the prepared direct WebP assets.

## Acceptance

- Required answers are validated when continuing; hidden questions are absent from the tab order.
- Back retains answers; optional answers can be skipped; review edits return directly to review.
- Native radio arrow-key changes do not unexpectedly advance. Enter continues single-line answers; textarea Enter remains a newline.
- Pending submission locks controls; unchanged retries retain their request key; changed payloads receive a new key.
- Server field errors reveal and focus the relevant question. Success is shown only after the endpoint confirms acceptance.
- The flow fits 320px and 390px mobile widths and desktop, supports reduced motion, and has no serious or critical accessibility violations in the exercised steps.
- Existing section anchors and the mobile application CTA retain their navigation and focus behaviour.

## Verification and release

The implementation was prepared from `9dca072` in the existing creator worktree. Independent review cleared the final focus, retained radio selection, composition-key handling and privacy-link fixes. The notice opens separately so reading it does not discard in-memory answers.

Local verification passed 477 tests in 93 files, TypeScript and lint. The production build, six configured route budgets and nine private-response header checks passed. The final browser run passed 57 checks with six intentional viewport skips. It exercises the application, other storefront interactions and accessibility. The image-readiness assertion now waits for the six campaign assets to finish loading instead of racing their initial decode.

A manual browser walkthrough confirmed the 390px question flow, 320px review layout, retained VIC focus, direct return from editing to review, and the explicit final send/success state using an isolated synthetic fixture. Desktop composition was checked at 1440px. Review and choice screens also passed automated accessibility checks. No production applicant was created during the visual walkthrough.

Release uses the repository's required `verify` check before normal integration into `main`, followed by the existing Vercel production deployment and a check of the canonical creator page. No database migration or production configuration change is required. The exact release commit, CI run and deployment are available in GitHub, Vercel and the release task.
