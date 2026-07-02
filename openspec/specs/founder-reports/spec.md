# founder-reports Specification

## Purpose

Deliberately light reports for founders: a catalog of downloadable exports of the event log (no BI builder).

## Requirements

### Requirement: Reports screen lists downloadable reports

The founder app SHALL provide a reports view at `/founder/reportes`, available to ADMIN users, rendered in the founder shell and visually matching the Pencil reports screen, showing a catalog of reports with a period selector (month). The catalog SHALL be data-driven so future reports can be added without restructuring the screen. Reports are exports of existing data (primarily the event log) — the screen SHALL NOT offer report authoring or BI-style configuration.

#### Scenario: Reports list renders

- **WHEN** an admin opens `/founder/reportes`
- **THEN** the available reports are listed with the selected period and a download action per report

### Requirement: Audit log export

The apiserver SHALL expose an admin-only report export that returns all business events for a given month as CSV (Excel-compatible), generated directly from the event log. The dashboard's "Registro de auditoría" report row SHALL trigger this export and download the file.

#### Scenario: Month export downloads

- **WHEN** an admin selects a month and downloads "Registro de auditoría"
- **THEN** a CSV containing every event of that month (type, timestamp, actor, references, amount, summary) is produced and downloaded

#### Scenario: Empty month exports headers

- **WHEN** an admin exports a month with no events
- **THEN** a valid CSV with headers and no data rows is produced

#### Scenario: Non-admin export is rejected

- **WHEN** an authenticated user without the ADMIN role calls the export
- **THEN** the request is rejected with an authorization error
