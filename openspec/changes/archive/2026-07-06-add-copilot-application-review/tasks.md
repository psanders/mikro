## 1. Agent tool definitions (@mikro/agents)

- [x] 1.1 Add `approveApplicationTool`, `rejectApplicationTool`, and `deleteApplicationTool` `ToolFunction` definitions to `mods/agents/src/tools/definitions.ts` (Spanish descriptions; params `id`, plus `reason` required for reject and `note` optional for approve). Register all three in `allTools`.

## 2. Executor dependencies + handlers (@mikro/agents)

- [x] 2.1 Add `approveApplication`, `rejectApplication`, and `deleteApplication` function signatures to `ToolExecutorDependencies` in `mods/agents/src/tools/executor/types.ts`, each taking the input plus a `reviewerId` and returning the updated/deleted application `{ id, status }`.
- [x] 2.2 Add handlers `handleApproveApplication.ts`, `handleRejectApplication.ts`, `handleDeleteApplication.ts` in `mods/agents/src/tools/executor/`, reading `reviewerId` from `context.userId`, guarding for a missing dependency/userId, and returning a Spanish `ToolResult` message + `data`.
- [x] 2.3 Register the three handlers in the `handlers` map in `mods/agents/src/tools/executor/index.ts`.

## 3. Copilot tool policy + summaries + prompt (@mikro/apiserver)

- [x] 3.1 Add `"approveApplication"`, `"rejectApplication"`, `"deleteApplication"` to `WRITE_TOOLS` in `mods/apiserver/src/api/copilot/toolPolicy.ts`.
- [x] 3.2 Add a Spanish confirm-card one-liner for each of the three tools in `mods/apiserver/src/api/copilot/summarizeAction.ts` (reject line includes the reason).
- [x] 3.3 Inject `approveApplication`/`rejectApplication`/`deleteApplication` into the tool executor where it is constructed in `mods/apiserver/src/index.ts`, wiring `createApproveApplication(db)` / `createRejectApplication(db)` / `createDeleteApplication(db)`.
- [x] 3.4 Add a reject-over-delete steering line to `mods/apiserver/src/api/copilot/systemPrompt.ts` (prefer `rejectApplication` with a reason for a real decline; reserve `deleteApplication` for dead/spam flows).

## 4. Tests

- [x] 4.1 Unit-test the three executor handlers (sinon-stubbed deps) in `mods/agents/test/tools/`: success path, required-reason failure for reject via schema, and missing-dependency guard.
- [x] 4.2 Extend `mods/apiserver/test/integration/copilot.test.ts` to cover: a reject proposed → confirmed transitions the application to `REJECTED` with the reason stored as `reviewNote` and a `copilot.action` event recorded; the three tools appear in `getBoundToolNames()` / are treated as write tools; an approve confirm transitions to `APPROVED`.
- [x] 4.3 Assert the three tools are classified `isWriteTool` (not read/direct) and that `summarizeAction` produces a non-generic Spanish line for each.

## 5. Verification

- [x] 5.1 `npm run build` (or per-package `tsc`) for `@mikro/agents` and `@mikro/apiserver` passes.
- [x] 5.2 `npm test` for the affected packages passes; lint is clean.
