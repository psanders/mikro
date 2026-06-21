## Context

The apiserver uses SQLite (via `@prisma/adapter-better-sqlite3`) with no Redis, BullMQ, pg-boss, or other job queue infrastructure. There are currently zero persistent delayed-job or timer mechanisms in the codebase. WhatsApp templates are sent via `sendTemplateMessage` in `mods/agents/src/whatsapp/client/sendMessage.ts`; the promo template sender (`createSendApplicationPromo.ts`) is the closest precedent.

Applications arrive externally via `POST /v1/applications` (upsertApplication — source: form) or via WhatsApp Flow nfm_reply (source: whatsapp), both landing as `RECEIVED` when complete. Staff create applications manually via `createApplication` mutation (currently lands as `DRAFT`, changing to `RECEIVED` in this change).

## Goals / Non-Goals

**Goals:**

- Automatically nudge externally-submitted applicants who have a phone after 10 minutes of inactivity
- Auto-abandon stale applications 8 hours after the nudge
- Manual applications show as "Nueva" (RECEIVED) immediately with no timers
- Timers are cancelled when an application advances past RECEIVED before firing
- No new infrastructure dependencies (no Redis, no external queue)

**Non-Goals:**

- Retry logic for failed WhatsApp sends (best-effort, same as existing promo)
- Push notifications or email channels
- UI/dashboard changes for timer state visibility (out of scope for this change)
- Configuring timer durations from the dashboard

## Decisions

### Decision 1: SQLite job table with polling worker (vs. BullMQ/Redis)

**Chosen**: Add a `FollowUpJob` table to the Prisma schema; a `setInterval` polling loop runs every 30 seconds inside the apiserver process, selects overdue jobs, and executes them.

**Alternatives considered**:

- **BullMQ + Redis**: most robust, but adds a Redis dependency and operational overhead for what amounts to ~2 timers per incoming application at current volume.
- **node-cron**: stateless, jobs lost on restart — unacceptable for abandonment marking.
- **Agenda + MongoDB**: wrong database.

**Rationale**: Zero new infrastructure. SQLite is already transactional enough for small-volume timer workloads. At higher throughput the table can be swapped for BullMQ by keeping the interface identical.

### Decision 2: `source` enum field distinguishes manual vs external applications

**Chosen**: Add `ApplicationSource` enum (`FORM`, `WHATSAPP`, `MANUAL`) with a `source` column on `LoanApplication`. Timer scheduling only happens when `source` is `FORM` or `WHATSAPP`.

**Alternatives considered**:

- Boolean `isManual` flag: less extensible, loses distinction between form and WhatsApp.
- No field, derive from context: would require passing extra flags through layers — fragile.

**Rationale**: Explicit source enables future per-source business logic (e.g., different timer durations per channel) without schema changes.

### Decision 3: Manual create → RECEIVED status directly

**Chosen**: `createApplication` sets status `RECEIVED` and `source: MANUAL`. No timers are set.

**Rationale**: Staff-created applications represent real prospects that should appear in the active queue immediately. DRAFT status was an artifact of having no need to distinguish internal from external creation.

### Decision 4: Two-row job model (one per stage, not state machine)

**Chosen**: A `FollowUpJob` table with columns `(id, applicationId, type: NUDGE|ABANDON, scheduledFor, status: PENDING|DONE|CANCELLED)`. Stage 1 creates a NUDGE job; on NUDGE execution, a new ABANDON job is created. Previous NUDGE job is marked DONE.

**Alternatives considered**:

- Single row updated in place: harder to audit, race condition risk on status transitions.
- Store jobId on `LoanApplication`: denormalized, makes cancellation harder if IDs shift.

**Rationale**: Append-style job rows are simple to query, easy to cancel by applicationId + type, and provide a natural audit trail.

### Decision 5: No-phone behaviour at NUDGE time → immediate ABANDON

**Chosen**: If the application has no `phone` when the NUDGE job fires, skip the template send and schedule an ABANDON job immediately (0-delay) rather than waiting 8 hours.

**Rationale**: Without a phone we can never re-engage the applicant; holding the slot for 8 hours is pointless. This is a conservative default; it can be reversed in a follow-up change.

### Decision 6: New WhatsApp template — text-only, no flow button

**Chosen**: Register a new template (working name: `loan_application_follow_up`) with a body like: _"Hola, vimos tu solicitud de préstamo y queremos ayudarte a completarla. Puedes responder aquí para continuar."_ No header image, no flow button.

**Rationale**: A flow button would re-open the intake flow, but the user confirmed form flows don't work in this context. A plain conversational template is sufficient and simpler to get Meta approval for.

## Risks / Trade-offs

- **Process restart loses in-flight `setTimeout` calls** → Mitigated: jobs live in SQLite, not memory. On restart the polling loop picks up any overdue PENDING jobs immediately.
- **SQLite write contention under high load** → Low risk at current volume; if it becomes a problem, migrate to BullMQ without changing the interface.
- **Template approval delay** → The feature can be deployed behind a flag with template send stubbed until Meta approves the new template.
- **Race: application completed after NUDGE fires but before DB write** → The NUDGE handler checks application status before sending; if already past RECEIVED it cancels and does not send.
- **Polling granularity (30 s)** → Timer durations (10 min, 8 h) have ±30 s jitter. Acceptable for these use cases.

## Migration Plan

1. Prisma migration: add `ApplicationSource` enum, `source` column (default `FORM` for existing rows), `FollowUpJob` table.
2. Deploy apiserver — existing applications are unaffected (no timers for old rows).
3. Register new WhatsApp template with Meta. Until approved, NUDGE handler exits early with a warning log.
4. Once template approved, remove the early-exit guard.
5. Rollback: drop `FollowUpJob` table and `source` column; revert `createApplication` status back to `DRAFT`.

## Open Questions

- **Timer durations configurable?** For now hardcoded (10 min, 8 h). Add to `mikro.json` if product wants runtime tunability.
- **NUDGE send failure**: best-effort (log + proceed to ABANDON timer) or retry? Current proposal: best-effort, consistent with existing promo send pattern.
- **Partial form submissions (DRAFT)**: Stage 1 only fires for RECEIVED (complete) applications. Should there be a separate timer for DRAFT applications? Out of scope for this change.
