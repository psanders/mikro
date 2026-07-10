## ADDED Requirements

### Requirement: Reports are produced as JSON and branded PDF only

Every report entry point (CLI, dashboard, copilot) SHALL produce reports through the shared reporting foundation as JSON and/or branded PDF. The six Pencil-designed reports — loan-statement, performance, customers, defaulted, renewal, accounting — SHALL each be available as JSON and PDF, produced from a single shared `defineReport` definition per report so that the same report and format yield equivalent output regardless of surface.

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
