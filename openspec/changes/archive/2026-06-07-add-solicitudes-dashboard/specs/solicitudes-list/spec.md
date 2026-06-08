## ADDED Requirements

### Requirement: Applications list screen

The dashboard SHALL provide a `/solicitudes` screen that lists loan applications from `listApplications`, with columns for applicant (name + business), requested amount (RD$), score with risk-band badge, status, and date.

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

The list SHALL provide status-filter tabs over the lifecycle (Todas / Nuevas / En revisión / Aprobadas / Firmadas / Convertidas / Rechazadas / Borradores) and a search over applicant name.

#### Scenario: Status tab filters

- **WHEN** the reviewer selects a status tab
- **THEN** the list shows only applications in that status (via the `status` query param)

#### Scenario: Search narrows by name

- **WHEN** the reviewer types in search
- **THEN** rows are filtered to applicants whose name contains the text (case-insensitive)

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
