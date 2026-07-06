## 1. Schema & shared types

- [ ] 1.1 Add `Task` and `TaskFiring` Prisma models (+ indexes on `enabled, nextFireAt` and `taskId, status`) with migration
- [ ] 1.2 Update the integration tests' hand-maintained `SCHEMA_SQL` to match the new tables
- [ ] 1.3 Add `task.due` / `task.needs_input` / `task.completed` / `task.failed` payload schemas to `@mikro/common` `businessEvent.ts` (extend `businessEventTypeEnum`) and export through both barrels
- [ ] 1.4 Add task/firing Zod schemas (schedule fields, gate, slot values) to `@mikro/common` with unit tests for gate-floor and schedule validation

## 2. Automation catalog

- [ ] 2.1 Define the `Automation` contract (`id`, `title`, `gateFloor`, param spec with slot sources, DI-injected `execute`) and the registry in `mods/apiserver/src/tasks/automations/`
- [ ] 2.2 Implement `pay-collector` (static collector/account/category, ask amount+note, week-collected display context, expense transaction via `createCreateTransaction`) with sinon tests
- [ ] 2.3 Implement `daily-close` (computed previous business day, per-method bridge deposits, per-date idempotency refusal, zero-day success) with sinon tests
- [ ] 2.4 Payload re-validation helper: validate stored payload against current param schema at fire and confirm; mismatch → `NEEDS_INPUT`, tested for the drift case

## 3. Scheduling & worker

- [ ] 3.1 Schedule math helper: `nextFireAt` computation for once/daily/weekly/monthly in America/Santo_Domingo with month-end clamping, unit-tested
- [ ] 3.2 Pure `processDueTasks` pass: create firing, advance/disable schedule, run computed resolvers, transition to `NEEDS_INPUT`/`READY`/auto-execute, fire-late collapse, open-firing suppression, per-task error isolation — unit-tested per scenario
- [ ] 3.3 `createTaskWorker` interval wrapper (60s tick, stop function) wired at apiserver startup beside the follow-up/watch-rule/QCobro workers

## 4. Task API

- [ ] 4.1 tRPC procedures: create/list/update/cancel task definitions (catalog + schema + gate-floor validation shared with the copilot tool)
- [ ] 4.2 tRPC procedures: get firing state (payload, pending ask slots, context) and confirm/skip — confirm validates ask values, executes the automation, and writes the outcome event in the same transaction; double-resolution rejected
- [ ] 4.3 Record `task.due` / `task.needs_input` / `task.completed` / `task.failed` events at their lifecycle points; integration test the fire→confirm event trail

## 5. Copilot tools

- [ ] 5.1 Add `createTask` (automation-id enum + slot docs), `listTasks`, `cancelTask` definitions and handlers to the copilot local tools; add all three to `DIRECT_TOOLS` in `toolPolicy.ts`
- [ ] 5.2 System-prompt/capability-chip touch-up so the copilot knows it can schedule tasks; eval or unit coverage for NL→`createTask` binding and unknown-automation rejection

## 6. Founder feed cards

- [ ] 6.1 Feed type config + compact/narrative rendering for the four `task.*` event types (amber accent for open, plain rows for resolved)
- [ ] 6.2 `TaskActionCard` widget: live firing fetch by `taskFiringId`, resolved-payload review, ask-slot inputs, confirm/skip with in-place success/error, graceful degrade on fetch failure — Storybook stories per state (ready/needs-input/resolved/error)
- [ ] 6.3 Wire the widget into `FeedCard` for unresolved `task.due`/`task.needs_input` events

## 7. Tasks tab

- [ ] 7.1 Tasks tab screen in the founder shell: definition list (name, automation, schedule, next firing, enabled) + cancel, with Storybook stories
- [ ] 7.2 Schema-driven create/edit form generated from the automation param spec (static inputs, ask-slot preview, gate clamped to floor), parity with copilot creation
- [ ] 7.3 Pencil design for the Tasks tab + task card states, and update pencil.pen to match the implemented screens (source-of-truth rule)

## 8. Verification & docs

- [ ] 8.1 End-to-end pass: create weekly `pay-collector` task (copilot and manual), force-fire, confirm from the feed card, verify transaction + event trail; same for `daily-close` including the double-close refusal
- [ ] 8.2 Update ACCOUNTING.md (daily-close bridges collections — the documented "future automation") and note the task system in README/AGENTS where workers are listed
