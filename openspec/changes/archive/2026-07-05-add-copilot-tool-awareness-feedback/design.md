## Context

The founder copilot (`mods/apiserver/src/api/copilot/`) runs a LangChain tool loop (`createCopilotChat.ts`) against a hand-partitioned tool policy (`toolPolicy.ts`: READ / WRITE / DIRECT lists) and a static system prompt (`systemPrompt.ts`). Tool results are a flat `{success, message, data?}` shape (`mods/agents/src/llm/types.ts`) with no way to distinguish "no matching record" from "this tool can't answer that." The dashboard's founder feed already deep-links "Ver solicitud" into the dock with a prefilled _"Muéstrame los detalles de la solicitud `{uuid}`"_ question (`typeConfig.ts:337,364`) — but no bound tool can resolve a solicitud by id today, even though the validated function to do so (`createGetApplication`) already exists and is used internally by the ops dashboard.

Separately, the app already has a full human-facing feedback pipeline (`createSubmitFeedback.ts`): transcribe → LLM-structure → upload artifacts to GitHub via `Octokit` → `octokit.issues.create`, configured through `cfg.githubFeedback.{token,repo}`. Issue #111 asks for the copilot itself to be able to file that same kind of issue, mid-conversation, for bugs, missing capabilities, or UI ideas it notices.

