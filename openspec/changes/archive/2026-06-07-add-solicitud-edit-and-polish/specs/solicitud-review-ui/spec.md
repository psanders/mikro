## ADDED Requirements

### Requirement: Edit a solicitud from the detail

The detail screen SHALL provide an "Editar" action (hidden once `CONVERTED`) that opens a modal with the application's fields grouped by section (Personal / Negocio / Crédito / Referencias / Vivienda), prefilled and editable. Saving calls `updateApplication`, then refreshes the detail and list.

#### Scenario: Open and save edits

- **WHEN** a reviewer clicks "Editar", changes fields, and saves
- **THEN** `updateApplication` is called with the changed fields and the detail refreshes showing the updated data and recomputed score

#### Scenario: Enumerated fields use the form vocabulary

- **WHEN** the edit modal renders enumerated fields (estado civil, tipo de negocio, ventas mensuales, etc.)
- **THEN** they are selects using the same option values as the public form, so the score keeps matching

#### Scenario: Edit hidden after conversion

- **WHEN** the application is `CONVERTED`
- **THEN** the "Editar" action is not shown
