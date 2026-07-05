## Why

The in-app "bug report" feature (mikro/#69) frames every submission as a defect, but that
framing is wrong for its audience. Field users (evaluators, collectors) and founders often
want to flag something that isn't a bug at all — a confusing screen, a rough edge, or a
feature idea. Calling the entry point "Reportar un problema" and the icon a bug discourages
exactly the non-defect feedback that's most useful early. Reframing the feature as
**"Feedback"** (one generic, low-friction channel) captures all of it, and the desktop nav
rail gets a clearer square-message icon plus tooltips.

## What Changes

- Rename the feature end-to-end from "bug report" to **Feedback**. User-facing term is
  **"Feedback"** (the English word, common in LatAm product UIs); the code identifier is
  `feedback`. **One generic flow** — no category/type picker; the team triages after.
- **API / functions**: tRPC `submitBugReport` → `submitFeedback`; `@mikro/common`
  `bugReport` schema + `bugReportSubmit` utils → `feedback` equivalents; apiserver
  `createSubmitBugReport` → `createSubmitFeedback`. The filed GitHub issue is reframed from a
  bug-labeled report to generic feedback (no "bug" label forced on it).
- **Desktop**: swap the `Bug` icon for a square message icon (`MessageSquare`); add a hover
  **tooltip** ("Enviar feedback"), and give **every** nav-rail icon the same tooltip
  treatment (replacing the native browser `title` attribute).
- **Mobile**: relabel only — same flow, copy changes to "Feedback", entry-point row icon
  swaps from bug to message.
- Recording/consent/upload behavior is otherwise unchanged on both platforms.

## Capabilities

### New Capabilities

- `feedback-submission`: the reframed feature contract — a single generic in-app feedback
  channel, the `submitFeedback` API, the desktop square-message entry icon with nav-rail
  tooltips, and generic (non-bug) GitHub issue filing.

### Modified Capabilities

- `bug-report-desktop-capture`: capture path and scenarios now submit to `submitFeedback`
  and are triggered from the feedback (message) icon and feedback dialog.
- `bug-report-mobile-capture`: entry point is the "Feedback" profile row (message icon), and
  the recording submits to `submitFeedback`.

(The two capture-capability spec IDs keep their `bug-report-*` names as historical
identifiers; the code, UX, and copy they describe are fully reframed to "feedback". Renaming
the spec folders is deliberately out of scope to avoid churn during sync.)

## Impact

- `mods/common`: `schemas/bugReport.ts` → `feedback.ts`; `utils/bugReportSubmit.ts` →
  `feedbackSubmit.ts` (`submitBugReportWithRetry`, `toSpanishBugReportError` renamed); both
  barrel exports updated (schemas/index.ts + root index.ts double-barrel).
- `mods/apiserver`: `submitBugReport` mutation → `submitFeedback`;
  `bugReports/createSubmitBugReport.ts` → `feedback/createSubmitFeedback.ts`; GitHub issue
  title/label reframed generic; existing tests renamed.
- `mods/dashboard`: `BugReportButton.tsx` → `FeedbackButton.tsx`, `Bug` → `MessageSquare`;
  new reusable `Tooltip` component routed through `RailItem` + the feedback button (replaces
  native `title=`, with keyboard-focus + touch fallback); copy relabeled.
- `mods/mobile`: `components/bugReport/*` + `lib/bugReport/*` → `feedback/*` and identifiers,
  behavior unchanged; profile-row + modal copy relabeled; entry icon → message.
- `pencil.pen`: DONE — desktop rail icon swap (message-square) + tooltip, missing-rail fix on
  Búsqueda/Copiloto/Reportes screens, all flow-screen copy relabeled (desktop + mobile),
  screen layer names renamed.
- **Sequencing**: blocked on the other agent's in-flight `bugReport*` edits landing first —
  this rename collides with that working-tree WIP.
