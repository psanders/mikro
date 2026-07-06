## Why

The founder copilot has no visibility into its own operating environment or the tools it calls, so it cannot tell "no matching record" apart from "this tool can't do that" — a founder asking for a solicitud by UUID gets told "cliente no encontrado" and is asked for a phone number, because no tool exists for application-by-ID lookup at all (getApplicationState is a session-bound WhatsApp-intake tool, not an ID lookup, and isn't even bound to copilot). Today that kind of gap, along with UI/UX friction the copilot notices in conversation, only gets fixed if someone happens to notice, remember, and file it later — losing the conversation's context. GitHub issue #111 asks for copilot to recognize these gaps in the moment and file them itself.

## What Changes

- Add a `getApplicationById` read tool (wrapping the already-existing `createGetApplication` validated function) so copilot can resolve a solicitud by UUID — the concrete bug behind issue #111, and the reason the "Ver solicitud" feed deep-link into the dock has never actually worked.
- Extend `ToolResult` with an optional `reason` discriminant (`NOT_FOUND` | `UNSUPPORTED` | `VALIDATION_ERROR`) so "no matching record" and "this tool doesn't support that query" stop collapsing into the same generic failure shape. Applied to `getCustomer`, `getCustomerByPhone`, and the new `getApplicationById`.
- Give the copilot system prompt environment/tool awareness: today's date, the founder's name, and a short, targeted set of tool-disambiguation notes (e.g. customer UUID vs. solicitud UUID) — generated from a small metadata map, not an exhaustive auto-doc of every tool.
- Add a `githubFeedback` tool the copilot can call mid-conversation to file a GitHub issue for a bug, a missing capability, or a UI/UX suggestion — reusing the existing Octokit issue-filing wiring behind the human-facing feedback flow, extracted into a shared helper rather than duplicated. Executes inline (no founder confirmation), and the copilot's reply always discloses when it files one.
- View/card improvement ideas are captured as a `ui_suggestion` category on `githubFeedback`, not a new suggestion subsystem — no generic dashboard-card registry exists to hang a richer mechanism off of today.

## Capabilities

### New Capabilities

- `copilot-feedback`: the `githubFeedback` tool — categories, required reasoning field, inline execution, disclosure-in-reply, and reuse of the existing GitHub issue-filing infrastructure.

### Modified Capabilities

- `founder-copilot`: three new requirements — application lookup by ID (closing the concrete bug), tool-result failure discrimination (the `reason` field), and environment/tool-capability awareness in the system prompt.

## Impact

- `mods/agents/src/tools/definitions.ts`, `mods/agents/src/tools/executor/` (new handler + dependency), `mods/agents/src/llm/types.ts` (`ToolResult.reason`)
- `mods/apiserver/src/api/copilot/toolPolicy.ts`, `systemPrompt.ts`, `createCopilotChat.ts`
- `mods/apiserver/src/api/feedback/createSubmitFeedback.ts` (extract shared issue-filing helper), `mods/apiserver/src/trpc/routers/protected.ts` (copilot deps wiring)
- `mods/apiserver/src/index.ts` (wire `getApplication` into the shared tool executor deps)
- No new Prisma models or migrations — `getApplicationById` reuses the existing `LoanApplication` model and `getApplicationSchema`.
