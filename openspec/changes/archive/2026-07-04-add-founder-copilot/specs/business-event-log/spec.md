# business-event-log — delta

## MODIFIED Requirements

### Requirement: Business events are recorded append-only for every catalog mutation

The apiserver SHALL persist a `BusinessEvent` row for every successful business mutation in the event catalog, captured at the API boundary within the same request: the event is written immediately after the mutation commits, an event is never written for a failed or rolled-back mutation, and an event-write failure after a committed mutation SHALL be logged as an error without failing the request. The event log MUST be append-only: the API SHALL expose no procedure that updates or deletes an event, and corrections SHALL be represented as new events. Events SHALL be retained indefinitely.

The boundary-captured catalog is: `payment.collected`, `payment.reversed`, `application.approved`, `application.rejected`, `application.signed`, `application.converted`, `application.deleted`, `application.restored`, `loan.status_changed`, `customer.created`. In addition, the catalog includes intrinsically recorded types written directly by their producing features (not via annotated procedures): `copilot.action` (a confirmed copilot write, with tool provenance in the payload) and `rule.alert` (a watch-rule threshold crossing).

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