Research into how other agent harnesses solve the adjacent problem (OpenClaw's agent-loop context assembly, its ChatOps low-friction feedback capture) points at two patterns worth borrowing: (1) tool/environment awareness should be assembled as structured data and rendered into the system prompt, not hand-written prose; (2) feedback capture works best as a small set of structured fields the agent fills in from context it already has, not a rigid form or a second LLM pass.

## Goals / Non-Goals

**Goals:**

- Close the concrete bug: solicitud-by-UUID lookups resolve end-to-end.
- Let the model's tool-result handling and prose distinguish "not found" from "can't do that."
- Give the system prompt just enough structured environment/tool context to prevent the customer-vs-application ID confusion class of error, without turning it into an auto-generated wall of documentation.
- Let the copilot file a GitHub issue mid-conversation for a bug, missing capability, or UI idea, with enough context (tool, args, reasoning) to be actionable without re-deriving from scratch, using the existing Octokit wiring.

**Non-Goals:**

- No generic tool-capability auto-documentation system — only a small, hand-curated `TOOL_NOTES` map for the disambiguation cases this issue actually surfaced.
- No proactive/background feedback filing — the model must explicitly call `githubFeedback`; nothing scans conversations or logs on its own in this change.
- No new dashboard-card suggestion subsystem. `typeConfig.ts` is a hand-authored renderer per `BusinessEvent` type with no registry to hang "propose a card" onto; that's a separate, larger effort. UI/UX ideas are filed as `githubFeedback` issues with category `ui_suggestion` and triaged like any other feedback.
- No structured tool-call audit table. The existing `toolsUsed` name-only log on `Message.tools` is unchanged.
- No exhaustive `reason` discrimination across every existing tool handler — only `getCustomer`, `getCustomerByPhone`, and the new `getApplicationById` are required to set it.

## Decisions

### 1. `getApplicationById` wraps the existing `createGetApplication`, no new data layer

`createGetApplication(client)` (`mods/apiserver/src/api/applications/createGetApplication.ts`) already does `client.loanApplication.findUnique({where:{id}})` behind `getApplicationSchema` (`{id?, sessionId?}`, at least one required). The new tool only needs an `id`-only param, a thin executor handler (pattern: `getCustomerByPhone.ts`), a `getApplication` entry on `ToolExecutorDependencies`, and wiring at the single shared `createToolExecutor(...)` call site (`mods/apiserver/src/index.ts:512`). Added to `READ_TOOLS` in `toolPolicy.ts` so it's bound and executes inline like every other read.

- _Alternative considered_: extend `getCustomerByPhoneTool` to also accept an id/UUID param, per the issue's literal wording. Rejected — the two UUIDs in the issue's example are `LoanApplication` ids, not `Customer` ids; conflating the two into one tool would require the model to guess which entity the UUID belongs to inside a single call, whereas today's actual gap is simply a missing tool, cleanly fixed with a matching new one.

### 2. `ToolResult.reason` as an additive, optional discriminant

Add `reason?: "NOT_FOUND" | "UNSUPPORTED" | "VALIDATION_ERROR"` next to `success`/`message`/`data` in `mods/agents/src/llm/types.ts`. Every existing caller of `ToolResult` keeps compiling unchanged (the field is optional and additive). Only the three touched handlers set it:

- `getCustomer` / `getCustomerByPhone` / `getApplicationById`: `reason: "NOT_FOUND"` when the record doesn't exist.
  `UNSUPPORTED` and `VALIDATION_ERROR` are defined now so the type doesn't need another migration the next time a handler needs to express "wrong kind of input" vs. "no rows," but this change does not need to populate them anywhere — no existing handler has that distinction to make yet.
- _Alternative considered_: a full discriminated-union `ToolResult` (`{success:true,...} | {success:false, reason, message}`). Rejected for this change — every existing handler across `mods/agents/src/tools/executor/*.ts` constructs `ToolResult` object literals directly; a union would force touching all of them for a mechanical type change unrelated to this issue's scope. An optional field is the smaller, backward-compatible step; tightening it into a union is a reasonable future refactor once more handlers actually populate `reason`.

### 3. System prompt becomes a builder, fed by a small `TOOL_NOTES` map

`COPILOT_SYSTEM_PROMPT` (a static string) becomes `buildCopilotSystemPrompt({actorName, today})`, appending: today's date, the founder's name if known, and a short block rendering `TOOL_NOTES` entries (a `Record<string,string>` colocated in `toolPolicy.ts`, alongside `READ_TOOLS`/`WRITE_TOOLS`/`DIRECT_TOOLS`) for any bound tool that has one. Seeded with exactly the disambiguation this issue surfaced: `getCustomer` ("usa el UUID del cliente; para solicitudes usa getApplicationById") and `getApplicationById` ("usa el UUID de la solicitud, no el del cliente"). `createCopilotChat.ts` calls the builder once per turn instead of importing the constant.

- _Alternative considered_: assemble the entire tool JSON-schema (names/params/descriptions already sent to the model via `bindTools`) into prose duplicated in the system prompt too. Rejected as redundant — the model already receives full tool schemas through the standard tool-calling channel; what it's missing is _disambiguation_ between similarly-shaped tools, which is what `TOOL_NOTES` targets directly instead of restating what the model already has.

### 4. `githubFeedback` is a DIRECT tool, reusing the existing Octokit path

Classified alongside `createWatchRule`/`disableWatchRule` in `DIRECT_TOOLS`: executes inline, no founder confirmation gate. Filing an internal, unlabeled GitHub issue is not a business-data mutation and is trivially reversible (close the issue) — it doesn't meet the bar that puts `createPayment`/`createLoan`/etc. behind confirmation, and the issue explicitly asks for it to be callable "in the moment," which a confirm-first flow would defeat.

The issue-filing tail of `createSubmitFeedback.ts` (repo parsing, body assembly, `octokit.issues.create`) is extracted into a shared `fileGithubIssue(deps: {octokit, repo}, {title, body})` helper, used by both the existing human `submitFeedback` flow and the new tool. The copilot path skips transcription and LLM-restructuring entirely — it already has structured fields (`category`, `title`, `summary`, `reasoning`) supplied directly by the model, and optional `toolContext` (the triggering tool name/args/`reason`) the loop attaches automatically when `githubFeedback` is called in the same turn as a failed/limited tool call. Handled inline in `createCopilotChat.ts`'s local-tool branch (pattern: `handleCreateWatchRule`), and the loop appends a short disclosure to the reply text whenever it fires (e.g. "Registré esto como una mejora pendiente") so a GitHub issue never appears without the founder being told in the same reply.

- _Alternative considered_: run the same transcribe→LLM-structure pipeline the human flow uses, feeding it the conversation transcript. Rejected — the copilot already _is_ the LLM in this path; asking it to call a tool with structured params and using those directly is strictly less roundabout than serializing the conversation and re-summarizing it through a second model call.

### 5. UI/UX suggestions ride on `githubFeedback`, not a new subsystem

`category: "ui_suggestion"` is one of `githubFeedback`'s four categories (`bug | missing_capability | ui_suggestion | other`). No dashboard-card registry exists to build a richer "propose a card" mechanism on top of (`typeConfig.ts` is a hand-authored `switch` per `BusinessEvent` type), so building one is out of scope here. A later, log-mining pass over filed `githubFeedback` issues and tool-call telemetry (deterministic pattern detection, not another LLM call — the "Capability Evolver" pattern from the OpenClaw research) is the natural way to eventually turn _observed usage_ into proactive suggestions; noted as future work, not started here.

## Risks / Trade-offs

- **[Risk]** `TOOL_NOTES` drifts from reality as tools are added/changed, since it's hand-curated rather than derived. → **Mitigation**: kept deliberately small (only real disambiguation cases); a code-review convention (call out in the PR description) to consider a `TOOL_NOTES` entry whenever two bound tools could plausibly resolve the same kind of user input.
- **[Risk]** The model calls `githubFeedback` too eagerly (filing an issue for something that's actually just "no data" for this founder, not a real gap). → **Mitigation**: `reasoning` is a required param, and the system prompt is updated to state this tool is for real gaps/ideas noticed in conversation, not a catch-all for empty query results; the human review step (unlabeled issue, team triages) is the same backstop the existing feedback flow already relies on.
- **[Risk]** `githubFeedback` firing inline (no confirmation) means an external, team-visible side effect happens without an explicit founder click. → **Mitigation**: constrained to DIRECT-tool blast radius (an issue, not a business mutation) and the reply-text disclosure requirement makes it visible in the same turn, not silent.
- **[Trade-off]** `ToolResult.reason` as an optional field rather than a discriminated union leaves room for handlers to set `success:false` without a `reason` (status quo behavior). Accepted for scope control; tightened later if/when more handlers adopt it.

## Migration Plan

No data migration. Deploys as a normal apiserver release:

1. Land `ToolResult.reason` (additive, no callers break).
2. Land `getApplicationById` (tool definition + handler + dep wiring + `READ_TOOLS` entry).
3. Land the system-prompt builder + `TOOL_NOTES`.
4. Land `fileGithubIssue` extraction (human flow re-verified unchanged) + `githubFeedback` tool + `DIRECT_TOOLS` entry.
   Each lands independently and is individually revertable; no ordering dependency forces them into one deploy.

## Open Questions

- Should `githubFeedback` issues get a distinguishing label (e.g. `from-copilot`) so the team can separate them from human-submitted feedback in triage? Existing convention deliberately files unlabeled (GitHub rejects issue creation for labels that don't exist in the target repo, per `createSubmitFeedback.ts`'s comment) — leaving this as-is for now, revisit if the team wants a `from-copilot` label pre-created in the repo.
