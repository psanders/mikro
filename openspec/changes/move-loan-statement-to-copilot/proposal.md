## Why

The loan-statement report was shipped as a schedulable task automation (issue #110 / unify-reporting-strategy), but generating a statement is always an on-demand, one-off ask ("dame el estado de cuenta del préstamo 10036") — nobody schedules a recurring statement for a specific loan. Because the copilot chat loop only surfaces the automation catalog through `createTask` (which requires a `frequency`/`timeOfDay`), the LLM has no callable tool that matches an immediate request, and falls back to read-only status tools (`getLoanHealth`, `getLoanByLoanId`), answering with prose instead of producing the document.

## What Changes

- Remove `loan-statement` from the task-automation catalog (`mods/apiserver/src/tasks/catalog.ts`) and delete its automation module (`mods/apiserver/src/tasks/automations/loanStatement.ts`). **BREAKING**: any existing scheduled/recurring task bound to `automationId: "loan-statement"` becomes invalid (none are expected in practice — statements aren't recurring — but schema-drift handling in the task system will move any such firing to `NEEDS_INPUT` rather than crash).
- Add a `generateLoanStatement` **direct** tool to the founder-copilot tool policy (`mods/apiserver/src/api/copilot/toolPolicy.ts`), reusing `createGenerateLoanStatement` — the same function the CLI and the `generateLoanStatement` tRPC mutation already call. Read-only (never mutates the ledger), so it executes inline in the chat loop with no confirm-card step.
- The dock renders the tool's result as a downloadable statement (PDF/JSON), delivered in the same chat turn — no scheduling, no pending-action confirm.
- Update the copilot system prompt's tool-disambiguation notes so the model prefers `generateLoanStatement` over `getLoanHealth`/`getLoanByLoanId` when the founder is asking for the statement/document itself, not just a status summary.
- `founder-feed`'s automation-catalog UI (task creation surfaces) no longer lists "Estado de cuenta del préstamo" as schedulable.

## Capabilities

### New Capabilities

(none — this extends `founder-copilot`'s existing direct-tool pattern, it doesn't introduce a new capability domain)

### Modified Capabilities

- `founder-copilot`: adds a new requirement for the on-demand `generateLoanStatement` direct tool and its tool-disambiguation guidance, following the same pattern as the existing "Loan form card" requirement.
- `loan-statement-report`: the "Statement is available from the founder feed and the CLI" requirement changes delivery surface — statements are generated via the founder-copilot chat tool instead of a founder-feed automation-catalog action. CLI parity is unchanged.

## Impact

- `mods/apiserver/src/tasks/catalog.ts` — remove `loan-statement` from the registered `AUTOMATIONS` array.
- `mods/apiserver/src/tasks/automations/loanStatement.ts` — deleted.
- `mods/apiserver/src/api/copilot/toolPolicy.ts` — new direct tool entry, updated tool notes / system prompt disambiguation.
- `mods/apiserver/src/api/reports/createGenerateLoanStatement.ts` — unchanged, reused by the new tool exactly as the CLI/tRPC mutation already do.
- `mods/dashboard/src/founder` — founder-feed task-creation UI no longer offers loan-statement as a schedulable automation; copilot dock gains a statement-download response.
- No database/schema changes.
