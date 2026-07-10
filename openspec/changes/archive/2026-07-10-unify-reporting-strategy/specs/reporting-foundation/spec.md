## ADDED Requirements

### Requirement: Shared report contract produces JSON and PDF

`@mikro/common` SHALL expose a single reporting module through which a report is defined once as a typed data model and rendered to both a JSON payload and a branded PDF. Every report entry point (CLI, dashboard, copilot) SHALL consume this module rather than reimplementing report generation. A report definition SHALL declare its typed input, a `toJson` projection, and a PDF layout; callers SHALL request `json`, `pdf`, or both from the same definition and receive equivalent content for a given input.

#### Scenario: Same report yields equivalent JSON and PDF

- **WHEN** a caller renders a report definition for a given input requesting both formats
- **THEN** a JSON payload and a PDF are produced from the same underlying data model, with no separate/duplicated generation path per format

#### Scenario: JSON payload is the canonical data

- **WHEN** a caller renders a report to JSON
- **THEN** the JSON contains the full typed data model used to draw the PDF (so the PDF adds only presentation, never data)

### Requirement: Unified branded PDF renderer

The reporting module SHALL provide a branded PDF renderer built on the existing receipts font pipeline (`mods/common/src/receipts/`, Inter) and Mikro brand tokens (blue-deep `#103A8A`, ink `#14254A`, orange-primary `#F68A1F`, orange-deep `#E85B1C`, yellow-accent `#FFD447`, mist `#E9F2FF`). The renderer SHALL support a multi-page document composed of reusable blocks — a brand header (tile logo + title/subtitle + right-aligned meta), a verification/notice banner (bold headline + explanation), a summary KPI grid (bordered cells with label, value, and optional subtext; values may be emphasized in orange), a data table with text status pills, and a secondary detail/ledger page — matching the issue #161 look/feel. The output SHALL be a valid multi-page PDF.

#### Scenario: Renders a multi-page branded PDF

- **WHEN** a report supplies a header, a verification banner, a KPI grid, a status-pill table, and a secondary detail page
- **THEN** a valid multi-page PDF is produced using the Mikro brand tokens and Inter, with each declared block present

#### Scenario: Reuses the receipts font pipeline

- **WHEN** the PDF renderer loads fonts
- **THEN** it uses the same Inter font-loading path as the receipts generator (no separate font embedding)

### Requirement: FIFO waterfall-allocation helper

`@mikro/common` SHALL expose a single tested helper that allocates a loan's non-reversed payment ledger across cuotas by FIFO waterfall — cuota _N_ is covered once cumulative installment money paid reaches _N_ × cuota amount — returning per-cuota amount-applied and coverage. This helper SHALL be the only implementation of that allocation; reports and scripts SHALL NOT reimplement it.

#### Scenario: Allocates cumulative payments across cuotas

- **WHEN** cumulative non-reversed installment payments reach _N_ × the cuota amount
- **THEN** the helper reports cuotas 1.._N_ as covered and the remainder as applied to the next cuota

#### Scenario: Reversed payments are excluded

- **WHEN** the ledger contains reversed payment rows
- **THEN** those rows do not contribute to any cuota's allocation

### Requirement: Repayment-schedule builder

`@mikro/common` SHALL expose a tested builder that produces a per-cuota repayment schedule (cuota number, due date, coverage date, status, amount applied) for a loan, computing due dates via `getDueDateForCycle` and coverage/status via the waterfall-allocation helper and `buildLoanSnapshot`/`evaluateSnapshot`. It SHALL NOT recompute terms, due dates, or health independently.

#### Scenario: Schedule has one row per cuota with a due date

- **WHEN** the builder runs for a loan of term length _T_
- **THEN** it returns _T_ rows, each with a due date from `getDueDateForCycle` and a status/amount derived from the allocation helper
