## MODIFIED Requirements

### Requirement: NUDGE handler sends WhatsApp template and schedules ABANDON job

When a NUDGE job fires, the system SHALL check the application's current status. If the application is still `RECEIVED` and has a `phone`, it SHALL send the `loan_application_follow_up` WhatsApp template to that phone. The NUDGE SHALL NOT schedule an ABANDON job: a submitted application is never abandoned by a timer.

#### Scenario: NUDGE sent to applicant with phone

- **WHEN** a NUDGE job fires and the application is `RECEIVED` with a phone
- **THEN** the `loan_application_follow_up` template is sent to the applicant's phone
- **AND** no ABANDON job is created
- **AND** the NUDGE job status is set to `DONE`

#### Scenario: NUDGE skipped — application already advanced

- **WHEN** a NUDGE job fires and the application status is not `RECEIVED` (e.g. `IN_REVIEW`, `APPROVED`, `ABANDONED`)
- **THEN** no template is sent
- **AND** the NUDGE job status is set to `CANCELLED`

#### Scenario: NUDGE skipped — no phone

- **WHEN** a NUDGE job fires and the application is `RECEIVED` but has no phone
- **THEN** no template is sent
- **AND** the NUDGE job status is set to `DONE`

#### Scenario: Template send failure is logged

- **WHEN** a NUDGE job fires, the application is `RECEIVED` with a phone, but the WhatsApp API call fails
- **THEN** the failure is logged
- **AND** the NUDGE job status is set to `DONE`

### Requirement: ABANDON handler marks application ABANDONED

When an ABANDON job fires, the system SHALL check the application's current status. If it is still `DRAFT`, it SHALL update the status to `ABANDONED`. If it is in any other status, it SHALL cancel the job without modifying the application.

#### Scenario: Draft abandoned after stale window

- **WHEN** an ABANDON job fires and the application status is still `DRAFT`
- **THEN** the application status transitions to `ABANDONED`
- **AND** the ABANDON job status is set to `DONE`

#### Scenario: ABANDON job skipped — application submitted or resolved

- **WHEN** an ABANDON job fires and the application status is not `DRAFT`
- **THEN** the application is not modified
- **AND** the ABANDON job status is set to `CANCELLED`

## ADDED Requirements

### Requirement: DRAFT ABANDON is anchored on the prospect's last activity

Each piece of prospect activity on a `DRAFT` application SHALL cancel any PENDING ABANDON job for it and schedule a new one at now + `followUp.abandonDelayHours` (default 8). Activity is an inbound WhatsApp message from the application's phone, or a partial (`partial: true`) form autosave. At most one PENDING ABANDON job SHALL exist per application. Activity SHALL be recorded even when agent replies are disabled.

#### Scenario: Draft created by autosave

- **WHEN** a partial autosave creates a DRAFT application
- **THEN** an ABANDON job is scheduled at now + 8 hours

#### Scenario: Prospect replies keep the draft alive

- **WHEN** a prospect with a DRAFT application sends a WhatsApp message 7 hours after the last activity
- **THEN** the pending ABANDON job is cancelled
- **AND** a new ABANDON job is scheduled at now + 8 hours

#### Scenario: Prospect goes silent

- **WHEN** 8 hours pass with no inbound message or autosave for a DRAFT application
- **THEN** the ABANDON job fires and the application becomes `ABANDONED`

#### Scenario: Open hand-off does not abandon

- **WHEN** a hand-off is open for the prospect's phone when the ABANDON job fires
- **THEN** the application is not modified and the job is rescheduled at the hand-off's expiry
