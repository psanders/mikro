## ADDED Requirements

### Requirement: Every inbound CX turn is classified with an intent

When the `classifier` section is configured, the system SHALL classify every routed inbound CX turn before invoking the agent, with one decision request. That request SHALL take the message and the last 6 turns as input, and SHALL ask a choice question for the intent plus the yes/no predicates `settled`, `affirms` and `same_request`. The system SHALL store `intent`, `intent_confidence` and the predicate probabilities on the turn. An intent or predicate below the confidence threshold SHALL never trigger an action.

The intent SHALL be one of `answer`, `question`, `closing`, `opt_out`, `repeat`, `media`, `frustration`, `human_request`, `greeting` or `other`. Media messages without text SHALL be labeled `media` in code, without a model call.

When the `classifier` section is not configured, classification SHALL be skipped and replies SHALL behave as before. A classifier error, a refusal, or a response slower than 3 seconds SHALL leave the turn unlabeled and SHALL NOT block the reply.

#### Scenario: Thanks after the agent's goodbye

- **WHEN** Lucía ends with "¡Con mucho gusto! Estamos a la orden." and the person writes "Gracias"
- **THEN** the inbound turn is stored with intent `closing`

#### Scenario: Ok answering a question

- **WHEN** Sofía asks "¿Podrías mandarme la foto de tu cédula?" and the person writes "Ok"
- **THEN** `settled` is false, and the conversation is not resolved

#### Scenario: No classifier configured

- **WHEN** `mikro.json` has no `classifier` section
- **THEN** no turn is labeled, and the agent replies exactly as before

#### Scenario: Classifier times out

- **WHEN** the classifier takes longer than 3 seconds
- **THEN** the turn is stored without an intent, and the agent still replies

### Requirement: The classifier is a pluggable decision provider

The `classifier` section SHALL be optional, and SHALL select a provider:

- `openai-decisions`: the OpenAI Decisions API, model `gpt-6-luna`;
- `chat`: any text model in the agents' model registry, asked the same questions through structured output at temperature 0.

Both SHALL return answers of the same shape. The intent, state and action code SHALL depend only on that shape. No provider SHALL be hardcoded as the default.

#### Scenario: OpenAI Decisions configured

- **WHEN** `classifier` is `{ provider: "openai-decisions", model: "gpt-6-luna", apiKey }`
- **THEN** each inbound turn is classified with one `POST /v1/decisions` request

#### Scenario: Chat fallback configured

- **WHEN** `classifier` is `{ provider: "chat", vendor: "google", model: "gemini-2.5-flash-lite", apiKey }`
- **THEN** the same questions are answered by that model, and stored in the same shape

### Requirement: Each conversation has a state derived in code

The system SHALL keep, per address (phone or BSUID), a conversation state: `open`, `waiting_customer`, `waiting_human` or `resolved`. A resolved state SHALL carry a resolution of `closing`, `opt_out`, `out_of_area`, `rejected_informed`, `intake_complete`, `evidence_complete` or `stuck`.

The state SHALL be computed in code from intents and existing agent signals:

- finalize outcomes;
- hand-offs;
- the out-of-area and rejected-applicant directives;
- evidence completion.

The state after each turn SHALL be stored on that turn. An intent below the confidence threshold SHALL be treated as `other`, and a predicate below it as false. A `closing` SHALL resolve the conversation only when `settled` is true. An open hand-off SHALL make the state `waiting_human`.

#### Scenario: Out-of-area guest

- **WHEN** Lucía answers a guest whose route carried the out-of-area directive
- **THEN** the conversation becomes `resolved` with resolution `out_of_area`

#### Scenario: Intake complete

- **WHEN** José calls `finalizeApplication` with outcome `complete` for an in-area application
- **THEN** the conversation becomes `resolved` with resolution `intake_complete`

#### Scenario: Weak closing

- **WHEN** a turn is labeled `closing` with a confidence below the threshold
- **THEN** the state is computed as for `other`, and the conversation is not resolved

### Requirement: Actions run only when enabled

Actions SHALL run only when `conversationState.actionsEnabled` is true. That section and key SHALL be optional, with `actionsEnabled` false by default. With actions off, the reply path SHALL be unchanged while labels and state are still stored.

#### Scenario: Actions off

- **WHEN** `actionsEnabled` is false and a turn resolves the conversation as `closing`
- **THEN** the agent replies as before, and Chatwoot is not touched

### Requirement: Closings get no reply and resolve the conversation

With actions on, an inbound turn that resolves the conversation as `closing` SHALL be recorded without invoking the agent or sending a reply, and its Chatwoot conversation SHALL be resolved.

When a `closing` arrives on an already-resolved conversation, it SHALL be recorded without a reply, and the Chatwoot conversation SHALL be resolved again. Any other intent on a resolved conversation SHALL reopen it (state `open`), and the agent SHALL answer.

