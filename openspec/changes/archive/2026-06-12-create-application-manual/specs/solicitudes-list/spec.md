## MODIFIED Requirements

### Requirement: Applications list screen

The dashboard SHALL provide a `/solicitudes` screen that lists loan applications from `listApplications`, with columns for solicitud (id + date), applicant (name + business), requested amount (RD$), score, evaluador, and status. Status renders as plain text (Pencil v2 — no pill): muted by default, green for "Nueva". The toolbar pairs the status tabs with a search input. The page header SHALL include a "Nueva solicitud" primary action button that opens the manual-create modal.

#### Scenario: List loads and renders

- **WHEN** a reviewer navigates to `/solicitudes`
- **THEN** applications are fetched and rendered one row each with the documented columns

#### Scenario: Loading, error, empty states

- **WHEN** the query is loading, fails, or returns no rows
- **THEN** the screen shows a loading indicator, an error message, or an empty-state respectively

#### Scenario: Row opens the detail

- **WHEN** the reviewer clicks a row
- **THEN** the app navigates to `/solicitudes/:id` for that application

#### Scenario: Nueva solicitud button is visible

- **WHEN** a reviewer is on the `/solicitudes` screen
- **THEN** a "Nueva solicitud" button is visible in the page header

#### Scenario: Nueva solicitud button opens the modal

- **WHEN** the reviewer clicks "Nueva solicitud"
- **THEN** the `NuevaSolicitudModal` opens
