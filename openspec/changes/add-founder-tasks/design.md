## Context

Issue #112 asks for one-time and recurring reminders created via the copilot or a Tasks tab, surfacing as alerts. Exploration widened the goal: the founder's recurring obligations end in concrete product actions (record the collector payment, bridge the day's collections into the ledger), so a Task should carry the obligation from "it's time" to "it's done" — not merely nudge.

Current state supplies every primitive:

- **Interval workers**: `createFollowUpWorker` (polls `status=PENDING, scheduledFor<=now`, 30s tick) and `createWatchRuleEvaluator` (5-min tick, pure `evaluateWatchRules` pass separated from the timer for unit-testing) define the worker shape and startup/SIGTERM wiring.
- **Append-only event log**: `BusinessEvent` rows written in the same transaction as their mutation; feed cards render from denormalized payloads without joins; corrections are new events.
- **Feed accents**: `FeedAccent` already includes `amber`; per-type visuals live in `typeConfig.ts`.
- **Confirm-before-execute UX**: `CopilotPendingAction` + `PendingActionCard` show the pattern of a card fetching live state by id and resolving via confirm/reject endpoints.
- **Tool policy**: READ/WRITE/DIRECT partition in `toolPolicy.ts`; watch-rule tools are the template for reversible-config DIRECT tools.
- **Accounting services**: `createCreateTransaction` et al. in `src/api/accounting/` — the execution substrate for both seed automations. ACCOUNTING.md explicitly defers the loan-payments→ledger bridge to "future automation".

Constraint from the founder: no LLM in the fire/confirm/execute path. AI may help at creation time only; execution must be deterministic, pre-programmed code.

## Goals / Non-Goals

**Goals:**

- A Task record binding a pre-registered automation to a schedule, with lifecycle from firing through completion visible in the founder feed.
- Slot-filling payload gathering: deterministic resolvers at fire time, founder-supplied `ask` slots at confirm time.
- Two working seed automations (`pay-collector`, `daily-close`) exercising the confirm-gated path end to end.
- Copilot and Tasks-tab creation parity; the system is fully operable with zero LLM involvement.

**Non-Goals:**

