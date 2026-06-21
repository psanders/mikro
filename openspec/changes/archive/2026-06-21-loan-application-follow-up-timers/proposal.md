## Why

Loan applications arriving from the website arrive and sit unattended when the prospect abandons the form mid-way or never follows up. There is no automated mechanism to re-engage them or to eventually clean up stale records, which leaves reviewers with unactionable noise in the queue.

## What Changes

- Introduce a two-stage timer system for externally-submitted loan applications:
  - **Stage 1 (10-min nudge)**: when a new application arrives from the website or WhatsApp flow and is not completed within 10 minutes, send the prospect a WhatsApp template message (not a form flow) letting them know the request was received and offering to help finish it.
  - **Stage 2 (8-hour stale)**: after the nudge is sent, start an 8-hour window; if no response arrives within that window, mark the application `ABANDONED`.
- Add a new WhatsApp template for the nudge message (registered with Meta).
- Add a `source` field to `LoanApplication` to distinguish externally-submitted applications (`form`, `whatsapp`) from staff-created ones (`manual`).
- **BREAKING** (for manual create only): change `createApplication` to set status `RECEIVED` instead of `DRAFT` so manual applications appear as "Nueva" in the dashboard immediately. Manual apps carry `source: manual` and are excluded from all timer logic.
- Cancel active timers when an application is completed or already reaches a terminal state (IN_REVIEW, APPROVED, etc.) before the timer fires.
- If an applicant has no phone number at Stage 1 fire time, skip the nudge and go straight to Stage 2 stale window (or abandon immediately — implementation choice deferred to design).

## Capabilities

### New Capabilities

- `loan-application-follow-up-timers`: Two-stage automated follow-up — 10-min nudge via WhatsApp template + 8-hour stale window that marks applications ABANDONED. Timers are set on external application arrival and cancelled on completion or terminal status.

### Modified Capabilities

- `loan-application-manual-create`: Manual creation now sets status `RECEIVED` (not `DRAFT`) so the application appears as "Nueva" immediately; adds `source: manual` to prevent timer triggering.
- `loan-application-model`: Adds `source` enum field (`FORM`, `WHATSAPP`, `MANUAL`) and timer-tracking columns (`followUpJobId`, `staleJobId`) to `LoanApplication`.

## Impact

- **apiserver**: new job scheduler dependency (BullMQ or pg-boss), new timer worker, changes to `createApplication` (status + source), changes to `upsertApplication` (source tagging, timer scheduling), new `cancelApplicationTimers` helper, new nudge template sender.
- **Database**: migration adding `source` enum + two nullable `followUpJobId` / `staleJobId` string columns.
- **WhatsApp**: one new Meta-approved template required before deployment.
- **agents**: no changes required; existing `sendTemplateMessage` is reused.
- **Dashboard**: no UI changes; manual apps will appear as "Nueva" automatically once status is RECEIVED.
