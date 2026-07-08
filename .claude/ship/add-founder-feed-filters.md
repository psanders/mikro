# Ship checkpoint — add-founder-feed-filters

Started: 2026-07-08
Current stage: Done — PR open

**Scope:** Founder feed header replaces the always-visible type-pill row with a persistent filter bar (chips left, filter icon right) opening a popup (Tipo multi-select, Actor dropdown, Rango de fechas with presets), adds backend `actorId` filtering to `listFeedEvents`, and groups consecutive same-type/same-actor events into an expandable summary row. Filter selections persist across sessions (localStorage), defaulting to Hoy. Issue #131. No new critical/routine visual priority in this change.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (`pencil.pen`, board `EzobQ`) · Storybook: yes · E2E: no (confirmed — no test runner or e2e harness exists for `mods/dashboard`; Storybook stories are this repo's test layer for dashboard components)

**PR:** https://github.com/psanders/mikro/pull/159 (branch `feat/founder-feed-filters-131`)

**Incident note:** this working directory was shared with a concurrent session shipping an unrelated feature (loan disbursement, issue #155, branch `feat/auto-deduct-loan-disbursement-155`, PR #158 — already open before this). That session's commit swept up my then-uncommitted `actorId` schema line and 3 test cases into its own commit. Left PR #158 untouched (didn't rewrite a branch with an open PR mid-flight) and instead rebuilt this feature cleanly on a new branch off `origin/main`, re-adding the two absorbed pieces by hand and re-verifying tests/lint/typecheck standalone before pushing. PR #158 still carries that small unrelated fragment — harmless (correct, tested code) but worth knowing about; flagged for the user rather than force-pushing someone else's open PR to remove it.

| #   | Stage           | Status | Notes                                                                                                                                                                                                                                                                                   |
| :-- | :-------------- | :----- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done   | Proposal/design/specs/tasks created and validated via openspec-propose                                                                                                                                                                                                                  |
| 1   | Design (Pencil) | done   | Header filter icon + chip row drafted, then user live-reviewed and asked to reconsider placement; moved filter icon out of header into a persistent filter bar (right-aligned) alongside the chips. Also added standalone filter-popup panel mockup and a grouped-run catalog specimen. |
| 2   | Spec reconcile  | done   | Updated proposal/design/specs to match the revised filter-bar placement; `openspec validate` passes                                                                                                                                                                                     |
| 3   | Build           | done   | Backend actorId filter; FilterBar/FilterPopup/GroupedFeedRow components + Storybook stories; FeedScreen wired to filter bar, actor query, localStorage persistence, and grouping                                                                                                        |
| 4   | Test            | done   | Backend integration tests (5 new, 614 passing total on the clean branch). No dashboard unit/e2e infra exists in this repo (confirmed) — Storybook stories are the test layer for dashboard components; lint+typecheck clean on all touched packages                                     |
| 5   | Sync            | done   | Both ADDED requirements merged into openspec/specs/founder-feed/spec.md                                                                                                                                                                                                                 |
| 6   | Archive         | done   | Moved to openspec/changes/archive/2026-07-08-add-founder-feed-filters                                                                                                                                                                                                                   |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-07-08 — User (awake, live) reviewed the Pencil draft and questioned header placement of the filter icon; agreed with my UI/UX recommendation to move it out of the header (decoupling it from the unrelated copilot/sparkles icon) into a persistent filter bar with chips left-aligned and the icon right-aligned, avoiding layout shift. Applied in Pencil + reconciled proposal/design/specs. Now continuing autonomously into build/test/sync/archive as originally instructed.
- 2026-07-08 — User is asleep for the rest of this run; explicitly said Pencil design is the only checkpoint they want to inspect live. Proceeding autonomously through spec→build→test→sync→archive→PR once Pencil frames are drafted from the pre-approved terminal mockup, per their instruction. PR description will surface both the Pencil design and the code for morning review.
- 2026-07-08 — Locked scope via AskUserQuestion: filters + grouping only (no visual-priority toggle); grouping = auto-collapse consecutive same-type+actor runs; filter icon+popup replacing pill row (not extending Búsqueda).
- 2026-07-08 — proposal.md/design.md/specs/tasks.md created via openspec-propose and validated (`openspec validate` passed).
- 2026-07-08 — Checkpoint created; framing the change.
