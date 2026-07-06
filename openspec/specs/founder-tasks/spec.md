# founder-tasks Specification

## Purpose

Scheduled founder tasks: a Task binds a catalog automation to a recurrence schedule (America/Santo_Domingo); an interval worker fires due tasks, gathers the payload deterministically, and surfaces open firings in the founder feed for confirm/skip. Covers the Task/TaskFiring records, the firing lifecycle, and the Tasks tab. No LLM participates in firing, confirmation, or execution.

## Requirements

### Requirement: Task definitions bind a registered automation to a schedule

The apiserver SHALL persist `Task` definitions consisting of: a reference to a registered automation (`automationId`), a display name, a recurrence schedule, the automation's bound `static` slot values, a gate (`auto` or `confirm`, never looser than the automation's declared floor), an `enabled` flag, and a precomputed `nextFireAt`. The schedule SHALL be structured fields — `frequency` (`once` | `daily` | `weekly` | `monthly`), plus `weekday` (weekly), `dayOfMonth` (monthly), and `timeOfDay` — interpreted in the `America/Santo_Domingo` timezone. A task whose `automationId` is not in the catalog, whose static slot values fail the automation's schema, or whose gate is looser than the automation's floor SHALL be rejected at creation and at edit.

#### Scenario: Create a weekly task

- **WHEN** a founder creates a task for `pay-collector` scheduled weekly on Friday at 8:00 with a valid `collectorId` static slot
- **THEN** the task is persisted with `nextFireAt` set to the next Friday 8:00 America/Santo_Domingo, expressed in UTC

#### Scenario: Gate cannot be loosened below the automation floor

- **WHEN** a task is created or edited with gate `auto` for an automation whose floor is `confirm`
- **THEN** the request is rejected with a structured validation error

#### Scenario: Month-end clamping

- **WHEN** a monthly task is scheduled for day 31 and the next month has 30 days
- **THEN** `nextFireAt` falls on the last day of that month

### Requirement: Task worker fires due tasks and gathers the payload deterministically

An interval worker SHALL poll enabled tasks with `nextFireAt <= now` and, for each, create a `TaskFiring` occurrence, advance the task's `nextFireAt` (or disable a `once` task), and run the gathering phase: every `computed` slot is resolved by the automation's deterministic resolver with no LLM involvement. Gathering outcomes: any unresolved or failed slot moves the firing to `NEEDS_INPUT`; all slots resolved with gate `confirm` moves it to `READY`; all slots resolved with gate `auto` executes immediately. A missed due time SHALL fire late rather than skip, and the worker SHALL NOT create a new firing for a task that still has an unresolved firing (older missed periods collapse into the single late firing). A worker failure on one task SHALL NOT prevent processing of the others.

#### Scenario: Confirm-gated task fires

- **WHEN** the worker processes a due `pay-collector` task and all computed slots resolve
- **THEN** a `TaskFiring` in state `READY` exists and a `task.due` business event is recorded

#### Scenario: Resolver failure surfaces as needs-input

- **WHEN** a computed slot resolver throws or returns no value during gathering
- **THEN** the firing is in state `NEEDS_INPUT` and a `task.needs_input` event is recorded naming the missing slot

#### Scenario: Downtime fires late, once

- **WHEN** the server restarts after being down across two weekly due times of the same task
- **THEN** exactly one late firing is created and `nextFireAt` advances past both missed periods

#### Scenario: Open firing blocks re-firing

- **WHEN** a task's due time arrives while a previous firing of that task is still `READY` or `NEEDS_INPUT`
- **THEN** no new firing is created and `nextFireAt` still advances

### Requirement: Confirm and skip resolve a firing without any LLM

For a firing in `READY` or `NEEDS_INPUT`, the apiserver SHALL expose founder-only procedures to read the firing's current state (automation, resolved payload, pending `ask` slots) and to resolve it. Confirm SHALL validate the supplied `ask` slot values against the automation's schema, merge them into the payload, execute the automation, and record `task.completed` on success or `task.failed` (with a reason) on error — the outcome event written immediately after the automation's mutations commit, per the event-log convention (an event-write failure is logged without failing the request; an event is never written for an execution that rolled back). Skip SHALL resolve the firing as `SKIPPED` and record a `task.completed` event flagged `skipped: true`. Resolving an already-resolved firing SHALL be rejected. No step of confirm, skip, or execution invokes an LLM.

#### Scenario: Confirm executes the automation

- **WHEN** a founder confirms a `READY` `pay-collector` firing supplying a valid amount
- **THEN** the accounting transaction is created and a `task.completed` event references the firing

#### Scenario: Invalid ask value is rejected before execution

- **WHEN** a founder confirms with an ask value that fails the automation's schema (e.g. a negative amount)
- **THEN** no execution occurs and a structured validation error is returned, the firing remaining open

#### Scenario: Double resolution is rejected

- **WHEN** a founder confirms a firing that was already confirmed or skipped
- **THEN** the request is rejected and no second execution occurs

#### Scenario: Execution failure is recorded

- **WHEN** the automation's execute throws during confirm
- **THEN** the firing is `FAILED`, a `task.failed` event carries the reason, and no partial mutations remain committed

### Requirement: Tasks tab lists definitions and creates them with a schema-driven form

The founder app SHALL include a Tasks tab listing task definitions (name, automation, schedule, next firing, enabled state) with create, edit, cancel, and a per-row pause/resume toggle (the `enabled` flag: a paused task fires nothing until resumed, and resuming recomputes `nextFireAt` forward — paused periods are not fired retroactively). The create/edit form SHALL be generated from the selected automation's param spec: `static` slots render as inputs (selects for catalog-backed values, starting with the automation itself) validated against the schema, `ask` slots are displayed as to-be-asked-at-confirmation, and the gate control is clamped to the automation's floor. Manual creation SHALL have full parity with copilot creation and require no LLM.

#### Scenario: Manual creation via generated form

- **WHEN** a founder selects `pay-collector` in the Tasks tab create form
- **THEN** the form shows inputs for the collector and accounts, indicates the amount will be asked at confirmation, and creates the same Task a copilot `createTask` call would

#### Scenario: Cancel stops future firings

- **WHEN** a founder cancels a task from the Tasks tab
- **THEN** the task stops firing, and any still-open firing of it can still be confirmed or skipped

#### Scenario: Pause and resume skip the paused periods

- **WHEN** a founder pauses a weekly task for three weeks and then resumes it
- **THEN** no firings are created for the paused weeks and `nextFireAt` is the next occurrence after the resume
