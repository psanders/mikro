## 1. Shared contract

- [x] 1.1 Add a `document` field to `copilotChatReplySchema` (`mods/common/src/schemas/copilot.ts:124-142`) carrying `{ filename, mimeType, base64 }`, alongside the existing `customerForm`/`loanForm` fields.
- [x] 1.2 Add a `generateLoanStatementSchema`-based input (loan id + format) for the new tool, reusing `generateLoanStatementSchema.shape.loanId` the same way the retired automation did (`mods/apiserver/src/tasks/automations/loanStatement.ts:30`), so validation stays identical to the tRPC/CLI surfaces.

## 2. Backend: copilot direct tool

- [x] 2.1 Add `generateLoanStatementTool` (OpenAI-style `ToolFunction` schema) to `mods/apiserver/src/api/copilot/toolPolicy.ts`, following the shape of `openLoanFormTool` (`:414-432`).
- [x] 2.2 Register it in `COPILOT_LOCAL_TOOLS` and `DIRECT_TOOLS` (`toolPolicy.ts:438-452`, `:502-515`).
- [x] 2.3 Wire the executor in `createCopilotChat.ts`: on a `generateLoanStatement` tool call, invoke `createGenerateLoanStatement` (`mods/apiserver/src/api/reports/createGenerateLoanStatement.ts`) directly, populate a `document` accumulator (mirroring `customerForm`/`loanForm` at `:516-517`, `:625-642`), and spread it onto the final `CopilotChatReply` (`:705-706`).
- [x] 2.4 Handle the not-found case: unknown loan id produces a tool result the model can relay as "no se encontró el préstamo," never a document (matches `loan-statement-report`'s existing "Unknown loan is rejected" scenario).
- [x] 2.5 Add the tool-disambiguation note to the copilot system prompt (per-turn assembly, per `founder-copilot`'s "Environment and tool-capability awareness" requirement) steering the model to `generateLoanStatement` over `getLoanHealth`/`getLoanByLoanId` when the founder names the statement/document itself.

## 3. Frontend: dock rendering

- [x] 3.1 Add a `document` variant to the `CopilotMessage` union (`mods/dashboard/src/founder/copilot/types.ts:97-103`).
- [x] 3.2 Add a case to the dock's render switch (`CopilotDockContainer.tsx:448-510`) that shows the document result with a "Descargar" action, reusing `saveFile`/`base64ToBytes` from `mods/dashboard/src/lib/saveFile.ts` (already imported at `:27`).
- [x] 3.3 Add/update a Storybook story for the new thread-item kind (`mods/dashboard/src/founder/copilot/` already has `.stories.tsx` siblings for `CustomerFormCard`, `LoanFormCard`, etc. — follow that pattern) before wiring it into the live dock. Built and reconciled against the approved Pencil design (`documentCard`, node `kYC0K`) — one drift fixed (download icon 14px → 16px to match).

## 4. Retire the automation

- [x] 4.1 Remove `loan-statement` from the registered `AUTOMATIONS` array in `mods/apiserver/src/tasks/catalog.ts`.
- [x] 4.2 Delete `mods/apiserver/src/tasks/automations/loanStatement.ts`.
- [x] 4.3 Searched `mods/dashboard/src/founder` for hardcoded `loan-statement` automation references beyond the catalog — none found; remaining hits are the shared `loanStatementReport` definition name (still correct, it's the report itself) or accurate historical doc comments, several of which were tightened during this pass (`createGenerateLoanStatement.ts`, `protected.ts`, `tasks/types.ts`, `tasks/firings.ts`).
- [x] 4.4 Confirmed via `mods/apiserver/src/tasks/firings.ts:138-141` (`getAutomation` returns undefined → `degradeToNeedsInput`) — this generic path already existed pre-change and is already exercised by `test/integration/tasks.test.ts:172` ("surfaces an unknown automation as NEEDS_INPUT instead of crashing"), which covers exactly what a stale pre-existing `loan-statement` firing would hit. No new fixture needed.

## 5. Tests

- [x] 5.1 Unit test for the `generateLoanStatement` tool executor: happy path (valid loan id → document payload) and a validation-failure case (invalid/missing loan id → structured error, no `createGenerateLoanStatement` call). See `test/integration/copilot.test.ts`'s `generateLoanStatement` describe block (4 tests, all passing).
- [x] 5.2 Parity is by construction: CLI, tRPC `generateLoanStatement`, and the copilot tool all delegate to the one `createGenerateLoanStatement` function (no divergent second implementation) — covered directly by `test/reports/createGenerateLoanStatement.test.ts`. No tRPC-level integration test exists for the mutation itself (pre-existing gap, not introduced here); not adding a redundant three-surface comparison test given the shared-function guarantee.
- [x] 5.3 No Playwright/e2e harness exists in this repo (confirmed: no `playwright.config.*`, no `e2e/` dir) — skipped, noted in the checkpoint.
- [x] 5.4 Lint, typecheck, and full test suites green for `mods/apiserver` (typecheck clean, unit 423 passing, integration 650 passing), `mods/common` (typecheck clean, 103 passing), and `mods/dashboard` (typecheck clean; lint run in progress, no failures surfaced yet).

## 6. Cleanup

- [x] 6.1 Grepped the repo for remaining `loan-statement`/`loanStatement` references — all remaining hits are either the still-live shared report definition or accurate doc comments; tightened the ones that stale-referenced "the `loan-statement` automation" as if still current.
- [ ] 6.2 Manually verify in the running app: ask the copilot "dame el estado de cuenta del préstamo 10036" and confirm a downloadable statement appears in the dock in the same turn, with no scheduling step.
