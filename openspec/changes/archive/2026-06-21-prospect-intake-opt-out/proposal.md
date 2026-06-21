## Why

José (the PROSPECT WhatsApp agent) had no way to honor "no me interesa / déjenme tranquilo". A decline was treated as an off-topic turn, so José re-asked the same intake question — pushy and disrespectful. Worse, when the conversation eventually closed (via the 3-turn stuck timer), `finalizeApplication` marked the application `partial: false` → `RECEIVED`, i.e. the ops dashboard saw a person who said "leave me alone" as a finished application ready for an advisor to call.

This change adds an explicit opt-out path and a terminal `ABANDONED` outcome so declines (and silent drop-offs) are recorded as what they are, never re-engaged, and never shown as completed leads.

While here, this change also writes the first spec for José's conversational intake behavior, which was previously implemented (short-form budget, priority ordering, phone validation, single closing message, policy rejections) but never specified.

## What Changes

- **Opt-out detection**: a conservative deterministic detector in `handleProspectMessage` recognizes explicit declines ("no me interesa", "ya no quiero", "déjenme tranquilo", "cancela", "no, gracias") and injects a directive forcing José to close out. Plain "no" answers to yes/no intake questions are NOT treated as declines.
- **`finalizeApplication` gains an `outcome` argument** (`"complete"` | `"abandoned"`, default `"complete"`). `"abandoned"` sets status `ABANDONED` (terminal) instead of running the complete/`RECEIVED` upsert path.
- **`ABANDONED` status is implemented** in the Prisma `ApplicationStatus` enum and the `@mikro/common` types/Zod enum. (The `loan-application-model` spec already declared `ABANDONED`; the code had drifted — this closes the gap. SQLite stores enums as TEXT, so no SQL migration is required, only `prisma generate`.)
- **Stuck-timer finalize now uses `outcome: "abandoned"`** (3 turns with no useful answer = abandonment), not `complete`. The 7-turn cap still finalizes as `complete` (the prospect engaged and gave real data).
- **Prompt**: new `FLUJO DE NO INTERÉS` section; `TURNOS FUERA DE TEMA` carves out explicit declines; alert handling routes the two system directives to the right outcome.
- **Evals/tests**: a permanent `not-interested-abandon` LLM scenario; unit tests for the abandoned finalize path and the decline detector (including the plain-"no" false-positive guard).

## Capabilities

### New Capabilities

- `loan-application-prospect-intake`: José's conversational WhatsApp intake for prospects with a partial application — short-form budget (ISC ≥ 50 target, max 7 José turns, 2–3 questions per turn), priority-ordered questions, phone validation, a single closing message, policy rejections, and the new opt-out → `ABANDONED` flow.

### Modified Capabilities

- None require requirement edits. `loan-application-model` already specifies the `ABANDONED` status value; this change only brings the implementation in line with it.

## Impact

- `mods/apiserver/prisma/schema.prisma` — add `ABANDONED` to `ApplicationStatus` (no SQL migration; TEXT column).
- `mods/common/src/types/application.ts`, `mods/common/src/schemas/application.ts` — add `ABANDONED` to the `ApplicationStatus` type and `applicationStatusEnum`.
- `mods/apiserver/src/api/jose/createFinalizeApplication.ts` — `outcome` arg; `abandoned` updates status directly.
- `mods/agents/src/tools/definitions.ts` — `finalizeApplication` tool schema gains `outcome`.
- `mods/agents/src/whatsapp/handleProspectMessage.ts` — `isDecline` detector + directive precedence (decline > turn cap > stuck).
- `agents.yaml` — José prompt sections + `not-interested-abandon` eval scenario.
- Tests: `mods/apiserver/test/jose/createFinalizeApplication.test.ts`, `mods/agents/test/whatsapp/handleProspectMessage.test.ts`.
- Follow-up (out of scope): a fresh message from an `ABANDONED` phone routes to GUEST (not re-engaged by José), since `ABANDONED` is not a partial/`DRAFT` status. Policy rejections (out-of-zone, critical) still finalize as `complete`; reclassifying those is left for later.
