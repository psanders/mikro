## MODIFIED Requirements

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
