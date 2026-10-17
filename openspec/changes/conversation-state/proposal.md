## Why

The CX agents answer every inbound message, and nothing records where a conversation stands. The 2026-10-15 audit of all 305 stored turns (35 conversations) shows the same gap behind several recurring patterns:

- **Closings get answered, over and over.** Lucía replied to five acknowledgements in a row on 10-08 (+18293913988: "Ok", "Ok", "Ya", "Esta bien", "Gracias"). Sofía answered four on 10-15 (+18492452419: "Siempre", "Gracias usted", "Igual", "Si"), each reply inviting another. José did the same on 09-29 and 09-30. Every one of those replies is a paid LLM call that looks robotic.
- **Opt-outs go nowhere.** On 09-28 +18096944893 wrote "Descártala la solicitud. Por favor", but it sat in an open hand-off and the application was never closed. On 10-11 +18093512229 said "Solo me gustaría un préstamo personal".
- **Dead ends stay open.** Out-of-area guests (Santiago, Santo Domingo) and rejected applicants told their reapply date are finished, but their Chatwoot conversations stay open for a person to close by hand.
- **Stuck loops repeat.** +18093587775 sent Facebook links five times over ten days and Lucía answered each one the same way. +18094283758 and +18098601534 sent videos instead of photos while Sofía kept asking for "una foto" up to five times.
- **Nothing is ever closed.** None of the 14 hand-offs has a `closed_at`, and every Chatwoot conversation stays open until staff resolve it manually.

Keyword lists (`isDecline`, `isHumanRequest`) catch a few phrasings, but the founder wants a holistic answer: understand what each message _is_, keep it as metadata, and let the conversation's state drive replies and Chatwoot.

## What Changes

- **Every inbound turn is classified by a decision model, not a chat LLM.** It is configured in a new optional `cx.classifier` section of `mikro.json`. The default candidate is OpenAI Decisions (`gpt-6-luna`, public beta, on the OpenAI key we already have); a small chat model answers the same questions as the fallback. One request per inbound turn, before the agent runs, asks typed questions over the last few turns:
  - a choice question for the intent (`answer`, `question`, `closing`, `opt_out`, `repeat`, `frustration`, `human_request`, `greeting`, `other`; code labels `media`);
  - yes/no predicates: did the agent's last message settle the matter, does this message confirm what the agent asked, is this the same unusable input again.

  The label, its confidence and the predicate probabilities are stored on `conversation_turns`. Below a confidence threshold, a label never triggers an action. The provider is picked by a bake-off on our Spanish turns. Spanish is untested by every published benchmark.

- **Each conversation has a state.** It is one of `open`, `waiting_customer`, `waiting_human` or `resolved`, plus a resolution reason: `closing`, `opt_out`, `out_of_area`, `rejected_informed`, `intake_complete`, `evidence_complete` or `stuck`. The state is derived from the intents and from signals the agents already emit (finalize outcomes, hand-offs, the out-of-area and rejected directives, evidence completion). It is stored on every turn and on a per-phone row.
- **Actions, behind `conversationState.actionsEnabled` (default off):**
  - A `closing` after a settled exchange is recorded but gets no reply and no agent LLM call, and the Chatwoot conversation is resolved.
  - The conversation is resolved in Chatwoot after the agent's last reply for `out_of_area`, `rejected_informed`, `intake_complete` and `evidence_complete`.
  - A `closing` on an already-resolved conversation (Chatwoot reopens on any incoming message) gets no reply and is resolved again. Anything else reopens it, and the agent answers.
  - `waiting_human` (an open hand-off) is never auto-resolved.
  - An opt-out is confirmed with the person first. On yes, the application is marked abandoned, one goodbye is sent, and the conversation is resolved.
  - After two repeats of the same unusable input, the agent stops repeating and hands off. Chatwoot gets a `stuck` label and a private note. This also covers videos sent instead of photos.
- **Visibility:** `mikro conversations:export` gains intent and state columns plus a count summary. The conversation audit adds `stuck_loop` and `unresolved` findings. The audit card stays verdict-only; the counts per resolution go in the detail panel.
- **Backfill:** a new `mikro conversations:classify --since <date>` command labels stored turns that have no label. It is idempotent and writes labels and state only, never triggering an action. Its `--dry-run --providers …` mode powers a provider bake-off (OpenAI Decisions vs. a small chat model, optionally Jev) before one is chosen.
- **Rollout, labels first:**
  1. Release 1 ships the code with no actions; labels start once the founder adds the `cx.classifier` config after the bake-off.
  2. The founder spot-checks the labels.
  3. The founder sets `actionsEnabled: true`.

## Capabilities

### New Capabilities

- `conversation-state`: intent classification of inbound CX turns, the per-conversation state machine, the actions it drives (no-reply closings, Chatwoot resolution, opt-out confirmation, stuck hand-off), the backfill/bake-off command, and the export columns.

### Modified Capabilities

- `conversation-audit`: new `stuck_loop` and `unresolved` code checks. Resolution counts are shown in the run's detail panel; the card stays verdict-only.

## Impact

- **mods/common:**
  - Config: an optional `cx.classifier` section (discriminated `provider`: `openai-decisions` | `chat`) and an optional `conversationState` section (`actionsEnabled` defaults to false).
  - Intent, state and resolution enums, exported from both barrels.
  - `recordConversationTurn` schema fields.
- **mods/agents:**
  - Pluggable `DecisionProvider` (OpenAI Decisions adapter + chat-model adapter), intent questions, state reducer.
  - Handler: classify before the agent, skip the reply for closings, opt-out confirmation, stuck hand-off.
  - Agents prompts (`agents.yaml`) for the opt-out confirmation and stuck messages.
  - Audit checks.
- **mods/apiserver:**
  - Migration: nullable `intent`, `intent_confidence`, `classification` (JSON), `conversation_state` and `resolution` columns on `conversation_turns`, plus a `conversation_states` table keyed by phone or BSUID.
  - Chatwoot client `resolveConversation` (`toggle_status`).
  - Applicant opt-out transition (RECEIVED and IN_REVIEW → ABANDONED, system actor).
  - Wiring.
- **mods/ctl:** `conversations:classify`, plus export columns and summary.
- **Dashboard:** the audit detail panel shows the counts per resolution. Pencil EzobQ sec-09 must be updated first.
- **Deploy:** both new `mikro.json` keys are optional, and the server boots without them. They must be added to the production `mikro.json` only after the release that knows them is live (2026-09-18 outage: `.strict()` crashes the boot, including on rollback). The production `agents.yaml` is a separate copy that must be uploaded by hand.
- **Out of scope:** unmatched WhatsApp username senders (parked), Lucía stating unchecked statuses, duplicate applications (#302).
