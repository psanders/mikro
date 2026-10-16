## 1. Config and shared types

- [ ] 1.1 `@mikro/common` config:
  - optional top-level `classifier` section, a discriminated union on `provider`: `openai-decisions` `{ apiKey, model }` | `chat` `{ vendor, apiKey, model }` (any text model in `MODEL_REGISTRY`);
  - optional `.strict()` `conversationState` section (`actionsEnabled` defaults to false);
  - `getConversationStateConfig()`;
  - never required at startup;
  - tests: boots without both keys, rejects unknown keys.
- [ ] 1.2 Intent, state and resolution enums plus `recordConversationTurn` schema fields, exported from both barrels (`schemas/index.ts` and root `index.ts`).
- [ ] 1.3 `mikro.example.json`: document both keys, commented as "add after the release is live".

## 2. Data

- [ ] 2.1 Additive migration:
  - nullable `intent`, `intent_confidence`, `conversation_state`, `resolution` on `conversation_turns`;
  - new `conversation_states` table (address, state, resolution, resolved_at, repeat_count, pending_opt_out_at, chatwoot_conversation_id, updated_at).
- [ ] 2.2 Update the integration-test `SCHEMA_SQL`, the Prisma client and the seed; confirm `prisma migrate diff` is empty.
- [ ] 2.3 Record, read and upsert functions for turn labels and conversation state (apiserver), with tests.

## 3. Classifier and state reducer (mods/agents)

- [ ] 3.1 Classifier:
  - `DecisionProvider` interface (`ask(input, questions) → answers`, Decisions-API-shaped types);
  - OpenAI Decisions adapter (`POST /v1/decisions`, `gpt-6-luna`; verify numeric limits and error format against the official docs first, they are undocumented today; treat `refusal` as unlabeled);
  - chat-model adapter: structured output, temperature 0, text-only;
  - the intent choice question plus the `settled` / `affirms` / `same_request` predicates over the last 6 turns;
  - code-assigned `media`;
  - `INTENT_MIN_CONFIDENCE` constant;
  - 3 s timeout;
  - unit tests with stubbed providers.
- [ ] 3.2 Pure `nextState(prev, turn, signals)` reducer covering every D4 rule, with table-driven tests built from the audit cases (10-08 Lucía acks, 10-15 Sofía acks, 09-28 opt-out, Santiago out-of-area, videos loop).

## 4. Handler integration, labels only

- [ ] 4.1 Classify routed inbound turns before the agent when `classifier` is set; store the intent and state on the turn and the conversation row; keep `isDecline` / `isHumanRequest` as the fallback.
- [ ] 4.2 Apply agent-turn signals after the reply: finalize outcome, directives, evidence completion, hand-off.
- [ ] 4.3 Tests: nothing changes in replies with actions off; no classifier means no labels and no errors; a timeout falls back.

## 5. Actions, behind `actionsEnabled`

- [ ] 5.1 Chatwoot `resolveConversation` (`toggle_status`), with the id cached on `conversation_states`; best-effort; tests.
- [ ] 5.2 Closing → no agent call, no reply, resolve. A closing on an already-resolved conversation → re-resolve. Any other intent → reopen. Tests.
- [ ] 5.3 Auto-resolve after the echo for `out_of_area`, `rejected_informed`, `intake_complete` and `evidence_complete`; never for `waiting_human`. Tests.
- [ ] 5.4 Opt-out:
  - confirmation directive, pending opt-out with a 24 h expiry;
  - new system transition `applicantCancel` (DRAFT/RECEIVED/IN_REVIEW → ABANDONED), `application.abandoned` event, follow-up jobs cancelled;
  - PENDING_DECISION/APPROVED → hand-off;
  - transition-table, feed narrative and tests.
- [ ] 5.5 Stuck loop: at repeat_count 2 → fixed message, hand-off ("Conversación atascada"), `stuck` label and note, `waiting_human`. Tests (videos, links).
- [ ] 5.6 Agents evals: add closing, opt-out and stuck scenarios for Lucía, Sofía and José; read the outputs, don't trust PASS alone.

## 6. Visibility

- [ ] 6.1 `conversations:export`: intent, confidence, state and resolution columns, plus the summary block.
- [ ] 6.2 Audit: `stuck_loop` and `unresolved` checks; `resolutionCounts` stored on the run; tests.
- [ ] 6.3 Pencil EzobQ sec-09 detail panel: a resolution counts block, card unchanged. Then the dashboard detail panel.

## 7. Backfill and model bake-off

- [ ] 7.1 Protected procedure plus `mikro conversations:classify --since [--phone] [--force]`: idempotent, labels and state only, never actions or Chatwoot. Tests.
- [ ] 7.2 `--dry-run --providers <spec,…>` compare mode: no DB writes; agreement against a hand-labeled sample (overall and for `closing` / `opt_out`), confusion summary, cost (tokens × list price), p50/p95 latency.
- [ ] 7.3 Build the hand-labeled sample (about 60 inbound turns from the 305, every intent represented) as a fixture; the founder checks the labels.
- [ ] 7.4 Run the bake-off: `openai-decisions:gpt-6-luna`, `chat:openai:gpt-4o-mini`, `chat:google:gemini-2.5-flash-lite`, and Jev through its API for comparison only if a key is available. Report agreement, `closing` precision at the threshold, confidence calibration, cost (Spanish tokens) and latency to the founder. Record the provider pick and the final `INTENT_MIN_CONFIDENCE` in design.md D2.

## 8. Verification and rollout

- [ ] 8.1 Suites: common, agents, apiserver, integration, ctl; dashboard typecheck; migration diff empty.
- [ ] 8.2 Update CX_EXPLAINER.md (conversation states, closings, opt-out, stuck).
- [ ] 8.3 Deploy release 1 (labels only). Only AFTER it is live (and after the bake-off), add the `classifier` section to the prod `mikro.json` and restart. A key added before the release crashes the boot, including on rollback (2026-09-18 outage).
- [ ] 8.4 Backfill: run `mikro conversations:classify --since 2026-09-26`. The founder spot-checks the labels over a few days of live traffic.
- [ ] 8.5 Founder go-ahead: add `"conversationState": { "actionsEnabled": true }` to the prod `mikro.json` and restart. Verify in production that a closing gets no reply and the Chatwoot conversation shows resolved.
- [ ] 8.6 Upload the prod `agents.yaml` copy if prompts changed.
