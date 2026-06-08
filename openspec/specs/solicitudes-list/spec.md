# solicitudes-list Specification

## Purpose

TBD - created by archiving change add-solicitudes-dashboard. Update Purpose after archive.

## Requirements

### Requirement: Applications list screen

The dashboard SHALL provide a `/solicitudes` screen that lists loan applications from `listApplications`, with columns for solicitud (id + date), applicant (name + business), requested amount (RD$), score, evaluador, and status. Status renders as plain text (Pencil v2 — no pill): muted by default, green for "Nueva". The toolbar pairs the status tabs with a search and a (visual-only) "Filtros" button.

#### Scenario: List loads and renders

- **WHEN** a reviewer navigates to `/solicitudes`
- **THEN** applications are fetched and rendered one row each with the documented columns

#### Scenario: Loading, error, empty states

- **WHEN** the query is loading, fails, or returns no rows
- **THEN** the screen shows a loading indicator, an error message, or an empty-state respectively

#### Scenario: Row opens the detail

- **WHEN** the reviewer clicks a row
- **THEN** the app navigates to `/solicitudes/:id` for that application

### Requirement: Status filtering and search

The list SHALL provide status-filter tabs over the lifecycle (Todas / Nuevas / En evaluación / Aprobadas / Documentos / Convertidas / Rechazadas) and a search over applicant name. The selected status filter and search text SHALL persist for the session, so returning to the list from a detail restores the same view.

#### Scenario: Status tab filters

- **WHEN** the reviewer selects a status tab
- **THEN** the list shows only applications in that status (via the `status` query param)

#### Scenario: Search narrows by name

- **WHEN** the reviewer types in search
- **THEN** rows are filtered to applicants whose name contains the text (case-insensitive)

#### Scenario: Filter is remembered across navigation

- **WHEN** the reviewer selects a status tab (and/or types a search), opens a solicitud, then returns to the list
- **THEN** the previously selected status tab and search text are still applied

### Requirement: Pagination

The list SHALL support loading additional pages via a "Cargar más" control using `limit`/`offset`.

#### Scenario: Load more appends

- **WHEN** more rows exist and the reviewer clicks "Cargar más"
- **THEN** the next page is fetched and appended

### Requirement: Access is reviewer-gated in the UI

The screen SHALL handle the case where the signed-in user lacks review access.

#### Scenario: Non-reviewer sees an access message

- **WHEN** `listApplications` returns a forbidden error (user is not ADMIN/REVIEWER)
- **THEN** the screen shows a clear "no access" message rather than a generic error