#### Scenario: Run of acknowledgements

- **WHEN** after Lucía's goodbye the person writes "Ok", then "Gracias"
- **THEN** neither message gets a reply, and the Chatwoot conversation is resolved

#### Scenario: Thanks after an auto-close

- **WHEN** José's intake-complete message resolved the conversation and the person writes "Gracias"
- **THEN** there is no reply, and the conversation Chatwoot reopened is resolved again

#### Scenario: New question after a resolution

- **WHEN** a resolved conversation receives "¿Y cuánto sería la cuota?"
- **THEN** the conversation reopens, and the agent answers

### Requirement: Finished conversations are resolved in Chatwoot

With actions on, when a conversation becomes `resolved` with resolution `out_of_area`, `rejected_informed`, `intake_complete` or `evidence_complete`, the system SHALL resolve its Chatwoot conversation after the agent's reply has been sent and echoed. A `waiting_human` conversation SHALL never be resolved automatically.

A Chatwoot failure SHALL be logged and SHALL NOT fail the reply.

#### Scenario: Rejected applicant informed

- **WHEN** Lucía tells a rejected applicant their reapply date
- **THEN** the Chatwoot conversation is resolved after her reply is echoed

#### Scenario: Open hand-off

- **WHEN** a conversation with an open hand-off receives "Gracias"
- **THEN** the Chatwoot conversation is left open

### Requirement: Opt-outs are confirmed, then the application is abandoned

With actions on, a turn labeled `opt_out` SHALL make the agent ask for confirmation. The system SHALL record a pending opt-out, which expires after 24 hours.

A reply with `affirms` true SHALL then:

1. move a DRAFT, RECEIVED or IN_REVIEW application to ABANDONED, recording an `application.abandoned` business event attributed to the applicant;
2. send one short goodbye;
3. resolve the conversation with resolution `opt_out`.

An application in PENDING_DECISION or APPROVED SHALL NOT be cancelled automatically; a hand-off SHALL be opened instead. Any other reply SHALL clear the pending opt-out.

#### Scenario: Applicant confirms

- **WHEN** an applicant in RECEIVED writes "Descártala la solicitud", is asked to confirm, and answers "Sí"
- **THEN** the application becomes ABANDONED, a goodbye is sent, and the Chatwoot conversation is resolved

#### Scenario: Applicant changes their mind

- **WHEN** after the confirmation question the person answers "No, mejor sigo"
- **THEN** the application is unchanged, and the conversation continues

#### Scenario: Decision in flight

- **WHEN** an applicant in PENDING_DECISION opts out and confirms
- **THEN** a hand-off is opened with reason "Quiere cancelar su solicitud", and the application status is unchanged

### Requirement: Stuck loops are handed to a person

With actions on, when two consecutive inbound turns are labeled `repeat` (the same unusable input after the agent's request), the system SHALL NOT invoke the agent. It SHALL instead:

- send one fixed hand-off message;
- open a hand-off with reason "Conversación atascada";
- add the `stuck` label to the Chatwoot conversation, with a private note of the recent turns.

The state SHALL become `waiting_human`.

#### Scenario: Videos instead of photos

- **WHEN** Sofía asked for a business photo, and the applicant sent a video, then another video
- **THEN** Sofía is not invoked again, a hand-off opens, and Chatwoot shows the `stuck` label

### Requirement: Stored turns can be classified after the fact

`mikro conversations:classify --since <date>` SHALL label inbound turns that have no intent, and recompute turn and conversation state. It SHALL be idempotent, skipping labeled turns unless `--force` is given. It SHALL never send messages, change Chatwoot, or transition applications.

With `--dry-run --providers <spec,…>`, it SHALL write nothing and SHALL report, per model:

- agreement with a hand-labeled sample file (overall and for `closing` and `opt_out`);
- a confusion summary;
- the estimated cost;
- p50/p95 latency.

#### Scenario: Backfill twice

- **WHEN** the command runs twice with the same `--since`
- **THEN** the second run labels nothing new

#### Scenario: Model bake-off

- **WHEN** the founder runs `--dry-run --providers openai-decisions:gpt-6-luna,chat:openai:gpt-4o-mini,chat:google:gemini-2.5-flash-lite`
- **THEN** a comparison table is printed, and no turn is written

### Requirement: The export shows intents and state

`mikro conversations:export` SHALL include each turn's intent, confidence, state and resolution. Its conversations format SHALL end with a summary of counts per intent and per resolution.

#### Scenario: Export after backfill

- **WHEN** the founder exports the last 7 days after a backfill
- **THEN** each inbound turn shows its intent, and the summary lists the counts of `closing`, `opt_out` and each resolution
