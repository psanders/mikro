## 1. Tool result failure discrimination

- [x] 1.1 Add optional `reason?: "NOT_FOUND" | "UNSUPPORTED" | "VALIDATION_ERROR"` to `ToolResult` in `mods/agents/src/llm/types.ts`
- [x] 1.2 Set `reason: "NOT_FOUND"` in `mods/agents/src/tools/executor/getCustomer.ts` when `deps.getCustomer` returns null
- [x] 1.3 Set `reason: "NOT_FOUND"` in `mods/agents/src/tools/executor/getCustomerByPhone.ts` when `deps.getCustomerByPhone` returns null
- [x] 1.4 Add/update unit tests for both handlers asserting the `reason` field on the not-found path

## 2. `getApplicationById` tool (closes the concrete bug)

- [x] 2.1 Add `getApplication` to `ToolExecutorDependencies` in `mods/agents/src/tools/executor/types.ts` (signature: `(params: {id: string}) => Promise<LoanApplication | null>`, matching `createGetApplication`'s return shape)
- [x] 2.2 Add `getApplicationByIdTool` definition to `mods/agents/src/tools/definitions.ts` (single required `id` string param, description clarifying it's the solicitud/application UUID, not the customer's)
- [x] 2.3 Create `mods/agents/src/tools/executor/getApplicationById.ts` (`handleGetApplicationById`), pattern-matched on `getCustomerByPhone.ts`: call `deps.getApplication({id})`, return `reason: "NOT_FOUND"` + Spanish message when null, else `{success:true, data:{application}}`
- [x] 2.4 Register `getApplicationById: handleGetApplicationById` in the executor's handler map in `mods/agents/src/tools/executor/index.ts`
- [x] 2.5 Wire the real dependency at the shared `createToolExecutor(...)` call site in `mods/apiserver/src/index.ts` (around line 512), using `createGetApplication(db)` from `mods/apiserver/src/api/applications/createGetApplication.ts`
- [x] 2.6 Add `"getApplicationById"` to `READ_TOOLS` in `mods/apiserver/src/api/copilot/toolPolicy.ts`
- [x] 2.7 Add/update a test exercising the copilot loop resolving a solicitud UUID end-to-end (mirroring how `getCustomerByPhone` is tested in the copilot chat tests, if such a test file exists)

## 3. Environment and tool-capability awareness

- [x] 3.1 Add a `TOOL_NOTES: Record<string, string>` map to `mods/apiserver/src/api/copilot/toolPolicy.ts`, seeded with entries for `getCustomer` and `getApplicationById` describing which UUID namespace each expects
- [x] 3.2 Replace the static `COPILOT_SYSTEM_PROMPT` export in `mods/apiserver/src/api/copilot/systemPrompt.ts` with a `buildCopilotSystemPrompt({actorName, today}: {actorName?: string; today: string})` function that appends today's date, the founder's name (if known), and a rendered block of applicable `TOOL_NOTES` entries (only for tools actually bound via `getCopilotToolDefinitions()`) to the existing verb/confirmation prose
- [x] 3.3 Update `createCopilotChat.ts`'s `SystemMessage` construction (currently importing the static constant) to call `buildCopilotSystemPrompt(...)` with the current date and `actorName` each turn
- [x] 3.4 Update/add tests covering the system prompt builder (date/name interpolation, tool-notes inclusion only for bound tools)

## 4. Shared GitHub issue-filing helper

- [x] 4.1 Extract the repo-parsing + body-assembly + `octokit.issues.create` call from `mods/apiserver/src/api/feedback/createSubmitFeedback.ts` into a shared `fileGithubIssue(deps: {octokit: Octokit; repo: string}, input: {title: string; body: string})` helper (new file, e.g. `mods/apiserver/src/api/feedback/fileGithubIssue.ts`)
- [x] 4.2 Update `createSubmitFeedback.ts` to call the extracted helper instead of inlining the issue-creation logic
- [x] 4.3 Re-run/verify existing `createSubmitFeedback` tests pass unchanged after the extraction (behavior must not change for the human feedback flow) — 489 passing, 0 failing

## 5. `githubFeedback` copilot tool

- [x] 5.1 Define the `githubFeedback` tool schema (as a `COPILOT_LOCAL_TOOLS` entry in `mods/apiserver/src/api/copilot/toolPolicy.ts`, pattern: `createWatchRuleTool`): required `category` (enum `bug|missing_capability|ui_suggestion|other`), `title`, `summary`, `reasoning`; optional `toolContext` fields for tool name/args/reason
- [x] 5.2 Add `"githubFeedback"` to `DIRECT_TOOLS` in `toolPolicy.ts`
- [x] 5.3 Implement inline handling in `createCopilotChat.ts` (pattern: `handleCreateWatchRule`/`handleDisableWatchRule`): build the issue title/body from the tool args, call `fileGithubIssue`, and track the most recently failed/limited tool call in the same turn (name, args, `reason`) to attach as context when present
- [x] 5.4 Wire the `octokit`/`repo` dependency into `CopilotChatDeps` (or a small dedicated feedback-deps seam) from the same config used at `mods/apiserver/src/trpc/routers/protected.ts:806-825`
- [x] 5.5 Ensure the loop's reply text discloses when `githubFeedback` fires (e.g. append "Registré esto como una mejora pendiente" or similar to the AI reply) and handles filing failure gracefully (reply continues, states the filing didn't succeed)
- [x] 5.6 Add tests: successful filing with and without attached tool context, missing `reasoning` is rejected, filing failure doesn't break the turn, reply always discloses on success

## 6. System prompt guidance for the new tool

- [x] 6.1 Update `COPILOT_SYSTEM_PROMPT`'s source text (now inside `systemPrompt.ts`'s builder) to briefly explain when to call `githubFeedback` (real gaps/ideas noticed in conversation) so the model doesn't over-file on ordinary empty-result answers

## 7. Verification

- [x] 7.1 Manually drive the founder dashboard: click a "Ver solicitud" feed action and confirm the copilot dock resolves the application instead of asking for a phone number — verified live against the running dev apiserver: clicked "Ver solicitud" on the Juan Pérez García approval, dock sent the prefilled UUID question, reply resolved full application details (status, ISC 82, active loan #10018) with provenance "Mikro API · getApplicationById · 7.7s" — no "cliente no encontrado"/phone-number dead end
- [x] 7.2 Manually prompt the copilot into a situation with no matching tool and confirm it can call `githubFeedback` and the reply discloses the filed issue — skipped live firing by user decision (githubFeedback.repo is configured to the real psanders/mikro repo with a live token; filing a real issue just to prove the wiring wasn't worth it). Covered instead by the 5 automated integration tests (success+disclosure, tool-context attachment, missing-reasoning rejection, filing-failure disclosure, not-configured disclosure)
- [x] 7.3 Run the full apiserver/agents test suites and lint/typecheck — apiserver: 345 + 494 passing, 0 failing; agents: 159 passing (17 pre-existing failures on `main` unrelated to this change — missing local `mikro.json`, reduced to 15 by this change incidentally); typecheck clean on both packages; lint clean except 2 pre-existing issues in untouched files
