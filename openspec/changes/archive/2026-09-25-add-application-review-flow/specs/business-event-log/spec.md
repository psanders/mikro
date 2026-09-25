## MODIFIED Requirements

### Requirement: Business events are recorded append-only for every catalog mutation

The apiserver SHALL persist a `BusinessEvent` row for every successful business mutation in the event catalog, captured at the API boundary within the same request: the event is written immediately after the mutation commits, an event is never written for a failed or rolled-back mutation, and an event-write failure after a committed mutation SHALL be logged as an error without failing the request. The event log MUST be append-only: the API SHALL expose no procedure that updates or deletes an event, and corrections SHALL be represented as new events. Events SHALL be retained indefinitely.

The boundary-captured catalog is: `payment.collected`, `payment.reversed`, `application.assigned`, `application.sent_to_decision`, `application.returned`, `application.approved`, `application.rejected`, `application.withdrawn`, `application.converted`, `application.deleted`, `application.restored`, `loan.created`, `loan.status_changed`, `customer.created`. `application.signed` is no longer produced (existing rows stay readable).

In addition, the catalog includes intrinsically recorded types written directly by their producing features (not via annotated procedures):

- `application.received`: an application became `RECEIVED` via website final submit, WhatsApp Flow submission, or promote.
- `application.rejected` with the system as actor: out-of-area intake.
- `copilot.action`: a confirmed copilot write, with tool provenance in the payload.
- The task lifecycle types:
  - `task.due`: a confirm-gated firing became ready.
  - `task.needs_input`: gathering left a firing missing slot values.
  - `task.completed`: a firing executed or was skipped; `skipped: true` in the payload distinguishes the two.
  - `task.failed`: execution refused or errored, with a reason.

Every application event's payload SHALL carry `applicationId`, the applicant's display name, business name, and score. Task lifecycle payloads carry `taskFiringId`, `automationId`, and the task name as denormalized display data. Like all events, they carry no foreign keys and remain renderable after their subject is deleted.

#### Scenario: Payment collection records an event

- **WHEN** a collector records a payment and the payment transaction commits
- **THEN** a `payment.collected` event exists with the payment's amount, the collector as actor, and the customer/loan references

#### Scenario: Event-write failure does not fail the mutation

- **WHEN** the post-commit event write fails after a successful mutation
- **THEN** the mutation's response is unaffected and the failure is logged as an error

#### Scenario: Mutation failure records no event

- **WHEN** a business mutation fails validation or its transaction rolls back
- **THEN** no `BusinessEvent` row is written for that attempt

#### Scenario: No mutation surface for events

- **WHEN** the tRPC API surface is inspected
- **THEN** there is no procedure that updates or deletes `BusinessEvent` rows

#### Scenario: Copilot write records a provenance event

- **WHEN** a copilot pending action is confirmed and executed
- **THEN** a `copilot.action` event exists with the founder as actor and the tool name and arguments in the payload

#### Scenario: Task firing records lifecycle events

- **WHEN** a confirm-gated task fires and the founder later confirms it successfully
- **THEN** a `task.due` event and a `task.completed` event exist, each carrying the `taskFiringId`, `automationId`, and task name in the payload

#### Scenario: Received application records an event

- **WHEN** a website final submission is stored as `RECEIVED`
- **THEN** an `application.received` event exists with the `applicationId` and applicant name

#### Scenario: Lifecycle events follow the application

- **WHEN** an application is assigned, sent to decision, returned, approved and converted
- **THEN** one event of each corresponding type exists, in that order, each with the acting user
