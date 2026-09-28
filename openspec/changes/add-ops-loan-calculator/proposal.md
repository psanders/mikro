## Why

Reviewers quote loan terms to applicants but have no way to run the numbers in the Ops app. The calculator exists (`calculateLoanOptions` in common, the `calculateLoan` tRPC query, `ctl loans:calculate`, and a copilot read tool), but the only in-app path is the copilot, which is admin-only. Admins also have to phrase a copilot prompt just to get a table.

## What Changes

- **Icon-only calculator button in the Feed header** (accessible name "Calculadora", same light style as the copilot button), visible to ADMIN and REVIEWER, next to the copilot button (the copilot button stays admin-only).
- **Calculator side panel** in the existing 600 px `SidePanel` slot (no modal, feed stays visible):
  - Inputs: Monto (RD$), Tasa total (%, default 30), Frecuencia (default Semanal), Plazo base (periods).
  - Output: the option table from `calculateLoanOptions` — plazo, tasa, interés, total a pagar, cuota — base row highlighted.
  - Recomputes as inputs change. Invalid input shows an inline message and no table.
- Computed client-side with the shared `calculateLoanOptions` + `calculateLoanSchema` from `@mikro/common`: same function the server uses, no round-trip per keystroke, no backend change.
- Shares the application panel's slot, so only one panel is ever open. Nothing is saved; closing discards the inputs.

## Capabilities

### Modified Capabilities

- `ops-application-flow`: reviewers' scoped shell gains the calculator; the side panel hosts it.

## Impact

- **dashboard:** `LoanCalculatorPanel` (+ story), feed-header button, panel wiring, Playwright spec for admin and reviewer.
- **Pencil:** calculator panel + header button on board `EzobQ` (new sec-10).
- **No API, schema, migration, or `mikro.json` change.**
