## ADDED Requirements

### Requirement: LoanApplication records its creation source

The `LoanApplication` model SHALL include an `ApplicationSource` enum (`FORM`, `WHATSAPP`, `MANUAL`) and a non-nullable `source` column defaulting to `FORM`. The `source` field SHALL be set at creation time and SHALL NOT change after that.

#### Scenario: Form submission source is FORM

- **WHEN** an application is created via `POST /v1/applications`
- **THEN** its `source` is `FORM`

#### Scenario: WhatsApp Flow submission source is WHATSAPP

- **WHEN** an application is created or updated via `submitApplicationFromFlow`
- **THEN** its `source` is `WHATSAPP`

#### Scenario: Manual creation source is MANUAL

- **WHEN** a reviewer calls `createApplication`
- **THEN** its `source` is `MANUAL`

#### Scenario: Existing rows default to FORM

- **WHEN** the migration runs on an existing database
- **THEN** all pre-existing `LoanApplication` rows have `source = FORM`

### Requirement: FollowUpJob table persists timer state

The system SHALL have a `FollowUpJob` model with columns: `id` (cuid), `applicationId` (FK to `LoanApplication`), `type` (`NUDGE` | `ABANDON`), `scheduledFor` (DateTime), `status` (`PENDING` | `DONE` | `CANCELLED`), `createdAt` (DateTime). The table is indexed on `(status, scheduledFor)` for polling efficiency.

#### Scenario: NUDGE job row created on application receipt

- **WHEN** an external application is received
- **THEN** a `FollowUpJob` row exists with the correct `applicationId`, `type: NUDGE`, `status: PENDING`, and a `scheduledFor` approximately 10 minutes in the future

#### Scenario: ABANDON job row created after NUDGE fires

- **WHEN** a NUDGE job is processed
- **THEN** a new `FollowUpJob` row is inserted with `type: ABANDON` and `scheduledFor` approximately 8 hours in the future (or now if no phone)

#### Scenario: Cancelled jobs are queryable for audit

- **WHEN** a job is cancelled because the application advanced
- **THEN** the `FollowUpJob` row remains with `status: CANCELLED` and is not deleted
