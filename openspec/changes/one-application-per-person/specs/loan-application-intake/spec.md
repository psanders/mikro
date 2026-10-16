## ADDED Requirements

### Requirement: One application per person

The system SHALL check every application submission (website final submit, WhatsApp intake Flow, José's finalize) against the same person's other applications, where the same person means the same normalized phone or the same cédula. Partial autosaves SHALL NOT be checked.

#### Scenario: Rejected less than 30 days ago

- **WHEN** a person whose application was REJECTED less than `REAPPLY_COOLDOWN_DAYS` (30) days ago submits a new application, for any rejection reason including OUT_OF_COVERAGE_AREA
- **THEN** no application is submitted
- **AND** the website response is `{ "result": "ok", "outcome": "cooldown", "reapplyFrom": <ISO date> }` (plus `"outOfArea": true` for a coverage-area rejection), and the WhatsApp paths tell the person that date

#### Scenario: Matched by cédula with another phone

- **WHEN** the submission's phone matches no application but its cédula matches a rejected one inside the cooldown
- **THEN** it is treated as the same person and blocked the same way

#### Scenario: Application already in process

- **WHEN** the person has another application in RECEIVED, IN_REVIEW, PENDING_DECISION or APPROVED
- **THEN** no second application is submitted
- **AND** the website response is `{ "result": "ok", "outcome": "in_process" }`

#### Scenario: Older unsubmitted draft

- **WHEN** the person has a DRAFT under another session and submits from a new one
- **THEN** the submission is written into the older DRAFT and the new session's DRAFT is removed

#### Scenario: Cooldown over

- **WHEN** the person's last rejection was 30 or more days ago and nothing else is open
- **THEN** the submission is accepted as usual

#### Scenario: Repeated submit of the same session

- **WHEN** the same session submits again (e.g. a double tap)
- **THEN** its own application does not count as "in process" and the submission goes through as before

### Requirement: WhatsApp routing respects the cooldown

A person inside the reapply cooldown SHALL be routed as a guest told the reapply date, even when their latest application is a newer DRAFT or a never-submitted ABANDONED application.

#### Scenario: Newer draft inside the cooldown

- **WHEN** a person rejected 3 days ago writes on WhatsApp and their latest application is a DRAFT
- **THEN** they are routed as a guest with `reapplyFrom`, not to José
