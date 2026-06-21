## ADDED Requirements

### Requirement: Prospect intake is a short, priority-ordered conversation

José SHALL complete a prospect's partial application over WhatsApp as a short form: it SHALL ask the highest-signal fields first, ask 2–3 fields per message (never one at a time except the closing), and finalize as soon as the simulated ISC reaches 50 OR all applicable fields are collected. The ordering of remaining fields SHALL be the single source of truth `FIELD_PRIORITY` (knockouts first — province, businessType — then payment-capacity fields, then the rest by scoring weight), surfaced as the already-ordered `missingFields` from `getApplicationState` and `saveAnswer`.

#### Scenario: Highest-weight questions are asked first

- **WHEN** José begins a fresh intake with multiple missing fields
- **THEN** the first questions cover the knockout / payment-capacity fields (province, businessType, monthlySales, requestedAmount, requestedTermWeeks) before lower-weight fields (e.g. references, spouse)

#### Scenario: Early finalize at the ISC target

- **WHEN** a `saveAnswer` result reports `simulatedIsc >= 50`
- **THEN** José finalizes the application (outcome `complete`) instead of asking further questions

### Requirement: Intake is capped at seven José turns

The system SHALL cap a prospect intake conversation at seven José messages, including the closing. On the final allowed turn the handler SHALL inject a directive forcing José to save any useful data in the message and finalize with outcome `complete`, asking no further questions. This cap is enforced in code (a per-session turn counter), not left to the model.

#### Scenario: Final turn forces a complete close

- **WHEN** José has already produced six replies in a conversation and a seventh inbound message arrives
- **THEN** the handler injects a turn-limit directive
- **AND** José saves any useful data, calls `finalizeApplication` with outcome `complete`, and replies only with the closing message

### Requirement: Phone fields are validated before persistence

When saving a phone field (`phone`, `businessPhone`, `referencePhone`, `spousePhone`), `saveAnswer` SHALL accept Dominican numbers in the formats prospects type (10-digit local, optional country code `1`/`+1`, area codes 809/829/849) and SHALL reject malformed numbers. A rejected phone SHALL be returned in `invalid` with a reason in `invalidReasons`, SHALL NOT be persisted, and any other valid fields in the same call SHALL still be saved. José SHALL re-ask the rejected phone before moving on.

#### Scenario: Too-short reference phone is rejected and re-asked

- **WHEN** a prospect provides a reference name plus the phone "892222222"
- **THEN** the reference name is saved
- **AND** the phone is returned in `invalid` with a reason and is NOT persisted
- **AND** José re-asks for the complete number

#### Scenario: Local 10-digit Dominican phone is accepted

- **WHEN** a prospect provides "809-234-5678" for a phone field
- **THEN** it is accepted and saved

### Requirement: A single closing message, sourced from José's reply

`finalizeApplication` SHALL persist only and SHALL NOT send a WhatsApp message. The closing or goodbye message the prospect receives SHALL be José's own reply text, so the prospect never receives two messages and a policy rejection is never followed by a generic "completed" message.

#### Scenario: Completion sends exactly one message

- **WHEN** José finalizes a completed application
- **THEN** the prospect receives exactly one closing message (José's reply)
- **AND** `finalizeApplication` itself sends no message

### Requirement: Out-of-zone and critical-business prospects are declined politely

When `getApplicationState`/`saveAnswer` report `isOutOfZone` or `isCriticalBusiness`, José SHALL reply with the corresponding policy message and call `finalizeApplication`, without collecting further fields. These flags are deterministic outputs of the scoring engine (`OUT_OF_ZONE` when the province is outside the configured coverage zone; `CRITICAL_BUSINESS` when the business type maps to risk level `CRITICO`), not model judgments.

#### Scenario: Out-of-zone province is declined

- **WHEN** the prospect's province is outside the coverage zone (`isOutOfZone = true`)
- **THEN** José replies with the out-of-zone message and finalizes, asking no intake questions

### Requirement: Prospect opt-out is recorded as ABANDONED

When a prospect indicates they are not interested or do not want to continue, José SHALL acknowledge once respectfully, SHALL NOT ask further questions or repeat the prior question, and SHALL call `finalizeApplication` with outcome `abandoned`, which marks the application status `ABANDONED` (terminal). José SHALL NOT tell an opting-out prospect that their information is complete or that an advisor will contact them. The system SHALL detect explicit declines deterministically (a conservative phrase match in the message handler) in addition to the agent's own handling, and SHALL NOT treat a bare "no" answer to a yes/no intake question as a decline.

#### Scenario: Explicit decline marks the application abandoned

- **WHEN** a prospect sends an explicit decline (e.g. "ya no me interesa", "déjenme tranquilo", "cancela")
- **THEN** the handler injects a not-interested directive
- **AND** José replies with a brief respectful goodbye and calls `finalizeApplication` with outcome `abandoned`
- **AND** the application status becomes `ABANDONED`

#### Scenario: Bare "no" is not a decline

- **WHEN** a prospect replies "no" to a yes/no intake question
- **THEN** the handler does NOT inject a not-interested directive and intake continues

#### Scenario: Silent prospect is abandoned, not completed

- **WHEN** a prospect goes three turns without providing any useful intake data
- **THEN** the handler directs José to finalize with outcome `abandoned` (not `complete`)
- **AND** the application status becomes `ABANDONED`
