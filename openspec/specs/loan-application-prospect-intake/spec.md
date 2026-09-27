# loan-application-prospect-intake Specification

## Purpose

José, the PROSPECT agent, completes applications over WhatsApp. He asks the highest-signal fields first and submits early (by his seventh reply at the latest). While the conversation is live, he keeps asking the remaining fields after submission. He declines out-of-zone and critical businesses politely, and records an opt-out as ABANDONED.

## Requirements

### Requirement: Prospect intake is a short, priority-ordered conversation

José SHALL ask the highest-signal fields first and ask 2–3 fields per message (never one at a time except the closing). He SHALL submit the application (outcome `complete`) as soon as the simulated ISC reaches 50 or all applicable fields are collected. The ordering of remaining fields SHALL be the single source of truth `FIELD_PRIORITY`, surfaced as the already-ordered `missingFields` from `getApplicationState` and `saveAnswer`: knockouts first (province, businessType), then payment-capacity fields, then the rest by scoring weight. Submitting does not end the conversation while fields are missing; see "Intake continues after submission".

#### Scenario: Highest-weight questions are asked first

- **WHEN** José begins a fresh intake with multiple missing fields
- **THEN** the first questions cover the knockout / payment-capacity fields (province, businessType, monthlySales, requestedAmount, requestedTermWeeks) before lower-weight fields (e.g. references, spouse)

#### Scenario: Early submission at the ISC target

- **WHEN** a `saveAnswer` result reports `simulatedIsc >= 50` with fields still missing
- **THEN** José submits the application (outcome `complete`), confirms it was received, and offers, as optional, to continue with the next missing fields

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

### Requirement: José submits by his seventh reply

When José has already produced six replies on a DRAFT and another message arrives, the handler SHALL inject a directive telling him to:

1. save any useful data in the message;
2. submit with `finalizeApplication` (outcome `complete`);
3. confirm the application was received;
4. offer, as optional, to keep answering the next 2–3 missing fields.

This is enforced in code from the stored history, not left to the model. An explicit decline still takes precedence and abandons the DRAFT.

#### Scenario: Seventh reply submits and continues

- **WHEN** José has six replies on a DRAFT and a seventh message arrives
- **THEN** the handler injects the submit directive, and José submits and asks the next missing fields instead of closing

### Requirement: Intake continues after submission

After submission, José SHALL keep serving a RECEIVED application ("intake open") when all of these hold:

- José hasn't closed intake (`intakeClosedAt` is null);
- at least one form field is missing;
- either José replied on it within the last 24 hours, or this is a first message after the application was submitted (for example from the web form) and no applicant-agent conversation has happened since.

Otherwise the applicant agent SHALL answer. José SHALL only reply to incoming messages and never message first.

While intake is open:

- José SHALL keep asking the remaining fields, 2–3 per message, with no turn cap.
- He MAY answer status questions and take cédula or business photos with the applicant agent's tools, under the same disclosure rules (no score, reasons, reviewer names or dates).
- A message from the person SHALL NOT restart the draft abandon clock.

José SHALL close intake (setting `intakeClosedAt`) when:

- the form becomes complete;
- the person declines more questions;
- three consecutive replies save nothing;
- `finalizeApplication` is called on the submitted application.

Closing intake SHALL NOT change the application's status: a submitted application is never abandoned or re-submitted by José.

#### Scenario: José keeps asking after submitting

- **WHEN** José submitted an application 10 minutes ago with fields missing and the person replies
- **THEN** the message routes to José, who saves the answers and asks the next missing fields, and the application stays RECEIVED

#### Scenario: Web-form applicant writes

- **WHEN** a person who submitted through the web form, with fields missing, writes for the first time
- **THEN** José answers: he confirms the application was received and offers to complete it

#### Scenario: Person declines after submission

- **WHEN** the person says they don't want to answer more questions after submission
- **THEN** José thanks them and closes intake, and the application stays RECEIVED (never ABANDONED)

#### Scenario: Window expires

- **WHEN** José's last reply on a submitted application is more than 24 hours old
- **THEN** the next message routes to the applicant agent

#### Scenario: Review starts

- **WHEN** a reviewer takes the application (IN_REVIEW)
- **THEN** messages route to the applicant agent, and intake writes are ignored
