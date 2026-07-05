# Tasks — reframe-bug-report-as-feedback

> Blocked: do not start section 2+ until the other agent's in-flight `bugReport*` working-tree
> edits are committed/merged. Section 1 (Pencil) is done.

## 1. Design (Pencil) — DONE

- [x] 1.1 Desktop: swap `bug` → `message-square` in all founder nav rails
- [x] 1.2 Desktop: add feedback icon to Búsqueda/Copiloto/Reportes rails that were missing it
- [x] 1.3 Desktop: tooltip on the feedback icon + design note that all rail icons get tooltips
- [x] 1.4 Relabel all flow-screen copy (desktop + mobile) to "Feedback"; swap mobile entry icon
- [x] 1.5 Rename screen layer names "Reportar un problema" → "Enviar feedback"

## 2. Shared contract — `mods/common`

- [x] 2.1 Rename `schemas/bugReport.ts` → `schemas/feedback.ts`; rename exported types
- [x] 2.2 Rename `utils/bugReportSubmit.ts` → `utils/feedbackSubmit.ts`
      (`submitBugReportWithRetry` → `submitFeedbackWithRetry`, `toSpanishBugReportError` →
      `toSpanishFeedbackError`)
- [x] 2.3 Update BOTH barrel exports (schemas/index.ts + root index.ts double-barrel)
- [x] 2.4 Rename the util test under `test/utils/`; keep a validation-failure case

## 3. API — `mods/apiserver`

- [x] 3.1 Rename tRPC `submitBugReport` → `submitFeedback`
- [x] 3.2 Rename `bugReports/createSubmitBugReport.ts` → `feedback/createSubmitFeedback.ts`
- [x] 3.3 Reframe the filed GitHub issue as generic feedback; do not force a "bug" label
- [x] 3.4 Rename `test/bugReports/createSubmitBugReport.test.ts` and update assertions,
      including a validation-failure case asserting the side effect never fired

## 4. Desktop — `mods/dashboard`

- [x] 4.1 Rename `BugReportButton.tsx` → `FeedbackButton.tsx`; `Bug` → `MessageSquare`
- [x] 4.2 Build a reusable `Tooltip` component (Storybook story per state); keyboard-focus +
      touch fallback, `aria-label` preserved
- [x] 4.3 Route `RailItem` + the feedback button through `Tooltip` (replace native `title=`)
- [x] 4.4 Relabel all copy to "Feedback" (consent/enviando/enviado/error)

## 5. Mobile — `mods/mobile`

- [x] 5.1 Rename `components/bugReport/*` + `lib/bugReport/*` → `feedback/*` and identifiers
- [x] 5.2 Relabel profile-row + modal copy; entry icon → message; behavior unchanged
- [x] 5.3 Update mobile tests (jest) for renamed modules

## 6. Verify

- [x] 6.1 Repo lint + typecheck green across common/apiserver/dashboard/mobile
- [x] 6.2 Grep for stray `bugReport` / "Reportar un problema" identifiers and copy
- [ ] 6.3 Drive the dashboard feedback flow (icon → tooltip → consent → send) once
