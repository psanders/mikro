## Why

Live testing of José (the WhatsApp prospect-intake agent) surfaced three defects, one of which also corrupts scoring for every loan application:

1. **Wasted first turn.** José announces "déjame revisar tu información" but never asks the first question until the prospect sends a filler message ("Ok"). The text generated _after_ the tool result is discarded.
2. **Accept-then-reject (critical).** A prospect in the served province (Puerto Plata) is told both "tu información está completa" _and_ "solo atendemos negocios en Puerto Plata". The zone check in core scoring compares mismatched formats and flags **every** province as out-of-zone — silently mis-scoring all completed applications, not just José's.
3. **Always-on weekend boilerplate.** José hardcodes "lunes a viernes / fin de semana" timing regardless of the actual day.

## What Changes

- **Reply-mode per agent.** `createInvokeLLM` keeps the text emitted _with_ a tool call and discards the post-tool text. That's right for María (she replies alongside her tool call) but wrong for José (his real question/closing is generated _after_ `getApplicationState`/`saveAnswer`). Add a per-agent `replyMode` (`"final"` | `"pre-tool"`) in `agents.yaml`: José = `final` (use post-tool text, fall back to pre-tool when empty), María = `pre-tool` (current behavior). Default `final`.
- **Fix the zone check (core scoring).** `scoring/engine.ts` compares `province.toUpperCase()` (`"PUERTO PLATA"`, space) against `zona_cobertura` (`"PUERTO_PLATA"`, underscore) — never equal, so `OUT_OF_ZONE` fires for any province set. Normalize the province (uppercase, strip accents, spaces→underscore) on both sides before comparing, so `"Puerto Plata"`, `"Puerto Plata."`, and `"PUERTO_PLATA"` all match the served zone. This corrects the `OUT_OF_ZONE` flag for **all** applications.
- **Drop weekend boilerplate.** Replace José's timing copy in `agents.yaml` with the generic "Un asesor la revisará en 24 a 48 horas hábiles." No date logic.
- **Keep finalize-on-complete.** When a web-prefilled application is genuinely complete, finalizing after the last missing field is correct; only the contradictory rejection is the bug. No extra confirmation step.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `agent-configuration`: agent entries gain an optional `replyMode` field controlling whether the user-facing reply is the post-tool (final) text or the text emitted alongside the tool call.
- `loan-application-scoring`: the `OUT_OF_ZONE` flag SHALL be determined by a normalized province comparison so the served province is never flagged out-of-zone.

## Impact

- **Code**: `mods/agents/src/llm/createInvokeLLM.ts` (reply-mode branch), `mods/agents/src/agents/agentSchema.ts` + `mods/agents/src/llm/types.ts` (`replyMode` field), `mods/common/src/scoring/engine.ts` (province normalization for the zone flag).
- **Config**: `agents.yaml` (+ `agents.yaml.example`) — add `replyMode` to María/José and replace José's timing copy.
- **Behavior**: José completes the first question in one turn; in-zone prospects are no longer rejected; `OUT_OF_ZONE` now fires only for genuinely out-of-zone provinces across all applications.
- **No API/DB changes.** Scoring is deterministic; the fix changes which `OUT_OF_ZONE` flags fire (correcting false positives), so re-scoring existing applications may change zone flags — this is the intended correction.
