## Context

The agents mod has one active agent: María (ADMIN users only). The WhatsApp message handler routes by phone lookup — customer → ignored, user/ADMIN → María, user/COLLECTOR → ignored, unknown → ignored. Prospects with partial loan applications currently fall through to "ignored".

The scoring engine (`mods/common/src/scoring/engine.ts`) is pure, synchronous, and side-effect-free. `scoreInput()` takes a `ScoreInput` struct and returns an `ApplicationScore` with an `isc` (0–100 float). It can be called in-process on every agent turn at zero cost.

Key constraint: `partial: true` in `scoreInput()` unconditionally adds an `INCOMPLETE_DATA` flag and forces `recommendation: MANUAL_REVIEW`. The `isc` number itself is independent of this flag. Therefore the "score ≥ 80" gate must be evaluated with `partial: false` in the input — a simulation, not a write.

`createFindLatestApplicationByPhone` is already built and exported from the apiserver. It returns `{ sessionId }` or null.

## Goals / Non-Goals

**Goals:**

- Route inbound WhatsApp messages from prospect phones to José.
- Qualify fast: province, business type, monthly sales checked before full intake.
- Collect remaining fields conversationally; exit early when `isc ≥ 80` (simulated).
- Finalize application (`partial: false`) on exit (success, all-filled, or stuck).
- Keep all existing routes (María, customers, collectors) completely unchanged.

**Non-Goals:**

- Post-finalization general Q&A (separate feature; José sends a closing message and stops).
- Background/time-based finalization (no cron; stuck = turns exhausted, not a timer).
- Sending the WhatsApp promo template to José's prospects (already handled by the promo flow).
- Any dashboard or DB schema changes.

## Decisions

### 1. New route type: `prospect`

Add a `prospect` variant to `RouteResult`:

```ts
| { type: "prospect"; sessionId: string; partial: boolean; phone: string }
```

`RouterDependencies` gets one new optional dep: `findApplicationByPhone`. The router check runs only for the `unknown` branch (after customer + user checks pass), so existing routes are zero-touch.

**Why not reuse `user`?** The user type carries a userId and role, which José doesn't need. A dedicated type keeps the handler's branching explicit.

### 2. Separate agent constant: `AGENT_JOSE`

`constants.ts` gains `AGENT_JOSE = "jose"`. José has his own `Agent` definition: a focused Spanish system prompt, no access to María's financial tools, and a small set of intake-specific tools. `ROLE_TO_AGENT` is not changed — José is prospect-routed, not role-routed.

### 3. José's tool set (three tools only)

| Tool                  | Purpose                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getApplicationState` | Fetches current rawData + stable fields; computes which of the 26 fields are filled/missing; runs score simulation (partial: false). Returns a structured snapshot the LLM uses as context. |
| `saveAnswer`          | Upserts one or more field values via the existing `upsertApplication` pipeline (partial: true). Called after the prospect confirms an answer.                                               |
| `finalizeApplication` | Upserts with `partial: false`; triggers re-score in the DB pipeline. Sends the closing message. Called exactly once per conversation.                                                       |

No financial tools, no payment tools, no admin tools.

### 4. State is the DB row, not conversation memory

José re-calls `getApplicationState` at the start of each turn to get the freshest field snapshot. This means:

- Restarts are transparent (no lost state).
- If the prospect fills something on the website simultaneously, José sees it.
- Conversation history (in-memory session store) is still used for multi-turn context, but it's not the source of truth for what's been collected.

**Why not inject state into the system prompt once per session?** Too stale. If the session restarts or the prospect filled fields via another channel, a stale injection misleads the LLM.

### 5. Qualifying gates run first via system prompt + tool, not hardcoded branching

The system prompt instructs José to call `getApplicationState` on every first message, then evaluate province and businessType before anything else. The gate logic lives in the prompt + José's reasoning, not in hard TypeScript branches. This keeps the agent flexible (prompt updates don't require code changes) while the prompt is explicit about the rules.

**Why not hardcode the gate in TypeScript?** Province and business-type checks are policy decisions that may evolve. Keeping them in the prompt reduces future churn.

### 6. "Stuck" = 4 consecutive turns with no new field saved

After `saveAnswer` is not called for 4 consecutive turns (prospect is off-topic, unresponsive, or confused), José's system prompt instructs it to finalize with what is available and send the closing message.

The LLM tracks this via tool call history in the conversation — no separate counter needed.

### 7. Conversation history: in-memory, phone-keyed

Same session store (`isNewSession`/`touchSession`) used for guests. No DB persistence for José's conversation turns. Rationale: José's conversations are short (< 20 turns), state is in the DB row, and DB-persisted chat history would require a new table (no userId foreign key for prospects).

If longer-term memory is needed later, a `prospectChatHistory` table can be added as a follow-up.

### 8. Closing message template

```
¡Listo[, {firstName}]! Tu información está completa.
Un asesor de Mikro la revisará y te contactará en horario laboral
(lunes a viernes). Si nos escribes en fin de semana, respondemos
el lunes. ¡Gracias por tu interés!
```

`firstName` included when available. Sent via `finalizeApplication` tool, then José stops processing intake for that phone (route returns `prospect` with `partial: false` → hold path).

### 9. Out-of-zone and critical-business exits

System prompt instructs José to finalize immediately with a specific message:

- **Out of zone**: "Gracias por escribirnos. Por el momento solo atendemos negocios en Puerto Plata. Si en el futuro expandimos nuestra cobertura, te avisamos."
- **Critical business**: "Gracias por tu interés. En este momento no podemos procesar solicitudes para ese tipo de negocio."

Both trigger `finalizeApplication` (marks `partial: false` so the reviewer sees the record and knows it was declined at intake). A `declineReason` field could be added later; for now the reviewer sees the empty/minimal application.

## Risks / Trade-offs

- [LLM may hallucinate field values] → `saveAnswer` validates values against `applicationPayloadSchema` before persisting. Invalid values are not saved; José re-asks.
- [Province/businessType gate in prompt can drift from engine logic] → Score simulation runs on every turn as the ground truth; the prompt gate is just for speed (avoids asking 10 questions before detecting out-of-zone).
- [In-memory conversation history lost on restart] → José's state lives in the DB row. A restart mid-conversation means José re-greets, but no data is lost.
- [Prospect could be a customer AND have a partial app] → Customer check runs before prospect check in the router. Existing customers always route to "ignored" (customer path) even if they have a partial app. This is correct behavior.
- [finalizeApplication called twice] → `upsertApplication` is idempotent (upsert by sessionId). Double finalization is safe.

## Migration Plan

Purely additive. No existing route changes, no DB schema changes, no dashboard changes.

1. Add `AGENT_JOSE` constant and prospect tools.
2. Add `prospect` route type + router lookup.
3. Wire prospect branch in `handleWhatsAppMessage`.
4. Add José's agent definition and system prompt.
5. Deploy. José activates immediately for any phone with a partial application that messages in.

Rollback: remove the `prospect` branch in the router (one-line change). Unknown phones fall back to "ignored" as before.

## Open Questions

- **Minimum fields for finalization when stuck**: currently "all 26 fields asked at least once OR score ≥ 80". Should there be a lower bound (e.g., at least firstName + phone before finalizing)? Phone is always known (the sender); firstName is a fast first question. Recommendation: finalize regardless — the reviewer can follow up.
- **Decline logging**: out-of-zone and critical-business declines currently leave a sparse record. Should José write a `declineNote` to `rawData`? Deferred to implementation.
