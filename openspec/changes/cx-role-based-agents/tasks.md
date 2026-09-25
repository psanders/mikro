## 1. Shared types and schema

- [x] 1.1 Add `CUSTOMER` and `APPLICANT` to `profileEnum` in `mods/common/src/schemas/user.ts`; confirm both barrels (`schemas/index.ts` and root `index.ts`) still export `AGENT_PROFILES`/`Profile`
- [x] 1.2 Add `ConversationHandoff` model to `schema.prisma` (phone, profile, reason, applicationId?, customerId?, openedAt, expiresAt, closedAt?; index on phone+closedAt) with a migration
- [x] 1.3 Mirror the new table in the integration-test `SCHEMA_SQL`
- [x] 1.4 Add `cx.handoff_requested` to the business event types and render it in the founder feed (summary: profile + reason)

## 2. Apiserver data functions

- [x] 2.1 Extend `createGetApplicationByPhone` to return `{ applicationId, sessionId, status, submittedAt }` (keep `partial` for existing callers until the router switches); update its tests
- [x] 2.2 Add `createRecordProspectActivity(applicationId)`: cancel PENDING ABANDON for the application and create one at now + `abandonDelayMs`; unit-test "exactly one pending ABANDON"
- [x] 2.3 Call `recordProspectActivity` from `createUpsertApplication` on `partial: true` writes; test
- [x] 2.4 Stop scheduling ABANDON in `createHandleNudgeJob`; update its tests and the no-phone path
- [x] 2.5 Make `createHandleAbandonJob` defer (reschedule to `expiresAt`) while a hand-off is open for the application's phone; test
- [x] 2.6 Add `createReopenApplication(applicationId)`: only `ABANDONED` with `submittedAt == null` → `DRAFT`, then record activity; reject other states; test both branches
- [x] 2.7 Add hand-off functions: `openHandoff` (open-or-extend, idempotent, appends the business event), `getOpenHandoff(phone)` (respects `expiresAt`), `extendHandoff(phone)`; tests incl. restart persistence via DB
- [x] 2.8 Add customer self-service data functions: own loans with the canonical balance snapshot, own payments for a loan (ownership check), and the missing evidence for an application (cédula slots + business photo count vs `applications.minBusinessPhotos`)

## 3. Agent tools (context-bound)

- [x] 3.1 Add `listMyLoans`, `listMyPayments`, `sendMyReceipt` definitions and executors that read identity only from context; tests proving foreign phone/loan/payment ids return nothing
- [x] 3.2 Add `getMyApplicationStatus` returning only `{ stage, missingEvidence }` (plain-language stage map; no score/band/reasons); test the payload shape
- [x] 3.3 Add `attachApplicationEvidence(kind: ID_FRONT | ID_BACK | BUSINESS_PHOTO)` using the current turn's image from context; writes the cédula columns or an `ApplicationDocument` with `uploadedById = "whatsapp:<phone>"`; tests incl. "no image in turn" error
- [x] 3.4 Add `requestHumanHandoff(reason)` wired to `openHandoff` with profile/application/customer from context; test
- [x] 3.5 Wire the new executors' dependencies in `apiserver/src/index.ts`

## 4. Routing and handler

- [x] 4.1 Rewrite `createMessageRouter` to the D2 order (user → customer → application status → guest) with ADMIN > REVIEWER > COLLECTOR precedence; new `RouteResult` variants (`customer`, `prospect` with applicationId, `reopen`, `applicant`); table-driven tests covering every spec scenario
- [x] 4.2 In `handleWhatsAppMessage`, add the hand-off gate after routing (open → extend, record activity, no reply) and the explicit-request backstop regex (open the hand-off + fixed acknowledgement); tests incl. the regex's negative cases ("mi asesor me dijo…")
- [x] 4.3 Record prospect activity for PROSPECT-routed messages, including when `agentRepliesEnabled` is false (move the kill-switch check after the activity bookkeeping, keep "no LLM, no send"); tests
- [x] 4.4 Add the reopen path: call `reopenApplication`, then hand the turn to José; skipped when replies are disabled; test
- [x] 4.5 Add APPLICANT and CUSTOMER paths using the phone-keyed in-memory conversation store; pass `{ phone, applicationId | customerId, imageUrl }` context; tests
- [x] 4.6 Remove the fixed "en revisión" hold message and the ADMIN/COLLECTOR redirect texts; unassigned employee roles = no LLM, no send; update tests
- [x] 4.7 Add `requestHumanHandoff` to José's flow: the handoff does not trigger abandon; the decline regex still wins; test

## 5. Agent config

- [x] 5.1 Add GUEST, APPLICANT and CUSTOMER entries to `agents.yaml` with `enabled: false`, Spanish prompts per the spec limits, and explicit `allowedTools`; add `requestHumanHandoff` to José
- [x] 5.2 Add evaluation cases per agent: applicant never states a score/date/odds; customer refuses another person's loan; guest always invites to the solicitud; explicit "quiero hablar con una persona" triggers a hand-off
- [x] 5.3 Confirm config validation accepts the new profiles and still rejects duplicate profiles (test)
- [x] 5.4 FAQ copy for the GUEST/APPLICANT prompts taken from the website FAQ (site/src/pages/FAQPage.tsx) + coverage (Puerto Plata); founder to review before enabling

## 6. Verification and docs

- [x] 6.1 `npm run build`, lint and the full test suite green in the worktree (run `npm ci` in the worktree first)
- [x] 6.2 Run the agent evals for the new agents
- [ ] 6.3 Manual WhatsApp smoke on staging: guest, DRAFT prospect, reopen, applicant + photo, customer balance/receipt, hand-off silence + expiry, employee silence, kill switch
- [x] 6.4 Update `mods/agents/README.md` routing section and the rollout order (enable GUEST → APPLICANT → CUSTOMER)

## 7. Founder decisions (2026-09-25)

- [x] 7.1 Router flags a guest whose latest application is REJECTED; the handler opens a hand-off with a fixed acknowledgement, no LLM (D9); tests
- [x] 7.2 Router attaches a returning customer's in-pipeline application; Carmen gets the status/evidence tools with the APPLICANT limits (D10); tests + eval scenario
- [x] 7.3 Specs, design and explainer updated for both decisions
