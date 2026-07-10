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

### Requirement: Reports are produced as JSON and branded PDF only

Every report entry point (CLI, dashboard, copilot) SHALL produce reports through the shared reporting foundation as JSON and/or branded PDF. The six Pencil-designed reports — loan-statement, performance, customers, defaulted, renewal, accounting — SHALL each be available as JSON and PDF, produced from a single shared `defineReport` definition per report so that the same report and format yield equivalent output regardless of surface. (The audit-log event export above remains a CSV data export and is out of scope of this rule.)

#### Scenario: A migrated report renders JSON and PDF

- **WHEN** any of the performance/customers/defaulted/renewal/accounting reports is generated for a given period/input in either format
- **THEN** a JSON payload or a branded PDF is produced from that report's single shared definition, equivalent across CLI and dashboard

#### Scenario: CLI and dashboard agree

- **WHEN** the same report and format are generated from the CLI and from the dashboard
- **THEN** the output is equivalent (same underlying definition, no per-surface reimplementation)

### Requirement: Legacy report formats and delivery are removed

Non-JSON/PDF report generation SHALL be removed: the satori→PNG report generators, all Excel (`exceljs`) report/customer-list exports, and report delivery via WhatsApp SHALL be deleted. No report entry point SHALL emit PNG or Excel.

**Reason**: #110 standardizes reporting on JSON + PDF from one shared module; PNG/Excel/WhatsApp-report paths are duplicated generation surface that is being consolidated away.

**Migration**: Callers use the JSON/PDF output of the corresponding shared report definition. WhatsApp users no longer receive report files; reports are obtained via the dashboard or CLI.

#### Scenario: No PNG or Excel report output remains

- **WHEN** the reporting surfaces (CLI, dashboard, copilot) are exercised after migration
- **THEN** no report is produced as PNG or Excel, and the WhatsApp copilot exposes no report/Excel export tool
