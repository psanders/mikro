# Design: add-founder-copilot

## Context

Predecessor `add-founder-feed` shipped the event log + founder app (`src/founder/`, routes `/founder*`). Verified infra to build on:

- `mods/agents`: LangChain agent loop (`createInvokeLLM`), vendor-agnostic `createChatModel(getLLMConfig("text"))` (dev = Anthropic), ~23 tools in `tools/definitions.ts` (OpenAI function shape, Spanish descriptions), `createToolExecutor(deps)` with Prisma-backed handlers dependency-injected by the apiserver at startup. No confirmation step exists in the loop; tools fire immediately.
- Chat storage: `Message` model (role AI/HUMAN, content, tools JSON, userId?/customerId?) used by the WhatsApp bot; `getChatHistory` tRPC read exists; no web chat UI anywhere.
- No streaming infra (httpBatchLink only); WhatsApp replies never needed it.
- Founder shell has the inert copilot affordances waiting (sparkles header button, ask-chips on cards).

## Goals / Non-Goals

**Goals:** functional copilot dock per Pencil (`Uljd6` + dock in `YrWVt`); four verbs — Consultar/Auditar (immediate read tools), Actuar (confirm-first writes), Vigilar (watch rules → feed alerts); every copilot write lands in the event log with provenance.

**Non-Goals:** token streaming; `mikro-mcp` packaging (registry stays MCP-exposable; separate change); rule metrics beyond the v1 enum; anomaly detection; editing rule parameters via form (Editar regla = prefills the chat); changes to `agents.yaml`/WhatsApp routing.

## Decisions

1. **Copilot is an apiserver module, not an `agents.yaml` agent.** Profiles in agents.yaml bind WhatsApp routing (one agent per role profile — ADMIN already has one). The copilot is a dashboard surface: `src/api/copilot/` owns its system prompt (Spanish, founder-scoped, knows the four verbs) and its own tool allowlist, but reuses `createChatModel`, the tool definitions, and `createToolExecutor` through the same DI seam the WhatsApp path uses. agent-configuration spec untouched.
2. **Tool partition is the security model.** Copilot tools are declared in two explicit lists in `src/api/copilot/toolPolicy.ts`: `READ_TOOLS` (subset of existing list/get/report tools + new `queryFeedEvents` event-log tool + rule list) execute inline during the loop; `WRITE_TOOLS` (createPayment, createCustomer, updateLoanStatus, …) NEVER execute inline — the loop intercepts the tool call, persists a `CopilotPendingAction`, and returns it to the client. A tool in neither list is not bound to the model at all. Rule creation (`createWatchRule`) is in a third list, `DIRECT_TOOLS` — executes inline by design (low risk, reversible via Desactivar), matching the Pencil flow where the rule card appears immediately.
3. **Confirmation lifecycle.** `CopilotPendingAction { id, userId, toolName, argsJson, summary, status PENDING/CONFIRMED/REJECTED/EXPIRED, createdAt, resolvedAt? }`. `copilotConfirmAction` (adminProcedure) re-validates ownership + PENDING + age < 15 min, executes via the tool executor, records a `copilot.action` business event (intrinsic `recordEvent`, like `application.restored`), marks CONFIRMED, and appends an AI message with the outcome. `copilotRejectAction` marks REJECTED. Executing through the executor (not raw tRPC procedures) avoids double-eventing: the boundary middleware only sees annotated procedures, so `copilot.action` is the single event for a copilot-driven write, with `payload.toolName/args` as provenance.
4. **Chat history = `Message` + `channel` column** (`whatsapp` default so existing rows/behavior are untouched; `copilot` for the dock). History query returns the last N copilot messages for the founder; the LLM context window rebuilds from the same rows. Confirm/reject cards render from `CopilotPendingAction` joined into the thread by timestamp.
5. **Watch rules, v1 metric enum.** `WatchRule { id, name, metric, comparator (gt/lt), threshold, scope? (collectorId), enabled, createdById, lastState?, lastEvaluatedAt? }`. Metrics computable from existing data TODAY: `mora_pct_portfolio` (share of ACTIVE loans with an overdue installment), `mora_pct_collector` (same, scoped), `cobranza_diaria` (sum of today's COMPLETED payments). Evaluator runs on an interval worker (same pattern as the QCobro worker), emits `rule.alert` only on state CHANGE (ok→breached), storing `lastState` to avoid alert spam.
6. **Two new event types, written intrinsically.** `copilot.action` ({toolName, args, resultSummary}) and `rule.alert` ({ruleId, ruleName, metric, value, threshold}) join the enum + payload schemas in `@mikro/common`; no boundary mappers (they're not annotated procedures — same category as `application.restored`). Feed cards per the Pencil catalog: sparkles icon for copilot actions, bell-ring for rule alerts.
7. **Non-streaming chat.** `copilotChat` returns the full reply (or pending action) in one response; the dock shows a typing indicator meanwhile. Matches httpBatchLink and the existing invoke loop; streaming is additive later.
8. **Dock lives in `FounderShell`** (right panel, shell-level so it persists across feed/búsqueda/reportes), open/close state in shell context; ask-chips and the header sparkles button open it with an optional prefilled question. All visuals from the Pencil exports (copilot.html, feed-dock-open.html, card-catalog.html).

## Risks / Trade-offs

- [LLM calls a write tool with wrong args] → args are shown in the confirm card verbatim (formatted Spanish summary + raw values); nothing executes without the founder's click; executor re-validates via the same zod schemas as always.
- [Pending action goes stale] → 15-min expiry checked at confirm time; expired actions render disabled.
- [Rule evaluator cost] → interval evaluation over indexed queries; only state-change alerts; disabled rules skipped.
- [History context growth] → last 20 messages rebuilt per request (same window the WhatsApp path uses).
- [No streaming feels slow] → typing indicator + tool-loop responses are typically a few seconds; accepted for v1.

## Migration Plan

One committed migration adding `Message.channel` (default `whatsapp`), `WatchRule`, `CopilotPendingAction`. Additive; rollback = drop. Requires `mikro.json` `llm.text` configured (already validated at startup).

## Open Questions

None blocking.
