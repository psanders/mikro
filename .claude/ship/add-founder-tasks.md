# Ship checkpoint — add-founder-tasks

Started: 2026-07-05
Current stage: 3 — Build

**Scope:** Founder Tasks per issue #112 expanded: a closed, code-defined automation catalog (`pay-collector`, `daily-close`) bound by Task rows to recurrence schedules; an interval worker fires tasks, gathers payload via deterministic slot resolvers, and surfaces open firings as amber action cards in the founder feed (ask-slot form + confirm/skip, no LLM at fire/confirm/execute). Copilot gets DIRECT tools createTask/listTasks/cancelTask; a new Tasks tab lists definitions with a schema-driven create/edit form. TSS-style external probes are an explicit v2 non-goal.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (pencil.pen, MCP only) · Storybook: yes (mods/dashboard/.storybook) · E2E: no (no playwright config/dir)

| #   | Stage           | Status      | Notes                                                                                                                          |
| :-- | :-------------- | :---------- | :----------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done        | branch feat/founder-tasks off main (ef153b2); artifacts written this session                                                   |
| 1   | Design (Pencil) | done        | sec-07 Tareas (V4RN7) in board EzobQ: feed w/ amber card (Idee2), Tareas tab (U6iGU), Nueva tarea modal (aMH1d); user approved |
| 2   | Spec reconcile  | done        | record-expense added to v1 catalog; pause/resume toggle + select fields specced; openspec validate green                       |
| 3   | Build           | in-progress |                                                                                                                                |
| 4   | Test            | pending     | unit only; repo has no e2e surface — golden path via manual/`verify` pass                                                      |
| 5   | Sync            | pending     |                                                                                                                                |
| 6   | Archive         | pending     |                                                                                                                                |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-07-05 — Stage 2 done: user picked "add record-expense to v1" for the gasolina row; proposal/design/specs/tasks updated; daily-close design copy fixed to plain daily (schedule model has no weekday mask); pause/resume toggle promoted to spec.
- 2026-07-05 — Stage 1 done: user approved with two notes (automation select in modal — done via chevron select fields; screens moved into founder cluster EzobQ as sec-07 Tareas). Pencil node ids: section V4RN7, screens Idee2/U6iGU/aMH1d, task card IoQ69, done-row VxuDZ, modal wY7rI.

- 2026-07-05 — Frame done: surfaces detected (no e2e), branch feat/founder-tasks created from updated main; tool-awareness change had merged+archived on main, our founder-copilot delta is ADDED-only so no reconcile needed from that.
- 2026-07-05 — Checkpoint created; framing the change. OpenSpec artifacts (proposal/design/specs/tasks) were authored in the same session during /opsx:explore → /opsx:propose.
