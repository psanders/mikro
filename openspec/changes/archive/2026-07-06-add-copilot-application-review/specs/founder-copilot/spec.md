## ADDED Requirements

### Requirement: Application review actions

The copilot tool policy SHALL bind `approveApplication`, `rejectApplication`, and `deleteApplication` as write tools, so the founder can resolve a loan application (solicitud) from the copilot rather than only from the dashboard or mobile review UI. As write tools they SHALL follow the confirm-first flow (the model's call is intercepted, persisted as a pending action, and executed only after the founder confirms). A rejection SHALL require a non-empty reason, which SHALL be persisted as the application's review note so the decision and its motive remain on the record for audit; rejecting SHALL NOT delete the application row. The system prompt SHALL steer the model to prefer `rejectApplication` (which preserves the record) over `deleteApplication` for a real decline, reserving `deleteApplication` for dead or abandoned flows.

#### Scenario: Reject proposed with a reason, confirmed, evented

- **WHEN** an admin asks the copilot to reject a `RECEIVED` or `IN_REVIEW` solicitud with a stated reason and then clicks confirm on the returned card
- **THEN** the application moves to `REJECTED` only after the click, its review note stores the reason, the thread shows the outcome, and a `copilot.action` event appears in the feed — the application row is not deleted

#### Scenario: Rejection reason is required

- **WHEN** the model calls `rejectApplication` without a non-empty reason
- **THEN** the tool call fails validation and no pending action executes, so a solicitud can never be rejected without a recorded motive

#### Scenario: Approve proposed and confirmed

- **WHEN** an admin asks the copilot to approve a `RECEIVED` or `IN_REVIEW` solicitud and confirms the returned card
- **THEN** the application moves to `APPROVED` only after the click and a `copilot.action` event is recorded

#### Scenario: Review action confirmed while not in a valid source status is refused

- **WHEN** a confirmed `approveApplication` or `rejectApplication` targets a solicitud whose current status is outside the allowed source statuses (e.g. already `CONVERTED`)
- **THEN** the transition is refused with a structured error and no status change or `copilot.action` event occurs

#### Scenario: Delete stays available but is not the default for a decline

- **WHEN** an admin asks the copilot to turn down an applicant without indicating the flow is dead or spam
- **THEN** the copilot proposes `rejectApplication` with a reason rather than `deleteApplication`, and `deleteApplication` is proposed only when the founder indicates the solicitud should be purged
