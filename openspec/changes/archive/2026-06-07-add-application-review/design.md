## Context

`LoanApplication` carries the lifecycle enum `DRAFT, RECEIVED, IN_REVIEW, APPROVED, REJECTED, SIGNED, CONVERTED, ABANDONED` and an advisory score recomputed on every write. Intake (public) and read procedures (`listApplications`/`getApplication`) exist. The apiserver has `adminProcedure` (ADMIN-only) and `ctx.userId`/`ctx.roles`. `LoanApplication.customerId`/`loanId` are plain nullable columns (no Prisma relations); the reviewer id follows that style.

## Goals / Non-Goals

**Goals:**

- Admin-only transitions to claim, approve, reject, and reopen an application.
- Record who decided, when, and why (latest decision on the row).
- Enforce a clear state machine; reject invalid transitions.

**Non-Goals:**

- Signing/conversion (Phase 3), dashboard UI (Phase 4).
- An append-only audit/event log (latest-decision-on-row for v1).
- Notifications, auto-decisioning, or score-based hard blocks.

## Decisions

### State machine (review subset)

Allowed transitions, enforced by a shared helper:

- `RECEIVED → IN_REVIEW` (claim)
- `RECEIVED → APPROVED`, `IN_REVIEW → APPROVED` (approve)
- `RECEIVED → REJECTED`, `IN_REVIEW → REJECTED` (reject)
- `APPROVED → IN_REVIEW`, `REJECTED → IN_REVIEW` (reopen)

`DRAFT`, `SIGNED`, `CONVERTED`, `ABANDONED` are not valid sources for these review actions; attempting one throws a `TRPCError` (`BAD_REQUEST`/`CONFLICT`) naming the current and attempted status. Decisions can be made directly from `RECEIVED` (claiming is optional), which keeps the common one-step case fast while still allowing an explicit claim.

### Decision recorded on the row

Each transition sets `status`, `reviewedById = ctx.userId`, `reviewedAt = now`, and `reviewNote` (the rejection reason or optional approval/reopen note). This is the latest-decision snapshot. A full append-only event log (every claim/approve/reopen with actor + timestamp) is deferred; it can be added later without changing these columns.

### A `REVIEWER` role + `reviewerProcedure`

A `REVIEWER` value is added to the `Role` enum (Prisma, `@mikro/common` `roleEnum`, and the apiserver's `VALID_ROLES` in `context.ts`). A new `reviewerProcedure` (mirroring `adminProcedure`) permits callers whose roles include `ADMIN` **or** `REVIEWER`; everyone else gets `FORBIDDEN`. Roles are many-to-one, so a user can be both a collector and a reviewer. ADMIN retains review access (admins can do everything).

### Score is advisory, never a gate

The engine's hard flags (`OUT_OF_ZONE`, `CRITICAL_BUSINESS`) and recommendation are surfaced for the reviewer but do not block approval — the human decision is authoritative. This matches the deterministic-but-advisory stance from Phase 2.

### Reject requires a reason; approve/reopen optional note

`rejectApplication` requires a non-empty `reason` (stored in `reviewNote`) so rejections are always explainable. `approveApplication`/`reopenApplication` accept an optional `note`.

### Reuse the upsert path's scoring untouched

Review mutations update status/audit columns only; they do not re-run scoring (scoring belongs to the write/intake path). An approved row keeps its last-computed score.

## Risks / Trade-offs

- **No event log → limited history** → Accepted for v1; the row shows the latest decider/decision. If audit/compliance needs the full trail, add an append-only table later (columns stay compatible).
- **Reopen makes APPROVED/REJECTED non-terminal** → Intended (undo mistakes). Phase 3 conversion will gate on `APPROVED`/`SIGNED`, so a reopened row simply leaves that gate until re-approved.
- **Direct decisions skip IN_REVIEW** → Acceptable; claiming is an optional explicit step, not a required one.

## Open Questions

- None blocking. (A dedicated `REVIEWER` role is included so reviewers need not be full admins.)
