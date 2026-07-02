# business-event-log Specification

## Purpose

Append-only log of business events in the apiserver — the single source of truth for everything shown in the founder feed. Events are written at the tRPC boundary, retained forever, and never updated or deleted.

## Requirements

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

### Requirement: Events carry denormalized display data and a typed payload

Each event SHALL store: a dotted `type`, `occurredAt` timestamp, actor id and denormalized actor name, nullable denormalized entity references (customer id/name, loan id, application id), a nullable amount, a Spanish human-readable `summary` line, and a `payload` string containing JSON validated by a per-type zod schema shared via `@mikro/common`. Denormalized fields MUST allow a card to render without joining the referenced rows.

#### Scenario: Event renders after its subject is deleted

- **WHEN** an event references an application that is later hard-deleted
- **THEN** the event still returns its actor name, customer name, and summary unchanged

#### Scenario: Producer payload is schema-validated

- **WHEN** a producer writes an event whose payload does not match the zod schema for its type
- **THEN** the write fails with a structured validation error and no event row is persisted

### Requirement: Feed query with cursor pagination and filters

The apiserver SHALL expose an admin-only feed query returning events in reverse-chronological order with opaque cursor pagination over `(occurredAt, id)`. The query SHALL accept optional filters for event type(s) and date range. Pages MUST NOT skip or duplicate events when new events arrive between page requests.

#### Scenario: First page and continuation

- **WHEN** an admin requests the feed without a cursor and then requests the next page with the returned cursor
- **THEN** the two pages are contiguous, reverse-chronological, and share no events — even if new events were recorded between the two requests

#### Scenario: Non-admin access is rejected

- **WHEN** an authenticated user without the ADMIN role calls the feed query
- **THEN** the request is rejected with an authorization error

### Requirement: Deletion events snapshot the record and support restore

When a loan application is hard-deleted, the `application.deleted` event payload SHALL contain a full JSON snapshot of the deleted row. The apiserver SHALL expose an admin-only `restoreApplication` mutation that re-creates the application from that snapshot and records an `application.restored` event, permitted only within 30 days of the deletion event. Restore MUST validate before writing and return a structured error on conflicts (e.g. a unique field now in use) without partial writes.

#### Scenario: Restore within the window

- **WHEN** an admin restores an application from a deletion event that is 5 days old
- **THEN** the application row is re-created from the snapshot and an `application.restored` event is recorded

#### Scenario: Restore after the window is rejected

- **WHEN** an admin attempts to restore from a deletion event older than 30 days
- **THEN** the mutation is rejected with a structured error and no row is created

#### Scenario: Restore conflict fails cleanly

- **WHEN** restoring would violate a unique constraint (e.g. the snapshot's `sessionId` is in use)
- **THEN** the mutation returns a structured conflict error and neither the application nor a restored event is written
