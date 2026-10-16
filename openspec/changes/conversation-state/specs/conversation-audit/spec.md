## MODIFIED Requirements

### Requirement: Code checks flag deterministic problems

Every reviewed conversation SHALL pass through the code-check registry. Each hit SHALL be stored as a finding with source `CODE`, the check's severity, the turn id, and the turn text as evidence. The checks are:

- `failed_send` (warning): an AGENT or SYSTEM turn whose send failed.
- `error_reply` (warning): the generic processing-error reply was sent.
- `handoff_ignored` (warning): an explicit request for a person, detected with the same matcher the handler uses, with no hand-off opened for that phone between 1 minute before and 10 minutes after the request.
- `sensitive_score` (critical): an agent reply to a non-staff person that states a score or band with a number.
- `stuck_loop` (warning): two consecutive inbound turns labeled `repeat`, or three consecutive agent replies making the same request, with no hand-off opened afterwards.
- `unresolved` (warning): a conversation whose last turn is older than 48 hours, whose state is neither `resolved` nor `waiting_human`, and whose last turn is an agent reply that asked nothing of the person.

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

#### Scenario: Repeated links

- **WHEN** a guest sends a Facebook link three times and Lucía answers each one with the same request, with no hand-off
- **THEN** a `stuck_loop` warning finding cites the third agent reply

#### Scenario: Finished but never closed

- **WHEN** Lucía's last reply, three days ago, told a guest that Mikro only serves Puerto Plata, and the conversation is not `resolved`
- **THEN** an `unresolved` warning finding cites that reply

## ADDED Requirements

### Requirement: Runs report conversation resolutions in the detail panel

Each run SHALL store `resolutionCounts`: the number of reviewed conversations per state and per resolution reason. The run's detail panel SHALL show them. The `conversation.audited` feed card SHALL remain verdict-only, with no counts.

#### Scenario: Detail shows resolutions

- **WHEN** the founder opens "Ver detalle" on a run
- **THEN** the panel lists counts such as `resolved · closing 12`, `resolved · out_of_area 3`, `waiting_human 2`, and the card itself shows only the verdict
