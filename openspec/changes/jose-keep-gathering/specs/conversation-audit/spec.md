## MODIFIED Requirements

### Requirement: Code checks flag deterministic problems

Every reviewed conversation SHALL pass through the code-check registry. Each hit SHALL be stored as a finding with source `CODE`, the check's severity, the turn id, and the turn text as evidence. The checks are:

- `failed_send` (warning): an AGENT or SYSTEM turn whose send failed.
- `error_reply` (warning): the generic processing-error reply was sent.
- `handoff_ignored` (warning): an explicit request for a person, detected with the same matcher the handler uses, with no hand-off opened for that phone between 1 minute before and 10 minutes after the request.
- `sensitive_score` (critical): an agent reply to a non-staff person that states a score or band with a number.

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
