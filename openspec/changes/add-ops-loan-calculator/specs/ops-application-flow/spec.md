## ADDED Requirements

### Requirement: Admins and reviewers can run the loan calculator from the feed

The Feed header SHALL show an icon-only calculator button (accessible name "Calculadora", same style as the copilot button) to users with the ADMIN or REVIEWER role. It SHALL open the loan calculator in the side panel, with the feed still visible behind it. Nothing is saved; closing the panel (✕, Escape or clicking outside it) discards the inputs.

The calculator SHALL take Monto (RD$), Tasa total (%, default 30), Frecuencia (Diario, Semanal, Quincenal, Mensual; default Semanal) and Plazo base (whole periods). It SHALL show the options produced by the shared loan calculator — for each: plazo, tasa, interés total, total a pagar and cuota por período — with the base plazo row marked. Results SHALL update as inputs change. When an input is missing or invalid (non-positive monto or plazo, tasa above 100%) it SHALL show an inline message and no options.

#### Scenario: Reviewer opens the calculator

- **WHEN** a REVIEWER-only user clicks the calculator button in the Feed header
- **THEN** the calculator opens in the side panel and the copilot button is still not shown

#### Scenario: Options for a weekly loan

- **WHEN** the user enters Monto 10,000, Tasa 30%, Frecuencia Semanal, Plazo 10
- **THEN** the calculator lists plazos 7 through 13, and the marked plazo-10 row shows interés RD$ 3,000, total RD$ 13,000 and cuota RD$ 1,300

#### Scenario: Invalid input

- **WHEN** the user clears Monto
- **THEN** the calculator shows an inline message and no options

#### Scenario: Closing the calculator

- **WHEN** the calculator is open and the user presses Escape
- **THEN** the panel closes and the feed is usable again
