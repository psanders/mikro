# Ship checkpoint — add-ops-loan-calculator

Started: 2026-09-28
Current stage: done

**Scope:** "Calculadora" button in the Ops Feed header (ADMIN + REVIEWER) opens the loan calculator in the 600px side panel. Client-side via shared `calculateLoanOptions` + `calculateLoanSchema`; no API change. Copilot stays admin-only.

**Detected surfaces:** OpenSpec: yes · Pencil: yes · Storybook: yes (mods/dashboard) · E2E: yes (mods/dashboard/e2e, Playwright)

Branch: `feat/ops-loan-calculator`

| #   | Stage           | Status | Notes                                                                                            |
| :-- | :-------------- | :----- | :----------------------------------------------------------------------------------------------- |
| 0   | Frame           | done   | proposal/spec/tasks written, validates                                                           |
| 1   | Design (Pencil) | done   | sec-10 ZEWm6: YtBtg panel, V9f4nY invalid, k9TQ1 admin header; approved w/ icon-only button      |
| 2   | Spec reconcile  | done   | icon-only button; one-panel scenario → Escape-close (scrim makes it unreachable)                 |
| 3   | Build           | done   | common calculateFromForm; LoanCalculatorPanel + stories; provider kind union; header btn         |
| 4   | Test            | done   | common 294 ✓ (5 new); e2e 10/10 (2 new); lint/typecheck/prettier ✓; storybook visual vs Pencil ✓ |
| 5   | Sync            | done   | ADDED req in ops-application-flow; commit 2ef2d7e                                                |
| 6   | Archive         | done   | openspec/changes/archive/2026-09-28-add-ops-loan-calculator                                      |

## Decision log

- 2026-09-28 — Archived (user-approved). Shipped in PR #314.

- 2026-09-28 — /code-review low: 1 finding (parse could throw on Infinity) fixed in dfefcb0 w/ safeParse + test. CI green, PR #314 squash-merged as b608580; branch deleted local+remote. Archive pending user gate.

- 2026-09-28 — PR #314 opened. pencil.pen committed whole (user choice, incl. unrelated pending edits). sec-08 evaluator frames fixed (copilot→calc), admin frames gained calc btn.

- 2026-09-28 — Parser in @mikro/common/utils (feedbackSubmit precedent) so it's mocha-testable; dashboard has no unit runner.
- 2026-09-28 — User approved design; button icon-only light like copilot.

- 2026-09-28 — Pencil sec-10 drafted (new section, not §08). Button = icon+label "Calculadora" pill (blue filled when panel open). Drift noted: existing evaluator frames show copilot btn; code hides it.

- 2026-09-28 — Client-side calc (shared common fn) over tRPC query: instant, same logic, no backend change.
- 2026-09-28 — Placement: Feed header button → side panel (user choice over rail item / in-application action).
- 2026-09-28 — Checkpoint created. Server `calculateLoan` already `protectedProcedure`; gap is UI only (copilot admin-only).
