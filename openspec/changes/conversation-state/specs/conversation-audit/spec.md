## MODIFIED Requirements

### Requirement: Code checks flag deterministic problems

Every reviewed conversation SHALL pass through the code-check registry. Each hit SHALL be stored as a finding with source `CODE`, the check's severity, the turn id, and the turn text as evidence. The checks are:

- `failed_send` (warning): an AGENT or SYSTEM turn whose send failed.
- `error_reply` (warning): the generic processing-error reply was sent.
- `handoff_ignored` (warning): an explicit request for a person, detected with the same matcher the handler uses, with no hand-off opened for that phone between 1 minute before and 10 minutes after the request.
- `sensitive_score` (critical): an agent reply to a non-staff person that states a score or band with a number.
- `double_reply` (warning): an agent reply within 90 seconds of a previous delivered agent reply, with no inbound message between them.
- `stuck_loop` (warning): three consecutive agent replies making the same request (content-word overlap ≥ 0.45).
- `unanswered` (warning): the conversation's last turn is an inbound message more than 10 minutes old with no reply, unless it was a `closing` after a settled exchange or a hand-off was opened in the 24 hours before it.
- `closing_loop` (warning): the agent replied to a second consecutive `closing` after a settled exchange (needs classifier labels).

José no longer has a turn cap. His submit-by rule is enforced in code, and the judge covers it through his `envia_pronto` policy.

#### Scenario: Failed send becomes a finding

- **WHEN** a reviewed conversation has an AGENT turn with `failed = true`
- **THEN** a `failed_send` warning finding cites that turn

#### Scenario: Hand-off request honored

- **WHEN** a person writes "quiero hablar con una persona" and a hand-off was opened for that phone within the next 10 minutes
- **THEN** no `handoff_ignored` finding is created

#### Scenario: Score leaked

- **WHEN** an agent reply to an APPLICANT says "Tu puntaje Mikro es 74"
- **THEN** a `sensitive_score` critical finding cites that turn

#### Scenario: Long José conversations are not flagged

- **WHEN** José sends more than seven replies on one application
- **THEN** no code-check finding is created for the number of replies

#### Scenario: Repeated request

- **WHEN** Sofía asks for "la foto de tu negocio" three times in a row while the person keeps sending videos
- **THEN** a `stuck_loop` warning finding cites the third agent reply

#### Scenario: Goodbyes answered

- **WHEN** Lucía answers "Ok", "Ya" and "Esta bien" after the matter was settled
- **THEN** a `closing_loop` warning finding cites the reply to the second closing

#### Scenario: Finished but never closed

- **WHEN** Lucía's last reply, three days ago, told a guest that Mikro only serves Puerto Plata, and the conversation is not `resolved`
- **THEN** an `unresolved` warning finding cites that reply

## ADDED Requirements

### Requirement: Runs report conversation resolutions in the detail panel

Each run SHALL store `resolutionCounts`: the number of reviewed conversations per state and per resolution reason. The run's detail panel SHALL show them. The `conversation.audited` feed card SHALL remain verdict-only, with no counts.

#### Scenario: Detail shows resolutions

- **WHEN** the founder opens "Ver detalle" on a run
- **THEN** the panel lists counts such as `resolved · closing 12`, `resolved · out_of_area 3`, `waiting_human 2`, and the card itself shows only the verdict
