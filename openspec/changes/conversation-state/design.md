## Context

CX WhatsApp turns are persisted in `conversation_turns` (#303). The handler (`mods/agents/src/whatsapp/handleWhatsAppMessage.ts`) routes each inbound message to Lucía, José, Sofía or Carmen. Every routed message gets an agent reply unless a hand-off is open or no agent is enabled.

The only intent detection today is regex: `isDecline` (José) and `isHumanRequest`. Hand-offs (`conversation_handoffs`) expire through `expiresAt` and are never closed (`closedAt` is always null).

The Chatwoot client (`mods/apiserver/src/api/chatwoot/chatwootClient.ts`) can find a contact's open conversation, add labels and post private notes. It cannot change a conversation's status.

Several existing behaviours already mark an exchange as finished, but nothing ties them together:

- José's `finalizeApplication` (`complete` / `abandoned` / `intake_closed`);
- the out-of-area and rejected-applicant directives;
- `evidenceCompletedAt` on the application.

## Goals / Non-Goals

**Goals:**

- One holistic signal per inbound turn (intent), stored as metadata, instead of more keyword lists.
- A per-conversation state with a resolution reason, derived in code from intents and existing agent signals.
- Behaviour driven by state: no reply to closings, Chatwoot resolution, opt-out confirmation, stuck hand-off.
- Ship labels before actions, and let the founder pick the classifier model from measured results.

**Non-Goals:**

- Unmatched WhatsApp username senders (parked by the founder).
- Lucía stating application statuses she didn't look up.
- Duplicate applications (#302).
- Capturing staff replies typed in Chatwoot (still deliberately not stored, #303).

## Decisions

### D1. Classify every inbound turn with a decision model, before the agent

The classifier is a separate call that runs before the agent. It must run first so a `closing` can skip the agent call entirely; a label emitted by the agent itself would come too late to save the reply.

It is a **decision model**, not a chat LLM. Decision models (OpenAI Decisions, TypeSafe Jev, Microsoft Decision-1) answer typed questions:

- _choice_: one of a fixed set of options, with probabilities and a confidence;
- _predicate_: yes/no, as a probability;
- _score_: a position on an ordered scale.

They can't return a value outside the schema, are priced on input only, and answer in a few hundred ms. That fits a per-message label better than a chat call with structured output.

**One request per inbound turn.** The shared `input` is:

- the last 6 turns (agent and inbound, sign-offs stripped);
- the routed profile;
- the new message.

The request asks independent questions in parallel:

| name           | type                                                                                                                                                                                                            | used for                                                  |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `intent`       | choice: `answer`, `question`, `closing`, `opt_out`, `repeat`, `frustration`, `human_request`, `greeting`, `other`, each with a Spanish-context description                                                      | the turn's label                                          |
| `settled`      | predicate: "El último mensaje del AGENTE ya resolvió lo que la persona necesitaba o cerró el tema … Una pregunta de cortesía como '¿Hay algo más en lo que pueda ayudarte?' NO cuenta como pregunta pendiente." | closing vs. answer: an "Ok" after a question is an answer |
| `affirms`      | predicate: "El mensaje confirma lo que el agente preguntó"                                                                                                                                                      | opt-out confirmation (D5)                                 |
| `same_request` | predicate: "El mensaje repite el mismo contenido no útil que el agente ya rechazó"                                                                                                                              | stuck loops                                               |

The founder's label set was extended with two intents:

- `greeting`: 29 of 35 audited conversations open with a bare greeting ("Hola", "Saludos", "Buenas"). A greeting must never be read as a closing, and after a resolution it is what reopens the conversation.
- `other`: the safe fallback, which never triggers an action.

`media` is not asked of the model. **Code sets `media`** for image, video, audio and unsupported messages with no caption, and those turns skip the call. Prior media turns appear in the input as placeholders.

**Stored on the turn:**

- `intent` and `intent_confidence` (the choice answer's `confidence`);
- the predicate probabilities, in a `classification` JSON column.

The JSON is kept so the reducer, the backfill and the bake-off see the same numbers.

**Confidence threshold:** a code constant `INTENT_MIN_CONFIDENCE = 0.7`. It is deliberately not a `mikro.json` key: a strict config key that lands before its release crashes the boot. Two rules use it:

- an intent below the threshold is treated as `other`;
- a predicate below it counts as false.

So a low-confidence label never triggers an action. The bake-off (D2) re-picks the number from our labeled data, as every source advises. If it moves, a one-line change ships with the model choice.

**Fallback without a classifier:**

- When `classifier` is missing from `mikro.json`, classification is skipped. No crash, no labels.
- The existing `isDecline` / `isHumanRequest` matchers keep working as today.
- They also act as the fallback when the call fails, refuses (a `refusal` answer) or exceeds its 3 s budget.
- A failed classification never blocks or delays a reply beyond that budget.

### D2. A pluggable decision provider, picked by a bake-off

**Config:** a new optional top-level `classifier` section, kept separate from `llm.*` (which is chat models). It is a discriminated union on `provider`:

- `openai-decisions`: `{ provider, apiKey, model }`, where `model` is `gpt-6-luna`, the only model the endpoint accepts today.
- `chat`: `{ provider, vendor, apiKey, model }`. Any text model in `MODEL_REGISTRY` answers the same questions through structured output (choice → enum plus confidence, predicates → probabilities). This is the fallback and the baseline.

`typesafe-jev` is reserved as a later provider behind the same interface. It would add a new dependency and vendor, so it is out of scope unless the bake-off makes the case.

**Interface:** `DecisionProvider.ask(input, questions) → answers`, mirroring the Decisions API types. The handler, backfill and bake-off only see this interface.

**OpenAI Decisions API shape (verified 2026-10-16 on developers.openai.com/api/docs/guides/decisions):**

- Request: `POST /v1/decisions` with `{ model: "gpt-6-luna", input: string | [user messages with input_text / input_image parts], questions: [...] }`.
- Each question has a unique `name`:
  - `predicate`: `type`, `name`, `instructions`;
  - `choice`: also `choices`, each `{ value, description }`;
  - `score`: also `levels`, each `{ label, description }`, lowest to highest.
- Response: `{ answers: [...] }`, matched to questions by `name`:
  - predicate → `probability`;
  - choice → `choice`, `probabilities[{value, probability}]`, `confidence`;
  - score → `score`, `probabilities`, `confidence`;
  - a `refusal` type is also possible.
- Pricing: $0.10 per 1M input tokens, with no output or cache charges.
- **To verify:** numeric limits (questions per request, choices, sizes) and error formats are not documented.

**Why a different provider than the agents:** the agents run on Anthropic, and on 2026-10-15 an Anthropic credit outage produced three error replies in a row. The OpenAI key is already configured, so a classifier there does not fail together with the agents.

**Risks:**

- The Decisions API is a public beta (GA "in the coming weeks"), so its shape may still change; the provider adapter isolates it.
- `gpt-6-luna` is an alias, not a pinned snapshot.
- Spanish is untested by every source: the akitaonrails benchmark covered English and Brazilian Portuguese only.

**Bake-off before choosing (no default is hardcoded):**

1. `mikro conversations:classify --dry-run --providers <spec,…>` runs every inbound turn of the 305 stored turns through each candidate and writes nothing. The candidates are:
   - `openai-decisions:gpt-6-luna`;
   - a small chat model, `chat:openai:gpt-4o-mini` or `chat:google:gemini-2.5-flash-lite`;
   - optionally Jev through its API, for comparison only, if a key is available.
2. The founder hand-labels about 60 inbound turns (every intent represented, in our Dominican Spanish), stored as a test fixture.
3. The command reports, per candidate:
   - agreement, overall and for `closing` / `opt_out`;
   - precision of `closing` at the threshold;
   - a confusion summary;
   - how confidence is calibrated against correctness;
   - cost, with Spanish token counts;
   - p50/p95 latency.
4. The founder picks the provider and model, and it goes into `mikro.json` after the release. The choice and the final threshold are recorded here.

**Bake-off result (2026-10-16, all 179 stored inbound turns, provisional hand labels):**

|                                                             | OpenAI Decisions `gpt-6-luna`    | chat `gpt-4o-mini`                                               |
| ----------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------- |
| Agreement with hand labels (150 model-labeled turns)        | 85% (127)                        | 71% (106)                                                        |
| On the 111 unambiguous turns                                | 95% (106)                        | 82% (91)                                                         |
| Accuracy at confidence ≥ 0.7 / ≥ 0.9                        | 97% (101/104) / 100% (82/82)     | 70% / 70% (confidence ≈ 0.95 on almost everything)               |
| Turns below 0.7 (become `other`)                            | 31%                              | 1%                                                               |
| `closing` that would act (intent ≥ 0.7 and `settled` ≥ 0.7) | 24 of 34, 0 wrong                | 39, 6 wrong (real answers like "Ahora mismo", "Ok" to a request) |
| Cost / latency for 179 turns                                | $0.0139 · p50 236 ms, p95 469 ms | $0.0181 · p50 815 ms, p95 1.2 s                                  |

- **Calibration:** the decision model's confidence is meaningful; the chat model's is not. A chat classifier at the same threshold would have silently dropped 6 real replies.
- **The `settled` predicate:** the first wording read a courtesy "¿Hay algo más…?" as an open question, and only 12 of 34 closings would have acted. The wording above raises that to 24 with no false positives.
- **Recommendation:** `openai-decisions:gpt-6-luna`, `INTENT_MIN_CONFIDENCE = 0.7` (kept). Its low-confidence share is mostly messages answering staff replies typed in Chatwoot, which are not stored.

**Sources:**

- https://developers.openai.com/api/docs/guides/decisions (official API shape)
- https://letsdatascience.com/news/openai-opens-decisions-api-public-beta-b69a1e40 (beta announcement, pricing, input limits)
- https://www.it-connect.fr/jev-typesafe-ia-decisions-typees-llm/ (Jev: typed questions, $0.042/M input, English-first)
- https://akitaonrails.com/2026/10/10/qual-modelo-de-decisao-classificador-de-ia-tipo-jev-e-melhor/ (23-model benchmark on a small synthetic EN/PT-BR set; compact accuracy OpenAI Decisions 90.5%, Jev and Microsoft Decision-1 97.6%; OpenAI Decisions had the lowest hosted median latency, ~222 ms)

### D3. Where labels and state live

- **`conversation_turns`** gets new nullable columns:
  - `intent`, `intent_confidence` and `classification` (JSON: the predicate probabilities and the provider/model used), on INBOUND turns;
  - `conversation_state` and `resolution`, the state after the turn, on every turn.

  Turn-level state makes the export and the audit replayable without recomputing.

- **New `conversation_states` table**, one row per address (phone or BSUID), holding:
  - `state`, `resolution`, `resolved_at`;
  - `repeat_count`, `pending_opt_out_at`;
  - `chatwoot_conversation_id`, cached when known.

  The handler reads this row instead of recomputing from history on every message.

- The migration is additive, with nullable columns and a new table. Rolling back to an older release is safe because the old code ignores them. The integration-test `SCHEMA_SQL` is hand-maintained and must be updated too.

### D4. State reducer, in code

A pure function `nextState(prev, turn, signals)` decides the state, so it is unit-testable and reused by the handler, the backfill and the audit. The signals come from the routed profile and the tools the agent ran this turn.

**After an inbound turn:**

- A `closing` with `settled` true (the agent's last message closed the matter and expects nothing) → `resolved` / `closing`.
- A `closing` with `settled` false (for example an "Ok" right after an agent question) is an answer: the state stays `open`.
- `human_request` → handled by the existing hand-off path → `waiting_human`.
- `opt_out` → set `pending_opt_out_at`, state stays `open`.
- `repeat`, or the `same_request` predicate true → increment `repeat_count`.
- Any other intent resets `repeat_count`, and on a resolved conversation moves it back to `open` (reopen).

**After the agent turn:**

- `finalizeApplication` → `complete` on an out-of-area application → `resolved` / `out_of_area`.
- `finalizeApplication` → `complete` otherwise → `resolved` / `intake_complete`.
- `finalizeApplication` → `abandoned` → `resolved` / `opt_out`.
- The guest route carried the out-of-area directive → `resolved` / `out_of_area`.
- The guest route carried the rejected directive (`reapplyFrom`) → `resolved` / `rejected_informed`.
- `evidenceCompletedAt` set during this turn → `resolved` / `evidence_complete`.
- A question was asked → `waiting_customer`.
- An open hand-off always wins → `waiting_human`.

Resolution is about the conversation, not the application: a reopened conversation keeps its application.

### D5. Actions behind `conversationState.actionsEnabled`

`conversationState` is an optional, `.strict()` section of `mikro.json`. Its one key is `actionsEnabled`, a boolean that defaults to false.

When it is off, labels and state are stored and the reply path is exactly today's.

When it is on:

- **Closing:** record the inbound turn, send no reply, make no agent LLM call, resolve in Chatwoot.
- **Re-resolve:** a `closing` arriving while the state is `resolved` (Chatwoot reopened it on the incoming message) gets no reply and is resolved again immediately, so it doesn't return to the team's queue.
- **Auto-resolve after the reply:** when the state became `resolved` for `out_of_area`, `rejected_informed`, `intake_complete` or `evidence_complete`, the conversation is resolved in Chatwoot once the agent's reply is sent and echoed (the echo must land first, or Chatwoot reopens it).
- **`waiting_human` is never auto-resolved.** Resolving a hand-off stays a person's job.
- **Opt-out:**
  1. The agent gets a directive to ask for confirmation, for example "¿Confirmas que quieres cancelar tu solicitud?".
  2. If the next inbound turn is an `answer` or `closing` with the `affirms` predicate true, the application moves to ABANDONED, the agent sends one short goodbye, and the conversation is resolved with reason `opt_out`.
  3. Any other reply clears `pending_opt_out_at`, and the conversation continues.
  4. A pending opt-out expires after 24 h.
- **Opt-out transition:** today only a DRAFT can be abandoned (José's `finalizeApplication`), and `withdraw` is APPROVED-only and staff-only. This change adds a system transition, `applicantCancel`: RECEIVED or IN_REVIEW → ABANDONED, actor = system (the agent). It records a business event (`application.abandoned`, actor "Solicitante por WhatsApp") so the feed and the assigned reviewer see it. PENDING_DECISION and APPROVED are not cancelled automatically: they hand off with reason "Quiere cancelar su solicitud".
- **Stuck loop:** when `repeat_count` reaches 2, the agent is not invoked. A fixed message ("Te voy a pasar con una persona del equipo para ayudarte con esto.") is sent and a hand-off opens (reason "Conversación atascada", the recent turns in the note). Chatwoot gets the `stuck` label. The state becomes `waiting_human`.

### D6. Chatwoot resolution

The new client method `resolveConversation(conversationId)` calls `POST /conversations/{id}/toggle_status` with `{ status: "resolved" }`. The conversation id comes from the existing `findConversationId(address, username)`, cached on `conversation_states`.

It is best-effort, like the note and echo paths: a failure is logged and recorded on the turn (`chatwootResolved: false` in the turn's state metadata), and the reply flow is never failed.

### D7. Visibility

- **Export:** `mikro conversations:export` adds intent, confidence, state and resolution per turn. `--format conversations` prints a summary block with counts per intent and per resolution.
- **Audit checks**, added to the registry:
  - `stuck_loop` (warning): `repeat_count` reached 2, or 3 consecutive identical agent requests, with no hand-off.
  - `unresolved` (warning): a conversation that is not `waiting_human`, whose last turn is older than 48 h, and whose state is not `resolved`.

  Both count toward the existing "N de M no cumplen" headline.

- **Detail panel:** the run gets `resolutionCounts`, shown in the detail panel only. The card stays verdict-only, per founder decision #307.

### D8. Backfill

`mikro conversations:classify --since <date> [--phone] [--dry-run] [--providers]`:

- labels INBOUND turns with a null `intent`, oldest first per phone;
- recomputes turn state and the `conversation_states` row;
- is idempotent: labeled turns are skipped unless `--force`;
- never sends messages, never touches Chatwoot, never transitions applications.

It goes through a new apiserver protected procedure, so the API key stays on the server. `--dry-run` writes nothing and powers the bake-off (D2).

## Risks / Trade-offs

- **A real answer misread as `closing` silently drops a reply.** Mitigation:
  - actions are off until the founder spot-checks;
  - the 0.7 confidence floor;
  - a closing with `settled` false is never a resolution;
  - the bake-off measures `closing` precision specifically.
- **Latency:** one extra call per inbound message, with a 3 s budget and fallback. Text-only small models typically answer in under 1 s.
- **Cost:** one small call per inbound message (179 inbound turns in 18 days, about 70 per week). The bake-off reports the real figure before a model is chosen.
- **Chatwoot reopen race:** the echo of our own reply could reopen a just-resolved conversation. Mitigation: resolve only after the echo call returns, and re-resolve on the next `closing`.
- **Config `.strict()` boot crash.** Mitigation:
  - both keys are optional;
  - the deploy runbook adds them only after the release is live;
  - a rollback must remove them first.
- **The agents.yaml copy:** prod reads its own `agents.yaml`. The opt-out confirmation and stuck wording use fixed messages or directives in code, so prod's `agents.yaml` copy only needs updating if prompt changes ship.

## Migration Plan

1. **Release 1:**
   - Schema migration (additive).
   - Classifier and state code, with actions off.
   - The `conversations:classify` and export changes.
   - Audit checks.
   - Deploy as usual.
2. **After release 1 is live:**
   - Run the bake-off (`--dry-run --providers`) and the founder's hand-labeled sample.
   - Pick the model.
   - Add the `classifier` section to prod `mikro.json` and restart. Labels start.
3. **Backfill:** run `mikro conversations:classify --since 2026-09-26`.
4. **Spot-check:**
   - The founder reviews the labels (export summary and a sample) over a few days of live traffic.
   - Then add `"conversationState": { "actionsEnabled": true }` and restart.
5. **Rollback:**
   - Set `actionsEnabled: false`, or remove the section; no deploy needed.
   - A code rollback needs both new keys removed from `mikro.json` first.

## Open Questions

- Should PENDING_DECISION / APPROVED opt-outs also auto-cancel, rather than hand off (D5)? The design hands them off because a decision is in flight. The founder may prefer cancel-and-notify.
