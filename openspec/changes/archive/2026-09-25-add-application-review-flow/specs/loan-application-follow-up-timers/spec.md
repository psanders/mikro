## MODIFIED Requirements

### Requirement: ABANDON handler marks application ABANDONED

When an ABANDON job fires, the system SHALL check the application's current status. It SHALL mark the application `ABANDONED` only if it is still `DRAFT`. A submitted application (`RECEIVED` or later) SHALL never be abandoned by a timer: the job is cancelled and the application is left unchanged, so it stays in the review queue until a person acts on it.

#### Scenario: Submitted application is never abandoned by a timer

- **WHEN** an ABANDON job fires and the application status is `RECEIVED`
- **THEN** the application is not modified
- **AND** the ABANDON job status is set to `CANCELLED`

#### Scenario: Draft abandoned after stale window

- **WHEN** an ABANDON job fires and the application status is still `DRAFT`
- **THEN** the application status transitions to `ABANDONED`
- **AND** the ABANDON job status is set to `DONE`

#### Scenario: ABANDON job skipped — application already resolved

- **WHEN** an ABANDON job fires and the application status is neither `DRAFT` nor `RECEIVED`
- **THEN** the application is not modified
- **AND** the ABANDON job status is set to `CANCELLED`
