## Context

Three defects surfaced testing José over WhatsApp. Two are in shared code:

- `mods/agents/src/llm/createInvokeLLM.ts` runs the tool loop and, by design, prefers the text a model emits _alongside_ its tool calls over the text it generates _after_ the tool results (`textFromTurnWithToolCall.trim() || getTextFromContent(response.content)`). That heuristic was added for María (admin), whose user-facing reply ("¡Listo! ¿Algo más?") comes with the tool call and whose post-tool turn is empty. José is the opposite: his question/closing is produced after `getApplicationState`/`saveAnswer`, so the heuristic drops it and the prospect must send a filler message to advance.
- `mods/common/src/scoring/engine.ts` flags `OUT_OF_ZONE` when `province.trim().toUpperCase() !== CONFIG.zona_cobertura`. Province is stored as a display string (`"Puerto Plata"` → `"PUERTO PLATA"`); the config zone is the enum key (`"PUERTO_PLATA"`). They never match, so the served province is flagged out-of-zone — corrupting the zone flag for every application and producing José's accept-then-reject contradiction.

The weekend timing copy lives in José's prompt in `agents.yaml` (config, not code).

## Goals / Non-Goals

**Goals:**

- José completes the first question in a single turn.
- An in-zone prospect is never rejected for coverage; `OUT_OF_ZONE` fires only for genuinely out-of-zone provinces, across all applications.
- José's timing line is the generic 24–48 business-hours message.
- María's behavior is unchanged.

**Non-Goals:**

- Date/business-day computation for the timing message (explicitly dropped — generic line only).
- An extra confirmation step for prefilled data (finalizing a genuinely complete application is correct).
- Reworking the scoring model beyond the zone-comparison fix.

## Decisions

**1. Reply mode is a per-agent config field, defaulting to `final`.**
Add `replyMode: "final" | "pre-tool"` to `agentConfigSchema` and the `Agent` type (default `"final"`). In `createInvokeLLM`, the final-response selection branches on it:

- `final`: `getTextFromContent(response.content).trim() || textFromTurnWithToolCall`
- `pre-tool`: `textFromTurnWithToolCall.trim() || getTextFromContent(response.content)` (today's behavior)

Set María `pre-tool` explicitly in `agents.yaml`; José uses the `final` default. New agents get the intuitive agentic behavior (post-tool reply) without thinking about it.
_Alternative considered_: auto-detect (use post-tool text whenever non-empty) — rejected; it would silently change María and couples behavior to model quirks instead of an explicit contract.

**2. Normalize the province on both sides of the zone comparison.**
Add a small `normalizeProvince(s)` in the scoring module: uppercase, strip diacritics, replace any run of non-alphanumerics with `_`, trim leading/trailing `_`. Compare `normalizeProvince(input.province)` against `normalizeProvince(CONFIG.zona_cobertura)` (or pre-normalize the constant). This accepts `"Puerto Plata"`, `"Puerto Plata."`, `"puerto  plata"`, and `"PUERTO_PLATA"` as the served zone. Fix lives in `@mikro/common`, so all scoring paths (José tools, completed-application scoring) get it.
_Alternative considered_: reverse-map display→key via the PROVINCE constant — rejected; normalization is simpler, tolerant of punctuation/casing, and doesn't require the input to be a known enum value.

**3. Timing copy is a prompt edit in `agents.yaml`.**
Replace José's closing/finalization/rejection timing language with "Un asesor la revisará en 24 a 48 horas hábiles." No code, no date logic. Applies on restart (agents are config).

## Risks / Trade-offs

- **Changing the default reply selection could affect future agents** → It only changes the default for _new_ agents to standard agentic behavior; María is pinned `pre-tool` explicitly, so no current behavior changes. José's eval suite (in `agents.yaml`) exercises the new path.
- **Zone fix changes which `OUT_OF_ZONE` flags fire on existing applications** → Intended: it removes false positives for in-zone applicants. Re-scoring is deterministic; any flag change is a correction. Worth a note to reviewers since it touches all applications, not just José.
- **`final` mode could surface an empty reply if the model returns nothing post-tool** → The fallback to `textFromTurnWithToolCall` covers that; behavior degrades to today's at worst.

## Migration Plan

1. Add `replyMode` to schema + `Agent` type + the invoke branch.
2. Add `normalizeProvince` and use it in the `OUT_OF_ZONE` check.
3. Edit `agents.yaml` (+ example): `replyMode` on María (`pre-tool`) and José (`final` or omit), and José's timing copy.
4. Update José's eval scenarios in `agents.yaml` that assert the old weekend/finalization wording.
5. **Rollback**: revert the three code spots and the `agents.yaml` copy; no data migration.
