## MODIFIED Requirements

### Requirement: Prospect intake is a short, priority-ordered conversation

José SHALL ask the highest-signal fields first and ask 2–3 fields per message (never one at a time except the closing). He SHALL submit the application (outcome `complete`) as soon as the simulated ISC reaches 50 or all applicable fields are collected. The ordering of remaining fields SHALL be the single source of truth `FIELD_PRIORITY`, surfaced as the already-ordered `missingFields` from `getApplicationState` and `saveAnswer`: knockouts first (province, businessType), then payment-capacity fields, then the rest by scoring weight. Submitting does not end the conversation while fields are missing; see "Intake continues after submission".

#### Scenario: Highest-weight questions are asked first

- **WHEN** José begins a fresh intake with multiple missing fields
- **THEN** the first questions cover the knockout / payment-capacity fields (province, businessType, monthlySales, requestedAmount, requestedTermWeeks) before lower-weight fields (e.g. references, spouse)

#### Scenario: Early submission at the ISC target

- **WHEN** a `saveAnswer` result reports `simulatedIsc >= 50` with fields still missing
- **THEN** José submits the application (outcome `complete`), confirms it was received, and offers, as optional, to continue with the next missing fields

## REMOVED Requirements

### Requirement: Intake is capped at seven José turns

**Reason**: The founder wants José to gather as much as possible. The fixed end point is replaced by a "submit by" point, and José keeps asking after submission.

**Migration**: See "José submits by his seventh reply" and "Intake continues after submission".

## ADDED Requirements

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
