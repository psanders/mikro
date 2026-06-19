## ADDED Requirements

### Requirement: Pointer affordance on interactive elements

Clickable rows and interactive components that are not native buttons/links — table and list rows that open a detail, nav rows, list tiles, and custom toggles — MUST show a pointer cursor on hover, so it is visually clear they are actionable.

#### Scenario: Hovering a clickable row

- **WHEN** the user hovers over a table/list row that navigates to a detail (e.g. a Solicitudes, Clientes, or Contabilidad row)
- **THEN** the cursor changes to a pointer

#### Scenario: Hovering an interactive component

- **WHEN** the user hovers over an interactive design-system element rendered as a `div`/`span` (nav row, tile, toggle)
- **THEN** the cursor changes to a pointer

### Requirement: Back navigation via existing chrome

Detail screens SHALL NOT render a per-screen back breadcrumb (e.g. "Volver a solicitudes"). Returning to a list SHALL be done through the existing chrome — the sidebar navigation item for the section and the page-header context line — to reclaim vertical space and match the Pencil designs.

#### Scenario: Detail screen omits the breadcrumb

- **WHEN** a detail screen (Solicitud, Cliente, Transacción) renders
- **THEN** it shows no "Volver a …" breadcrumb component, and the corresponding sidebar nav item is the way back to the list