- External-system probes (TSS invoice verification): the catalog contract is the extension point, but credential storage and a browser/probe runtime are v2.
- Condition-triggered tasks (that remains `WatchRule`'s job; no merging of the two in v1).
- User-defined or LLM-defined automations — the catalog is code, period.
- Collector commission computation (`pay-collector` amount is an `ask` slot in v1; a computed resolver can come later once the commission formula is encoded).
- Tasks assigned to collectors or other roles — founder-only.

## Decisions

### D1 — Automations are a code catalog; tasks are bindings

An automation is a typed module registered in `mods/apiserver/src/tasks/automations/`:

```ts
interface Automation {
  id: string; // "pay-collector"
  title: string; // Spanish, shown on cards/forms
  gateFloor: "auto" | "confirm"; // task may tighten, never loosen
  params: Record<string, SlotSpec>; // Zod type + source per slot
  execute(payload, deps): Promise<AutomationResult>; // deterministic, DI-injected
}

type SlotSource = "static" | "computed" | "ask";
```

A `Task` row stores only `automationId`, schedule, bound static params, and gate. Alternative considered: tasks carrying arbitrary `toolName + argsJson` templates (the copilot pending-action shape). Rejected — it creates an open-ended write surface the model or a bug could populate, cannot be unit-tested per flow, and makes versioning intractable. A closed catalog gives Zod-validated, DI-injected, sinon-tested flows matching the repo's validated-function pattern, and `createTask`'s automation enum means the copilot cannot invent one.

### D2 — Two tables: Task (definition) and TaskFiring (occurrence)

`Task` is the recurring definition; `TaskFiring` is one occurrence with lifecycle status (`GATHERING → NEEDS_INPUT | READY → EXECUTING → DONE | FAILED`), the resolved payload JSON, and a link back to its task. Alternative: statuses on `Task` itself (the `FollowUpJob` shape, one row per occurrence). Rejected because recurrence would then require cloning definition rows every period; separating definition from occurrence keeps edit/cancel acting on one row and gives the feed card a stable `taskFiringId` to fetch. Events reference firings by id in payload only — no FKs, preserving the event-log rule that events outlive their subjects.

### D3 — Schedule is structured fields, not cron

`frequency` (`once | daily | weekly | monthly`) + `weekday` + `dayOfMonth` + `timeOfDay`, interpreted in `America/Santo_Domingo`, with a stored precomputed `nextFireAt` (UTC) the worker indexes on. Alternative: cron strings — more expressive, but the Tasks-tab form and the copilot tool would both need cron generation/parsing, and issue #112 needs nothing beyond monthly. `nextFireAt` advances only after a firing is created; if the server was down past due time, the task fires late rather than skipping (missed-firing policy: fire-late). Day-of-month > days-in-month clamps to the last day.

### D4 — Worker fires, gathers, and executes; no LLM anywhere in the path

`createTaskWorker` follows the evaluator convention: a pure `processDueTasks(db, catalog, now)` pass wrapped by an interval timer (60s tick), started at apiserver startup beside the follow-up/watch-rule/QCobro workers. On fire it creates the `TaskFiring`, runs computed-slot resolvers (deterministic functions receiving `db` + firing context), then:

- unresolved or failed slots → `NEEDS_INPUT` + `task.needs_input` event (card explains what's missing);
- all slots resolved, gate `confirm` → `READY` + `task.due` event (amber card with ask-form + confirm);
- all slots resolved, gate `auto` → execute immediately; `task.completed` / `task.failed` event.

Confirm is a tRPC mutation: validate ask-slot values against the automation's Zod schema, merge into payload, run `execute`, write the outcome event in the same transaction as the automation's own mutations. Alternative considered: routing confirm through the copilot chat loop so the founder could adjust conversationally. Rejected for v1 — it reintroduces an LLM into the execution path and double-confirms (task card, then pending-action card). The card may link "abrir en copilot" as a discussion escape hatch without gating execution on it.

### D5 — Feed card fetches live firing state; events stay append-only

`task.*` event payloads carry `taskFiringId`, `automationId`, `taskName`, and denormalized display fields. The feed renders resolved firings as plain rows; for an open firing (`task.due` / `task.needs_input` whose firing is still unresolved) the card mounts an action widget that fetches current firing state and renders the ask-slot form + confirm/skip. This bends the "render without joins" feed rule the same way `PendingActionCard` already does in the dock: the _event_ renders without joins; the _affordance_ needs live state by design, since append-only events cannot represent "still open". Skip resolves the firing as `SKIPPED` with a `task.completed` event flagged `skipped: true` (no new event type).

### D6 — Seed automations

- **`pay-collector`** — gate floor `confirm`. Slots: `collectorId` (static), `accountId` + `categoryId` (static), `amount` (ask), `note` (ask, optional). Execute: `createCreateTransaction` expense from the configured account. Card shows collector name and the week's collected total (computed, display-only context) beside the amount field.
- **`daily-close`** — gate floor `confirm` (founder may not relax in v1; revisit once trusted). Slots: `closeDate` (computed: previous business day), `accountId` (static). Execute: sum the day's collected `Payment` rows and post the bridging deposit transaction(s) to the ledger — the ACCOUNTING.md "future automation". Idempotency: refuses to double-close a date already bridged (checks for a prior close transaction marker for that date).

### D7 — Copilot integration is three DIRECT tools

`createTask` / `listTasks` / `cancelTask` join `DIRECT_TOOLS`, mirroring the watch-rule trio: reversible config management, card appears at once, no confirmation gate. `createTask`'s parameters embed the automation ids as an enum and describe each automation's static/ask slots so the model binds only what exists. Task _execution_ never touches the copilot loop (D4).

### D8 — Tasks tab is schema-driven

New founder screen listing task definitions (automation, schedule, next firing, enabled) with create/edit/cancel. The create form is generated from the selected automation's param spec: static slots become inputs, ask slots are shown as "se preguntará al confirmar", the gate control is clamped to the automation's floor. This guarantees copilot/manual parity without duplicating per-automation UI.

## Risks / Trade-offs

- [Closed catalog can't cover a new obligation without a deploy] → Accepted deliberately: the catalog is the safety model. Founder gaps surface via the existing `githubFeedback` tool; adding an automation is a small, tested module.
- [daily-close double-posting if run twice or confirmed after edits] → Idempotency marker per close date checked inside the execute transaction; refusal surfaces as `task.failed` with a clear reason, not a silent skip.
- [Fire-late policy can stack multiple due firings after long downtime] → Worker creates at most one firing per task per tick and never creates a new firing while one is unresolved for that task; older missed periods collapse into the single late firing (the card shows the intended period).
- [Feed card live-fetch bends the no-joins feed principle] → Contained to open firings; the event row itself renders standalone; documented in the founder-feed delta spec.
- [Ask-slot amounts typed wrong (fat-finger a payment)] → Confirm card shows the full resolved payload before execute; transactions are reversible via the existing `createReverseTransaction`; amounts validated by the automation's Zod schema (positive, max bounds).
- [Timezone/DST math] → America/Santo_Domingo has no DST (fixed UTC-4); compute `nextFireAt` with an explicit-offset helper and unit-test month-end clamping.
- [Schema drift after automation updates] → Payload re-validated against the current param schema at fire time and again at confirm; mismatch produces `NEEDS_INPUT` with explanation, never a crash.

## Migration Plan

1. Prisma migration adds `tasks` + `task_firings`; update the integration tests' hand-maintained `SCHEMA_SQL` in the same commit (known gotcha).
2. `@mikro/common` gains `task.*` event schemas — export through both `schemas/index.ts` and the root barrel.
3. Backend lands behind no flag: with zero Task rows the worker is a no-op, so deploy order is safe (worker + endpoints first, then UI, then copilot tools).
4. Rollback: stop the worker and disable tasks (`enabled=false`); event rows are append-only history and remain valid; no destructive migration.

## Open Questions

- Should `pay-collector` eventually compute the amount from a commission formula (percentage of the week's collections)? Deferred until the business encodes the formula; the slot flips from `ask` to `computed` without model changes.
- Does `daily-close` post one aggregate deposit or one per collector/method? Start aggregate-per-method; revisit with real usage.
- Where TSS-style probes run (in-process vs separate probe worker) — v2 decision, unblocked by the catalog contract.
