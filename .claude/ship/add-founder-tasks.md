# Ship checkpoint — add-founder-tasks

Started: 2026-07-05
Current stage: done

**Scope:** Founder Tasks per issue #112 expanded: a closed, code-defined automation catalog (`pay-collector`, `daily-close`) bound by Task rows to recurrence schedules; an interval worker fires tasks, gathers payload via deterministic slot resolvers, and surfaces open firings as amber action cards in the founder feed (ask-slot form + confirm/skip, no LLM at fire/confirm/execute). Copilot gets DIRECT tools createTask/listTasks/cancelTask; a new Tasks tab lists definitions with a schema-driven create/edit form. TSS-style external probes are an explicit v2 non-goal.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (pencil.pen, MCP only) · Storybook: yes (mods/dashboard/.storybook) · E2E: no (no playwright config/dir)

| #   | Stage           | Status | Notes                                                                                                                                                                                            |
| :-- | :-------------- | :----- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done   | branch feat/founder-tasks off main (ef153b2); artifacts written this session                                                                                                                     |
| 1   | Design (Pencil) | done   | sec-07 Tareas (V4RN7) in board EzobQ: feed w/ amber card (Idee2), Tareas tab (U6iGU), Nueva tarea modal (aMH1d); user approved                                                                   |
| 2   | Spec reconcile  | done   | record-expense added to v1 catalog; pause/resume toggle + select fields specced; openspec validate green                                                                                         |
| 3   | Build           | done   | groups 1–7 landed in 5 commits (schema→catalog→worker→API→copilot→dashboard); tasks.md 25/25                                                                                                     |
| 4   | Test            | done   | lerna typecheck+test 4/4 green; 547 integration tests; real-app golden path driven in browser (create→fire→confirm→transaction+events→delete); auto-expand defect found & fixed during the drive |
| 5   | Sync            | done   | deltas merged into main specs; founder-tasks + task-automation-catalog created                                                                                                                   |
| 6   | Archive         | done   | openspec/changes/archive/2026-07-06-add-founder-tasks                                                                                                                                            |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-07-06 — Stages 5+6 done on user approval: delta specs synced (business-event-log catalog + scenario, founder-copilot task tools, founder-feed amber cards, new founder-tasks and task-automation-catalog capabilities), change archived. Ship complete.

- 2026-07-06 — Stages 3+4 done. Build: Task/TaskFiring + migration + SCHEMA_SQL (accounting tables added to test schema too), catalog (pay-collector/record-expense/daily-close), fixed-UTC-4 schedule math, worker + firing lifecycle (drift→NEEDS_INPUT, ask-values recover missing slots), tasks.\* tRPC router, copilot DIRECT tools w/ name→UUID resolution + PROGRAMAR verb, feed TaskActionCard + TaskFeedCard container, Tareas tab + schema-driven modal. Spec reworded: outcome event post-commit per event-log convention (not same-transaction). Test: all suites green; browser golden path verified against real apiserver+dashboard (RD$1,500 pay-collector confirm posted EXPENSE to Caja Chica, task.due/task.completed events, delete works); found+fixed defaultExpanded-after-fetch bug via key remount; dev DB test artifacts cleaned (events remain, append-only).
- 2026-07-05 — Stage 2 done: user picked "add record-expense to v1" for the gasolina row; proposal/design/specs/tasks updated; daily-close design copy fixed to plain daily (schedule model has no weekday mask); pause/resume toggle promoted to spec.
- 2026-07-05 — Stage 1 done: user approved with two notes (automation select in modal — done via chevron select fields; screens moved into founder cluster EzobQ as sec-07 Tareas). Pencil node ids: section V4RN7, screens Idee2/U6iGU/aMH1d, task card IoQ69, done-row VxuDZ, modal wY7rI.

- 2026-07-05 — Frame done: surfaces detected (no e2e), branch feat/founder-tasks created from updated main; tool-awareness change had merged+archived on main, our founder-copilot delta is ADDED-only so no reconcile needed from that.
- 2026-07-05 — Checkpoint created; framing the change. OpenSpec artifacts (proposal/design/specs/tasks) were authored in the same session during /opsx:explore → /opsx:propose.
