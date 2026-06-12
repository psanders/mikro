## ADDED Requirements

### Requirement: Export the projection model as a branded PDF

The Modelo de negocio page SHALL provide an action that exports the current projection as a branded PDF. The PDF SHALL be generated server-side with pdfkit using the same brand treatment as the Loan Application documents (the `mikro` wordmark, Inter typography, and the brand palette), and SHALL reflect the parameters currently applied on the page.

#### Scenario: Operator exports the current projection

- **WHEN** an operator has a valid projection on screen and triggers "Exportar PDF"
- **THEN** the server renders a branded PDF (`application/pdf`) of that projection and the file is offered to the operator to save

#### Scenario: PDF content mirrors the on-screen projection

- **WHEN** the PDF is generated for a given set of parameters
- **THEN** it contains the same projection the page shows — key stats (break-even, mature monthly profit, ROI, minimum loans/week), the monthly projection, and the sensitivity scenarios — computed from the same projection engine

#### Scenario: Brand matches the Loan Application PDFs

- **WHEN** the PDF is rendered
- **THEN** it uses the `mikro` wordmark, Inter fonts, and the brand palette consistent with the application summary/contract PDFs

#### Scenario: Export is unavailable for invalid parameters

- **WHEN** the current parameters do not form a valid, runnable projection
- **THEN** the export action is disabled and no report is requested

### Requirement: Saving works in both Tauri and web

The export SHALL save the PDF through the shared `saveFile` helper so it behaves correctly in both runtime targets, with no target-specific code on the page.

#### Scenario: Desktop app uses the native save dialog

- **WHEN** the export runs inside the Tauri desktop app
- **THEN** a native save dialog opens and the chosen path is written to disk as a PDF

#### Scenario: Web build downloads the file

- **WHEN** the export runs in the web build
- **THEN** the browser downloads the PDF

#### Scenario: Cancelling the native dialog is a no-op

- **WHEN** the operator cancels the Tauri save dialog
- **THEN** nothing is written and no error is surfaced

### Requirement: Projection is computed from a single shared engine

The projection used by the page and the projection used by the PDF renderer SHALL come from one shared, browser-safe engine in `@mikro/common`, so the on-screen result and the exported PDF cannot diverge.

#### Scenario: Server recomputes deterministically from parameters

- **WHEN** the export procedure receives the projection parameters
- **THEN** it runs the shared projection engine and renders the PDF from that result, producing the same numbers the page derived from the same parameters

#### Scenario: Dashboard bundle stays browser-safe

- **WHEN** the dashboard imports the shared projection engine
- **THEN** the import pulls no server-only modules (no `fs`/Node bindings) into the browser bundle
