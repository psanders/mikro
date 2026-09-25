# ops-application-flow Specification

## Purpose

TBD - created by archiving change add-application-review-flow. Update Purpose after archive.

## Requirements

### Requirement: Reviewers can use the Ops app with a scoped shell

The Ops app (served at `/ops`; formerly the founder app) SHALL admit users with the ADMIN role (full shell) and users with the REVIEWER role but not ADMIN (a scoped shell: the feed only — no search, Tareas, Reportes or copilot, since those expose non-application data). Other users SHALL see the access screen. A user with both roles gets the full shell.

#### Scenario: Reviewer signs in

- **WHEN** a REVIEWER-only user signs in to the Ops app
- **THEN** they see the feed, and no search, Tareas, Reportes or copilot entry

#### Scenario: Old founder links still work

- **WHEN** someone opens `/founder` or any `/founder/...` path
- **THEN** they are redirected to `/ops`

#### Scenario: Collector is turned away

- **WHEN** a COLLECTOR-only user signs in
- **THEN** they see the access screen

### Requirement: The feed shows each role only the applications that need it

The feed SHALL be role-scoped for application events:

- a REVIEWER sees `application.received` events whose application is still `RECEIVED` (the shared queue), plus all events of applications assigned to them
- an ADMIN sees `application.sent_to_decision` events whose application is still `PENDING_DECISION`, plus all events of applications they decided
- a user with both roles sees the union

Each application card SHALL show the application's current status as a single label, never the full path. Violet is used only for applications in progress, green/red only for final outcomes (converted/rejected), and amber only for something missing.

#### Scenario: Reviewer sees the queue and their own work

- **WHEN** a reviewer opens the feed with one unassigned `RECEIVED` application and one assigned to another reviewer
- **THEN** only the unassigned one appears

#### Scenario: Admin sees only what awaits a decision

- **WHEN** an ADMIN-only user opens the feed with applications in `RECEIVED`, `IN_REVIEW` and `PENDING_DECISION`
- **THEN** only the `PENDING_DECISION` one appears as an application card

### Requirement: Each card has one primary action, the next pending step

An application card whose viewer has an action SHALL be highlighted and show exactly one primary action, the next pending step:

- "Tomar" on `RECEIVED`
- "Subir evidencia" on `IN_REVIEW` while evidence is incomplete, then "Enviar a decisión"
- the inline decision block for an admin on `PENDING_DECISION`
- "Subir contrato firmado", then "Registrar desembolso", on `APPROVED`

Unavailable actions SHALL render disabled with the reason from `evaluateTransition`. Reject/return actions whose input is required SHALL be labelled with an ellipsis ("Rechazar…"). A card for which the viewer has no action SHALL NOT be highlighted.

#### Scenario: RECEIVED only offers taking it

- **WHEN** a reviewer expands a `RECEIVED` card
- **THEN** the only action is "Tomar"; there is no edit or upload

#### Scenario: Send is disabled until evidence is complete

- **WHEN** an `IN_REVIEW` card has no ID back image
- **THEN** "Enviar a decisión" is disabled and the evidence block shows the missing piece

#### Scenario: Admin decides inline

- **WHEN** an admin expands a `PENDING_DECISION` card
- **THEN** it shows score, AI summary, evidence status, the reviewer's recommendation, editable approved amount and term, a note, and "Aprobar", "Devolver a …", "Rechazar…"

### Requirement: Closed applications leave the active view

When an application becomes `CONVERTED`, `REJECTED` or `ABANDONED`, its entries SHALL fold, for every viewer, into one non-highlighted "Cerradas" group row per day, listing each application with its outcome label. The acting user SHALL see a brief confirmation that the card moved.

#### Scenario: Conversion moves the card

- **WHEN** a reviewer confirms a disbursement
- **THEN** the application's card disappears from the active list and appears in today's "Cerradas" group as "Convertida"

### Requirement: All application detail and actions live in one side panel

The Ops app SHALL use a single right side panel (600 px) for:

- the full application: data, evidence, activity timeline, conversation
- edit: accordion of form sections, data only
- evidence: two fixed ID slots, business photos, other documents
- disbursement: approved terms, collector, source account with balances, optional receipt
- admin assignment

Nested views SHALL show a "← Solicitud de …" back crumb and a pinned footer with the view's actions. The Ops app SHALL contain no modal dialogs.

#### Scenario: Evidence opens in the panel

- **WHEN** the assignee clicks "Subir evidencia"
- **THEN** the evidence view opens in the side panel with the feed still visible behind it

#### Scenario: Disbursement shows what will happen

- **WHEN** the disbursement view is open
- **THEN** it states that confirming creates the customer and loan, posts the withdrawal on the chosen account, and moves the application to Convertida
