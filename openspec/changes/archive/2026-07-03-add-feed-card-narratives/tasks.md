# Tasks: add-feed-card-narratives

## 1. Narrative + insights functions (`mods/dashboard/src/founder/components/typeConfig.ts`)

- [x] 1.1 Add `resolveNarrative(event: FeedEvent): string | null` — one template per `BusinessEventType`, per `design.md`'s table. Returns `null` for `application.signed`, `application.restored`, `customer.created`, `rule.alert` (compact summary is already complete).
- [x] 1.2 `application.deleted` narrative composes from `payload.snapshot` (reuse the field extraction currently in `snapshotDetailRows`, repurposed into a sentence builder) — no "motivo" clause (Open Question 1: confirmed).
- [x] 1.3 `loan.status_changed` narrative degrades to "Préstamo actualizado a {to}." when `payload.from` is empty (Open Question 2: confirmed); includes "de {from} " clause only when present.
- [x] 1.4 `copilot.action` narrative uses `payload.resultSummary` when present, else falls back to "Herramienta ejecutada: {toolName}."
- [x] 1.5 Add `resolveInsightsQuestion(event: FeedEvent): string` — reuses `subjectQuestion(resolveSubjectLink(event)!.target, event.customerName)` where a subject link exists; type-specific fallback questions otherwise (payment.\*, application.deleted, loan.status_changed, copilot.action, rule.alert) per `design.md`.
- [x] 1.6 Remove `resolveDetailRows`, `snapshotDetailRows`, `DetailRow`, and `HANDLED_KEYS` (superseded by narrative + Metadata link) — confirm no other caller depends on them (`Grep` for `resolveDetailRows`/`DetailRow` outside `typeConfig.ts` first).
- [x] 1.7 Add missing fixtures in `fixtures.ts`: `copilotActionEvent`, `ruleAlertEvent` (neither exists today despite being in the v1 catalog), and a `loanStatusChangedNoFromEvent` fixture with `payload.from: ""` to cover the real server behavior (the existing `loanStatusChangedEvent` fixture has `from: "current"`, which the actual mapper never produces — keep it for the happy-path template shape, add the empty-`from` one for the degrade path). Update `allFeedEvents` to include both new types.

## 2. Metadata view (Storybook-first)

- [x] 2.1 New `EventMetadataPanel` component (or similarly named) — small "Metadata" link that opens a view of `{ type, occurredAt, actorName, ...payload }` as formatted JSON, styled per the Pencil `panel` treatment (dark code block, monospace). Story covering at least one event with a nested snapshot (`application.deleted`) and one with a flat payload (`payment.collected`).
- [x] 2.2 New small "IA insights" link element (icon + label, matches Pencil `cp/insights-link`) — no new component needed if it can be a simple inline element inside `FeedCard`; extract only if reused elsewhere.

## 3. `FeedCard.tsx` rewiring

- [x] 3.1 Replace the `detailRows` KV-grid block with: narrative row (rendered only when `resolveNarrative(event)` is non-null) → links row (Metadata + IA insights) → existing actions row (unchanged).
- [x] 3.2 "IA insights" click calls `onAskCopilot?.(resolveInsightsQuestion(event))` — same prop already wired for the ask-copilot chip; no new prop needed.
- [x] 3.3 Confirm the existing ask-copilot chip (deletion-only, "¿Qué se borró esta semana?") stays as-is alongside the new per-record "IA insights" link — they answer different questions (weekly rollup vs. this record) and both use `onAskCopilot`.
- [x] 3.4 Verify `application.deleted` red treatment, amber policy-exception treatment, and the Restaurar/expired-window behavior are all unaffected by the KV-grid removal (they render below the new links row, unchanged).

## 4. Storybook coverage

- [x] 4.1 Update `FeedCard.stories.tsx`: every existing story still renders correctly with the new expanded content; add `CopilotAction` and `RuleAlert` stories (new fixtures from 1.7); add a story exercising the null-narrative path explicitly (e.g. `ApplicationSigned` expanded) and one exercising the `loan.status_changed` empty-`from` degrade path (`loanStatusChangedNoFromEvent`).
- [x] 4.2 Update the `Feed` composite story to include the two new event types so the full-catalog view stays representative.

## 5. Quality gate

- [x] 5.1 `mods/dashboard`: no unit-test runner is configured for this package today (no vitest/jest, zero `*.test.*` files under `src/founder`) — Storybook is the existing coverage convention for this component tree. Do not introduce a new test framework as a side effect of this change; rely on the Storybook coverage from §4 plus lint/typecheck.
- [x] 5.2 Run `npm run lint` and `npm run typecheck` in `mods/dashboard` — both green.
- [x] 5.3 Manually verify in Storybook (`npm run storybook`) that all 12 event types render sensible expanded content, the Metadata link shows correct JSON per type, and the IA insights link is present and calls `onAskCopilot` with the right question (can be checked via the Storybook actions panel / a temporary console log during review, removed before done).
