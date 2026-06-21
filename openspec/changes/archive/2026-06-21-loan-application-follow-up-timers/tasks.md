## 1. Database Migration

- [x] 1.1 Add `ApplicationSource` enum (`FORM`, `WHATSAPP`, `MANUAL`) to `schema.prisma`
- [x] 1.2 Add `source ApplicationSource @default(FORM)` column to `LoanApplication` model
- [x] 1.3 Add `FollowUpJob` model to `schema.prisma` with columns: `id`, `applicationId`, `type` (`NUDGE`|`ABANDON`), `scheduledFor`, `status` (`PENDING`|`DONE`|`CANCELLED`), `createdAt`; add composite index on `(status, scheduledFor)`
- [x] 1.4 Run `prisma migrate dev` and verify migration file is generated

## 2. WhatsApp Template

- [x] 2.1 Draft `loan_application_follow_up` template body in Spanish and register with Meta (text-only, no flow button, no header image)
- [x] 2.2 Add `loanApplicationFollowUpTemplate` and `loanApplicationFollowUpTemplateLanguage` keys to `mikro.json`

## 3. Core Timer Logic

- [x] 3.1 Create `createScheduleFollowUpJob(prisma)` factory — inserts a NUDGE `FollowUpJob` for a given `applicationId` with `scheduledFor` = now + 10 min
- [x] 3.2 Create `createCancelApplicationJobs(prisma)` factory — sets all PENDING `FollowUpJob` rows for an `applicationId` to `CANCELLED`
- [x] 3.3 Create `createSendFollowUpNudge` factory — sends `loan_application_follow_up` template to a phone (reuse `sendTemplateMessage`; best-effort, returns `{ sent, error }`)
- [x] 3.4 Create `createHandleNudgeJob(prisma, sendFollowUpNudge)` — fetches application, checks status, sends nudge if RECEIVED+phone, schedules ABANDON job (+8 h or +0 if no phone), marks NUDGE job DONE; marks CANCELLED if application already advanced
- [x] 3.5 Create `createHandleAbandonJob(prisma)` — fetches application, sets status ABANDONED if still RECEIVED, marks job DONE; marks CANCELLED otherwise
- [x] 3.6 Create `createFollowUpWorker(prisma, sendFollowUpNudge)` — `setInterval(30_000)` that queries all overdue PENDING jobs, routes each to the correct handler; log errors without crashing the loop

## 4. Integrate Timer Scheduling into Application Flows

- [x] 4.1 In `createUpsertApplication`: after a successful upsert where `status === RECEIVED` and `source !== MANUAL`, call `scheduleFollowUpJob`
- [x] 4.2 In `reviewApplication` (`applyReview`): after status transition away from `RECEIVED`, call `cancelApplicationJobs`
- [x] 4.3 In `createFinalizeApplication`: after `ABANDONED` outcome, ensure any PENDING jobs for that application are cancelled (call `cancelApplicationJobs`)

## 5. Manual Create — Status Change

- [x] 5.1 In `createCreateApplication`: change created status from `DRAFT` to `RECEIVED` and set `source: MANUAL`
- [x] 5.2 Verify no `FollowUpJob` is created for manually-created applications (source guard in `createUpsertApplication` covers this, but confirm path)
- [x] 5.3 Update `loan-application-manual-create` spec tests / integration tests to expect `RECEIVED` status

## 6. Wire Worker into apiserver

- [x] 6.1 Instantiate `followUpWorker` in `mods/apiserver/src/index.ts` after Prisma client is ready; pass injected `sendFollowUpNudge` dependency
- [x] 6.2 On process `SIGTERM` / `SIGINT`, clear the worker interval before shutdown

## 7. Types and Config

- [x] 7.1 Add `ApplicationSource` type to `mods/common/src/types/application.ts`
- [x] 7.2 Extend `applicationStatusEnum` / Zod schemas in `mods/common/src/schemas/application.ts` if source is exposed via API
- [x] 7.3 Add follow-up template config reader to `mods/agents/src/config.ts` (or apiserver config) mirroring existing `getWhatsAppPromoTemplate`

## 8. Tests

- [x] 8.1 Unit test `handleNudgeJob`: RECEIVED+phone → sends nudge + schedules ABANDON; RECEIVED+no phone → no send + immediate ABANDON; non-RECEIVED → CANCELLED
- [x] 8.2 Unit test `handleAbandonJob`: RECEIVED → ABANDONED; non-RECEIVED → CANCELLED
- [x] 8.3 Unit test `cancelApplicationJobs`: all PENDING rows for applicationId set to CANCELLED
- [x] 8.4 Integration test: form submission creates NUDGE job with correct `scheduledFor`; manual creation creates no job
