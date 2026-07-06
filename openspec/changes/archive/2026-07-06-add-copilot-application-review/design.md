## Context

The founder copilot (`mods/apiserver/src/api/copilot`) runs an LLM tool loop with a three-list tool policy: `READ_TOOLS` execute inline, `WRITE_TOOLS` are intercepted and persisted as a `CopilotPendingAction` for the founder to confirm, and `DIRECT_TOOLS` execute inline for low-risk config. Today no application-review action is bound at all — the copilot can look up a solicitud (`getApplicationById`) but cannot act on one.

The backend already has everything the actions need:

- `reviewApplication.ts` exports `createRejectApplication` / `createApproveApplication`, both `(input, reviewerId) => Promise<LoanApplication>`, validating the status transition (`RECEIVED`/`IN_REVIEW` → `REJECTED`/`APPROVED`) and persisting `reviewedById` / `reviewedAt` / `reviewNote`.
- `createDeleteApplication.ts` hard-purges a non-`CONVERTED` application `(input, reviewerId) => Promise<LoanApplication>`.
- `@mikro/common` exports `rejectApplicationSchema` (required non-empty `reason`), `approveApplicationSchema` (optional `note`), and `deleteApplicationSchema`, plus the transition validator.

Copilot writes are executed at confirm time through the shared `@mikro/agents` `toolExecutor` (`createConfirmCopilotAction.ts`), passing `context = { userId, role: "ADMIN", name }`. That path deliberately bypasses the tRPC `.meta({ event })` boundary that records domain events (`application.rejected` etc.), so — exactly like `createPayment` via the copilot, which records no `payment.collected` — a confirmed copilot write records a single generic `copilot.action` event.

## Goals / Non-Goals

**Goals:**

- Let the founder approve, reject (with a required, recorded reason), and delete a solicitud from the copilot, each behind the existing confirm-first gate.
- Reuse the existing review/delete procedures, schemas, transition rules, and pending-action machinery without change.
- Keep the audit intent of #114: a rejection always preserves the application row and records the motive.

**Non-Goals:**

- No new dashboard or mobile UI (backend + copilot tool policy only).
- No change to the review transition rules or the confirm/expiry flow.
- Not exposing these tools to the WhatsApp intake agents (José) — copilot-only.
- No new business-event types and no change to the event-capture boundary.

## Decisions

### Decision 1: Wire as shared `@mikro/agents` tools, injected from apiserver

Each action gets (a) a `ToolFunction` definition in `mods/agents/src/tools/definitions.ts` + `allTools`, (b) an executor handler in `mods/agents/src/tools/executor/`, and (c) a dependency function on `ToolExecutorDependencies`. The apiserver injects the real implementations when it builds the executor (`mods/apiserver/src/index.ts`), binding `createRejectApplication(db)` / `createApproveApplication(db)` / `createDeleteApplication(db)`. The handler reads the reviewer id from the executor `context.userId` (the confirming founder) and passes it as `reviewerId`.

_Alternative considered:_ define them as copilot-local tools handled inline in `createCopilotChat` (like `queryFeedEvents`). Rejected — those are the copilot's own read/config tools; business writes belong in the shared executor so the confirm flow runs them through the same `toolExecutor(action.toolName, args, ctx)` path as every other write, with no special-casing in `createConfirmCopilotAction`.

### Decision 2: All three are `WRITE_TOOLS` (confirm-first), not `DIRECT`

Approve, reject, and delete all mutate business records, so they must be proposed and confirmed, never executed inline. Add the three names to `WRITE_TOOLS` in `toolPolicy.ts`; the existing loop then intercepts them automatically. `summarizeAction.ts` gains a Spanish one-liner per tool for the confirm card (e.g. "Rechazar la solicitud {id} por el motivo: …").

### Decision 3: Copilot review actions record only `copilot.action`

A confirmed copilot review action records the generic `copilot.action` event, whose payload already carries `toolName`, the verbatim `args` (including the rejection `reason`), and the result summary. This is the established behavior for every copilot write and is a complete audit trail of who decided what and why — satisfying #114. We do not additionally fire the domain `application.rejected/approved/deleted` events, keeping copilot writes uniform and avoiding double-eventing.

_Alternative considered:_ have the injected apiserver dependency also fire the domain event via `eventMappers`. Rejected as scope creep and an inconsistency versus other copilot writes; can be a clean follow-up if the feed needs the richer domain cards for copilot-initiated actions.

### Decision 4: System prompt steers reject-over-delete

Per #114's intent, the system prompt gains a short line: for a real decline, propose `rejectApplication` with a reason (preserves the record); reserve `deleteApplication` for dead/spam/abandoned flows the founder wants purged. Delete stays available (full parity) but is not the default path for turning an applicant down.

## Risks / Trade-offs

- **Copilot-initiated delete is not restorable from the feed.** The `application.deleted` snapshot event (which `restoreApplication` replays) is produced only on the tRPC delete path; a copilot delete records `copilot.action` without the snapshot. → Mitigated by Decision 4 (prompt steers to reject, which never deletes; delete reserved for flows nobody wants back) and by delete still requiring explicit founder confirmation. Acceptable given reject is the headline capability and delete is the rarely-correct choice.
- **Reviewer identity comes from `context.userId`.** If a handler is ever invoked without a userId context it would pass `undefined` as `reviewerId`. → The only caller (`createConfirmCopilotAction`) always sets `userId`; handlers guard for a missing dependency and return a structured failure rather than throwing.
- **Wrong-status confirmations.** A solicitud may change status between propose and confirm. → The underlying `resolveReviewTransition` / `CONVERTED`-guard already refuse invalid transitions with a `CONFLICT`; the confirm flow surfaces that as a `BAD_REQUEST` and nothing else changes.

## Migration Plan

Additive only — new tool definitions, handlers, dependency fields, and three names in `WRITE_TOOLS`. No schema or data migration. Rollback is removing the three names from `WRITE_TOOLS` (unbinds them) or reverting the change; no persisted state depends on it.

## Open Questions

- Should the feed eventually show richer domain cards (`application.rejected`) for copilot-initiated reviews instead of the generic `copilot.action` card? Deferred (Decision 3) — revisit if founders want the copilot decisions to look identical to dashboard decisions in the feed.
