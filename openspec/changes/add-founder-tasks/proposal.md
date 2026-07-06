## Why

Recurring business obligations (paying collectors every Friday, recording the week's gas expenditure, closing the day's collections into the ledger) live only in the founder's head — issue #112. A plain reminder is not enough: each of these obligations ends in a concrete product action (an accounting transaction, a ledger bridge), so the system should carry the obligation from "it's time" through "it's done" — gathering the needed data, asking the founder only for what it cannot compute, and executing a pre-programmed flow on confirmation. ACCOUNTING.md already documents the loan-payments→ledger bridge as a manual process awaiting "future automation"; this change is that automation's delivery vehicle.

## What Changes

- Add a **pre-registered automation catalog**: automations are code in the repo (Zod-validated params, DI-injected deps, unit-tested), never model-invented or user-defined. Each automation declares a param schema with per-slot **sources** (`static` = bound at task creation, `computed` = resolved deterministically at fire time, `ask` = supplied by the founder at confirm time), a **gate floor** (`auto` runs on fire; `confirm` requires the founder), and an `execute` function that performs the flow and records business events.
- Seed the catalog with two automations: **`pay-collector`** (confirm-gated; static collector + accounts, `ask` amount; executes an accounting transaction) and **`daily-close`** (bridges the day's collected loan payments into the accounting ledger — the "future automation" ACCOUNTING.md anticipates; confirm-gated by default, founder may relax to auto per task only where the automation's floor allows).
- Add a **Task** record: a binding of `automationId` + recurrence schedule (one-time / daily / weekly / monthly, timezone America/Santo_Domingo) + bound static params + `nextFireAt`. Editable and cancelable after creation.
- Add a **task worker** (same interval-worker shape as the follow-up worker and watch-rule evaluator): polls enabled tasks with `nextFireAt <= now`, runs the gathering phase (computed-slot resolvers), advances `nextFireAt`, and drives the firing lifecycle `GATHERING → NEEDS_INPUT | READY → EXECUTING → DONE | FAILED`. Missed firings fire late (never silently skipped).
- Emit new business events — `task.due`, `task.needs_input`, `task.completed`, `task.failed` — to the append-only event log; the founder feed renders open task firings as **amber action cards** carrying a small form for `ask` slots plus a confirm button (live firing state fetched by `taskFiringId` from the event payload, same pattern as the copilot pending-action card). No LLM at fire, confirm, or execute time.
- Add copilot **DIRECT tools** `createTask`, `listTasks`, `cancelTask` (reversible config management, mirroring the watch-rule tools); `createTask` exposes the automation ids as an enum so the model cannot invent automations.
- Add a **Tasks tab** to the founder app: list of task definitions plus manual create/edit with a form generated from the selected automation's param schema — full parity with copilot creation, zero LLM required.
- **Non-goal (v2):** external-system probes such as TSS invoice verification. The catalog contract is the extension point; credential storage and a browser/probe runtime are deliberately out of scope here.

## Capabilities

### New Capabilities

- `founder-tasks`: the Task record, recurrence scheduling, the firing lifecycle and worker, slot-filling payload gathering, the Tasks tab, and task edit/cancel.
- `task-automation-catalog`: the automation registry contract (param sources, gate floor, execute) and the two seed automations `pay-collector` and `daily-close`.

### Modified Capabilities

- `business-event-log`: adds the `task.due`, `task.needs_input`, `task.completed`, `task.failed` event types (with payload schemas) to the v1 event catalog.
- `founder-feed`: open task firings render as amber action cards with an ask-slot form and confirm affordance; resolved firings render as plain event rows.
- `founder-copilot`: three new DIRECT tools (`createTask`, `listTasks`, `cancelTask`) join the tool policy.

## Impact

- New Prisma models (`Task`, `TaskFiring`) + migration; integration-test `SCHEMA_SQL` must be updated in step (known schema-change gotcha).
- `@mikro/common`: new `task.*` event payload schemas — remember the double barrel export (`schemas/index.ts` + root `index.ts`).
- `mods/apiserver`: new `src/tasks/` module (automation catalog, resolvers, worker, firing lifecycle), wired at startup beside the follow-up and watch-rule workers; tRPC procedures for the Tasks tab and the feed card's firing state/confirm.
- `mods/apiserver/src/api/copilot/toolPolicy.ts` + chat loop: new DIRECT tools.
- `mods/dashboard`: Tasks tab screen in the founder app; amber task card + ask-slot form components (Storybook-first, per design-system conventions).
- Accounting module: `pay-collector` and `daily-close` execute through existing accounting transaction services; no changes to the loan-servicing layer.
