# Tasks: add-founder-copilot

## 1. Contracts and data model

- [ ] 1.1 `@mikro/common` schemas (`copilot.ts`): chat input/output shapes (message, reply, provenance, pendingAction), confirm/reject inputs, watch-rule create/list/setEnabled inputs, v1 metric enum; add `copilot.action` + `rule.alert` to `businessEvent.ts` enum with payload schemas
- [x] 1.2 Prisma migration `add_copilot_and_watch_rules`: `Message.channel` (String, default "whatsapp"), `WatchRule`, `CopilotPendingAction` per design.md

## 2. Copilot backend (apiserver `src/api/copilot/`)

- [x] 2.1 `toolPolicy.ts`: READ_TOOLS / WRITE_TOOLS / DIRECT_TOOLS lists over the existing `mods/agents` definitions + new tools `queryFeedEvents`, `createWatchRule`, `listWatchRules`, `disableWatchRule`
- [x] 2.2 Chat loop `createCopilotChat`: history (copilot channel, last 20) → LangChain model via `createChatModel(getLLMConfig("text"))` with policy-bound tools → read/direct tools execute inline; a write tool call persists `CopilotPendingAction` and short-circuits the response; persist HUMAN/AI messages with provenance (tools + elapsed ms)
- [x] 2.3 Pending-action lifecycle: `createConfirmCopilotAction` (ownership + PENDING + <15 min, executes via tool executor, records `copilot.action` via `recordEvent`, appends outcome message), `createRejectCopilotAction`
- [x] 2.4 Watch rules: rule CRUD functions, metric computations (`mora_pct_portfolio`, `mora_pct_collector`, `cobranza_diaria`), interval evaluator worker emitting `rule.alert` on state change only
- [x] 2.5 Procedures in `protected.ts` (all adminProcedure): `copilotChat`, `copilotConfirmAction`, `copilotRejectAction`, `getCopilotHistory`, `listWatchRules`, `setWatchRuleEnabled`; wire copilot deps + evaluator into apiserver startup

## 3. Dock UI (Storybook-first, Pencil exports = ground truth)

- [x] 3.1 `CopilotDock` components in `src/founder/copilot/`: dock frame (header, thread, input), user/assistant bubbles, provenance line, capability chips, typing indicator — visuals per copilot.html + feed-dock-open.html exports
- [x] 3.2 `PendingActionCard` (confirm/reject with args summary; confirmed/rejected/expired states) and `RuleCard` ("Regla activa", Editar regla → prefill chat, Desactivar) per exports
- [x] 3.3 Stories for dock, bubbles, action card states, rule card

## 4. Wiring

- [x] 4.1 Dock into `FounderShell` (shell-level open/close state, persists across founder routes; header sparkles button functional); chat + history + confirm/reject via tRPC
- [x] 4.2 Feed: card treatments for `copilot.action` (sparkles) + `rule.alert` (bell) in typeConfig; ask-chips open dock with prefilled question
- [x] 4.3 Extend seed script: one watch rule + a breached evaluation (`rule.alert` event) + one confirmed copilot action event so the feed shows the new cards

## 5. Tests and gates

- [x] 5.1 Backend tests: tool policy binding (unlisted tools never bound), write-tool call produces PENDING action and no mutation; confirm executes + records `copilot.action`; reject/expiry paths execute nothing; non-admin rejection on all six procedures (stub the LLM — no live model calls in tests)
- [x] 5.2 Rule tests: create/disable, metric computations against seeded data, evaluator state-change semantics (one alert per crossing)
- [x] 5.3 Repo gates: typecheck/lint/tests across apiserver/common/dashboard; storybook build green. Plus live-LLM smokes via createCaller: read (queryFeedEvents, 9.2s, correct feed summary), write→PENDING (no execution), reject→REJECTED.
