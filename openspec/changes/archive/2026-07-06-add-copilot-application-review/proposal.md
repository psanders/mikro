## Why

The founder copilot can answer questions about a solicitud (`getApplicationById`) but cannot act on one: its tool policy binds no application-review write tools at all. In practice the founder resolves a solicitud only from the dashboard/mobile review UI, and the most consequential decision — turning down an applicant — has no copilot path. Issue #114 (filed by the copilot itself as a `missing_capability`) frames the gap sharply: a founder mid-conversation can conceptually approve or delete, but not formally _reject_. Deleting erases the record and the reason; a formal rejection must keep the row, the motive, and an audit trail so the business can learn from rejection patterns and defend the decision later.

## What Changes

- Add three application-review write tools to the founder copilot, each a **WRITE_TOOL** (confirm-first: the copilot proposes a pending action, the founder confirms in the dock before anything executes):
  - `rejectApplication` — moves a `RECEIVED`/`IN_REVIEW` solicitud to `REJECTED`, requiring a non-empty `reason` that is persisted as the review note (audit trail).
  - `approveApplication` — moves a `RECEIVED`/`IN_REVIEW` solicitud to `APPROVED`, with an optional note.
  - `deleteApplication` — hard-purges a dead/abandoned solicitud (already exists as a procedure; now reachable from the copilot behind the same confirm gate).
- Wire each as a shared `@mikro/agents` tool: definition in the registry, an executor handler, and new `ToolExecutorDependencies` functions injected by the apiserver from the existing `reviewApplication` / `deleteApplication` procedures.
- Add the three names to the copilot `WRITE_TOOLS` list so they are bound to the model and routed through the pending-action confirm flow (never executed inline).
- Extend the copilot system prompt to steer the model toward _reject-with-reason_ as the default for a real decline and reserve `deleteApplication` for genuinely dead/spam flows, so the audit-trail intent of #114 is preserved even though delete is available.

No changes to the backend review transition rules, the pending-action confirm/expiry machinery, or the dashboard/mobile UI — this reuses all of it.

## Capabilities

### New Capabilities

<!-- none: this extends existing copilot behavior rather than introducing a new capability area -->

### Modified Capabilities

- `founder-copilot`: adds a requirement that the copilot tool policy binds `approveApplication`, `rejectApplication`, and `deleteApplication` as confirm-first write tools, and that a proposed rejection carries a required reason persisted for audit.

## Impact

- **@mikro/agents**: `src/tools/definitions.ts` (three new `ToolFunction`s + `allTools`), `src/tools/executor/` (three new handlers + `index.ts` dispatch), `src/tools/executor/types.ts` (three new dependency function signatures).
- **@mikro/apiserver**: copilot `toolPolicy.ts` (`WRITE_TOOLS`), the tool-executor wiring in `src/index.ts` (inject the review/delete functions), and `systemPrompt.ts` (reject-vs-delete guidance).
- **Reused unchanged**: `reviewApplication.ts` (`createRejectApplication`/`createApproveApplication`), `createDeleteApplication.ts`, `rejectApplicationSchema`/`approveApplicationSchema`, the `CopilotPendingAction` confirm/expiry flow, and the `copilot.action` event.
- **No breaking changes**; no schema/migration changes.
