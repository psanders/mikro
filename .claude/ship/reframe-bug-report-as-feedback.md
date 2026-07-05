# Ship checkpoint — reframe-bug-report-as-feedback

Started: 2026-07-04
Current stage: BUILD + TEST done (green) · SYNC/ARCHIVE gated (awaiting user)

Branch: `refactor/reframe-bug-report-as-feedback` (off the other agent's committed retry work c0d5479).

**Scope:** Reframe the in-app "Bug report" feature as **"Feedback"** across every surface —
not every submission is a bug (could be an issue, something confusing, or a feature idea).
User-facing term = **"Feedback"** (kept English word); code identifier = **`feedback`**.
**One generic flow** (no type/category picker). Mobile = relabel only. Desktop = swap the
bug icon for a square message icon (`message-square`) + hover tooltip "Enviar feedback",
and give every nav-rail icon the same tooltip treatment.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (`pencil.pen`) · Storybook: yes
(`mods/dashboard/.storybook`, `mods/mobile/.storybook`) · E2E: no.

**Blocked by:** working tree still dirty with another agent's `bugReport*` edits
(`BugReportButton.tsx`, `BugReportStatusModal.tsx`, `BugReportContext.tsx`,
`common/utils/bugReportSubmit.ts`). The rename collides with that WIP — no code until it lands.

| #   | Stage           | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| :-- | :-------------- | :------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done    | Decisions locked via AskUserQuestion: term "Feedback", one generic flow. OpenSpec change now scaffolded (below).                                                                                                                                                                                                                                                                                                                                    |
| 1   | Design (Pencil) | done    | See Pencil changes below. Desktop icon swap + tooltip + missing-rail fix, all flow-screen copy relabeled (desktop + mobile), screen layer names renamed.                                                                                                                                                                                                                                                                                            |
| 2   | Spec reconcile  | done    | Change `reframe-bug-report-as-feedback` created: new `feedback-submission` capability (ADDED) + MODIFIED deltas on `bug-report-desktop-capture` / `bug-report-mobile-capture` (submitBugReport→submitFeedback, message icon, wording). `openspec validate --strict` clean. Capture spec IDs kept as historical names by design.                                                                                                                     |
| 3   | Build           | done    | common → apiserver → dashboard → mobile all renamed. New `Tooltip` component (+story) routes RailItem + feedback button (native `title=` gone). GitHub issue reframed generic (structured shape now title/summary/details; files under `feedback/`, unlabeled). Tauri IPC commands renamed `*_feedback_recording` + `FeedbackCaptureState` — `cargo check` clean. Config key `githubBugReport`→`githubFeedback` in mikro.json + mikro.json.example. |
| 4   | Test            | done    | common 24, apiserver 341, mobile jest 47 (4 suites) all passing; typecheck green in all 4 packages; my files lint-clean; `cargo check` clean. Kept validation-failure cases (apiserver precondition never fires side effect; mobile no-file case). No e2e infra. 6.3 (drive the live dashboard flow) not yet done.                                                                                                                                  |
| 5   | Sync            | pending | gate — awaiting user.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 6   | Archive         | pending | gate — awaiting user.                                                                                                                                                                                                                                                                                                                                                                                                                               |

### Migration note (breaking, config)

`mikro.json` renames config key `githubBugReport` → `githubFeedback` (schema is `.strict()`,
so a deployed config with the old key will fail validation until renamed). Both the tracked
`mikro.json.example` and the local `mikro.json` were updated.

## Pencil work done (stage 1)

Desktop founder board `EzobQ`:

- Swapped `bug` → `message-square` in all 7 Feed-section rails (`navBug`→`navFeedback`):
  icons ZVnKZ, REzfv, HtrwA, LDltW, nTKDP, glC4R, h7yPF.
- **Missing-rail fix** (user-flagged): the Búsqueda `lUyNi`, Copiloto `LXY1h`, Reportes `PK0Om`
  rails (newer `nav-*` variant) never had a feedback entry — inserted a `message-square`
  `navFeedback` (index 7, before avatar) in each.
- Tooltip: dark pill "Enviar feedback" + caret on the feedback icon in feed screen `YrWVt`
  (nodes MwMih/k86Z7/Ry05b). Design note `poEVG` documents that ALL rail icons get the same
  hover tooltip (replaces native browser `title`).
- Flow-screen copy relabeled: consent bZWjW/Jc6pU, enviando OVmXZ/P2pR4, enviado CdFww/AFOI2,
  grabando pill Z6ZDX. Screen layer names → "Founder / Enviar feedback — …", section `mBWYC`.

Mobile shared cluster `nCQnp`:

- Consent `v8bmyV`: header title XlCal, body Mqn8P, icon oI6Fw (`bug`→`message-square`).
- Enviando `rv2oJ` (mOX6r/yNbiV), Enviado `fsDNM` (OY9JM/o1CCs), Error `oTSL4` (kuSuJ/LQ0UJ).
- Perfil rows `stJx6` (shared) + `Xb9g3` (grabando overlay): label "Enviar feedback" + `message-square`.
- Screen names → "11a–11e Enviar feedback · …".

## Code rename map (stage 3, when unblocked)

- `mods/common`: `schemas/bugReport.ts`→`feedback.ts`; `utils/bugReportSubmit.ts`→`feedbackSubmit.ts`
  (`submitBugReportWithRetry`→`submitFeedbackWithRetry`, `toSpanishBugReportError`→`toSpanishFeedbackError`);
  fix BOTH barrel exports (schemas/index.ts + root index.ts double-barrel).
- `mods/apiserver`: tRPC `submitBugReport`→`submitFeedback`; `bugReports/createSubmitBugReport.ts`
  →`feedback/createSubmitFeedback.ts`; reframe GitHub issue title/label from bug→feedback.
- `mods/dashboard`: `BugReportButton.tsx`→`FeedbackButton.tsx`, `Bug`→`MessageSquare`; new reusable
  `Tooltip` component; route RailItem + feedback button through it (replaces native `title=`),
  handle keyboard-focus + touch fallback; relabel copy.
- `mods/mobile`: rename `components/bugReport/*` + `lib/bugReport/*` → `feedback/*` and identifiers,
  behavior unchanged; relabel copy.

## Decision log

- 2026-07-04 — Term "Feedback" (English kept), one generic flow, no category picker (AskUserQuestion).
- 2026-07-04 — Pencil design done. User flagged Búsqueda/Copiloto/Reportes screens missing the
  feedback icon (their newer `nav-*` rails never had it) — added `navFeedback` to all 3.
- 2026-07-04 — Held all code changes: other agent's `bugReport*` WIP still uncommitted; rename would collide.
