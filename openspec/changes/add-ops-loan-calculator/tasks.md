## 1. Design

- [x] 1.1 Pencil: icon-only calculator header button + calculator panel (EzobQ sec-10 `ZEWm6`), incl. invalid-input state

## 2. Build

- [x] 2.1 `LoanCalculatorPanel` component (inputs, option table, inline error) using `calculateLoanOptions` + `calculateLoanSchema`
- [x] 2.2 Storybook stories: default, weekly example, invalid input
- [x] 2.3 Feed header icon-only calculator button for ADMIN + REVIEWER
- [x] 2.4 Single-panel wiring: calculator and application panel replace each other

## 3. Test

- [x] 3.1 Unit test for the input → params mapping (percent → rate, validation failure)
- [x] 3.2 Playwright: admin and reviewer open calculator, weekly example values, invalid input, close with Escape
- [x] 3.3 Lint, typecheck, tests green

## 4. Close

- [x] 4.1 Sync delta into `openspec/specs/ops-application-flow`
- [ ] 4.2 Archive change
