## ADDED Requirements

### Requirement: Timer is scheduled when an external application is received

The system SHALL schedule a NUDGE `FollowUpJob` 10 minutes in the future whenever a `LoanApplication` with `source` `FORM` or `WHATSAPP` transitions to `RECEIVED` status. Applications with `source` `MANUAL` SHALL NOT trigger any timer.

#### Scenario: Form submission schedules NUDGE job

- **WHEN** `POST /v1/applications` receives a payload with `partial: false`
- **THEN** a `FollowUpJob` row is created with `type: NUDGE`, `status: PENDING`, `applicationId` matching the created/updated application, and `scheduledFor` = now + 10 minutes

#### Scenario: WhatsApp Flow submission schedules NUDGE job

- **WHEN** an `nfm_reply` WhatsApp Flow submission is processed via `submitApplicationFromFlow`
- **THEN** a `FollowUpJob` row is created with `type: NUDGE`, `status: PENDING`, and `scheduledFor` = now + 10 minutes

#### Scenario: Manual application does not schedule any job

- **WHEN** a reviewer calls `createApplication` (source: MANUAL)
- **THEN** no `FollowUpJob` row is created for that application

#### Scenario: Partial submission does not schedule a NUDGE

- **WHEN** `POST /v1/applications` receives a payload with `partial: true`
- **THEN** no `FollowUpJob` is created (application remains DRAFT)

### Requirement: Polling worker fires overdue jobs

The system SHALL run a polling loop every 30 seconds that selects all `FollowUpJob` rows with `status: PENDING` and `scheduledFor <= now`, and executes each one atomically.

#### Scenario: Overdue NUDGE job is executed

- **WHEN** a NUDGE job's `scheduledFor` time has passed and the polling loop runs
- **THEN** the job is processed exactly once and its status transitions to `DONE`

#### Scenario: Jobs not yet due are skipped

- **WHEN** a NUDGE job's `scheduledFor` is in the future
- **THEN** the polling loop does not execute or modify that job

#### Scenario: Polling survives process restart

- **WHEN** the apiserver restarts while a NUDGE job is PENDING
- **THEN** the next polling tick after restart picks up and processes overdue jobs

### Requirement: NUDGE handler sends WhatsApp template and schedules ABANDON job

When a NUDGE job fires, the system SHALL check the application's current status. If the application is still `RECEIVED` and has a `phone`, it SHALL send the `loan_application_follow_up` WhatsApp template to that phone and schedule an ABANDON `FollowUpJob` 8 hours in the future. If the application has no phone, it SHALL schedule the ABANDON job immediately (0-minute delay).

#### Scenario: NUDGE sent to applicant with phone

- **WHEN** a NUDGE job fires and the application is `RECEIVED` with a phone
- **THEN** the `loan_application_follow_up` template is sent to the applicant's phone
- **AND** an ABANDON `FollowUpJob` is created with `scheduledFor` = now + 8 hours
- **AND** the NUDGE job status is set to `DONE`

#### Scenario: NUDGE skipped — application already advanced

- **WHEN** a NUDGE job fires and the application status is not `RECEIVED` (e.g. `IN_REVIEW`, `APPROVED`, `ABANDONED`)
- **THEN** no template is sent
- **AND** no ABANDON job is created
- **AND** the NUDGE job status is set to `CANCELLED`

#### Scenario: NUDGE skipped — no phone, ABANDON scheduled immediately

- **WHEN** a NUDGE job fires and the application is `RECEIVED` but has no phone
- **THEN** no template is sent
- **AND** an ABANDON job is created with `scheduledFor` = now (fires on next poll)
- **AND** the NUDGE job status is set to `DONE`

#### Scenario: Template send failure does not block ABANDON scheduling

- **WHEN** a NUDGE job fires, the application is `RECEIVED` with a phone, but the WhatsApp API call fails
- **THEN** the failure is logged
- **AND** an ABANDON job is still created with `scheduledFor` = now + 8 hours
- **AND** the NUDGE job status is set to `DONE`

### Requirement: ABANDON handler marks application ABANDONED

When an ABANDON job fires, the system SHALL check the application's current status. If still `RECEIVED`, it SHALL update the status to `ABANDONED`. If already in any other status, it SHALL cancel the job without modifying the application.

#### Scenario: Application abandoned after stale window

- **WHEN** an ABANDON job fires and the application status is still `RECEIVED`
- **THEN** the application status transitions to `ABANDONED`
- **AND** the ABANDON job status is set to `DONE`

#### Scenario: ABANDON job skipped — application already resolved

- **WHEN** an ABANDON job fires and the application status is not `RECEIVED`
- **THEN** the application is not modified
- **AND** the ABANDON job status is set to `CANCELLED`

### Requirement: Active timers are cancelled when an application advances

When a `LoanApplication` transitions out of `RECEIVED` status (e.g., a reviewer claims it, applicant completes via chat), the system SHALL cancel any PENDING `FollowUpJob` rows for that application by setting their status to `CANCELLED`.

#### Scenario: Reviewer claims application — NUDGE cancelled

- **WHEN** a reviewer changes an application status from `RECEIVED` to `IN_REVIEW`
- **THEN** all PENDING `FollowUpJob` rows for that application are set to `CANCELLED`

#### Scenario: Application completed via WhatsApp chat — jobs cancelled

- **WHEN** `finalizeApplication` marks an application `RECEIVED` (complete outcome) after it was already `RECEIVED` from a prior partial submission
- **THEN** any existing PENDING jobs for that application are cancelled and a fresh NUDGE job is NOT rescheduled (application is fully submitted)

#### Scenario: Application already ABANDONED — no double transition

- **WHEN** an ABANDON job fires for an application already marked `ABANDONED` by another path
- **THEN** the application is not modified and the job is set to `CANCELLED`
