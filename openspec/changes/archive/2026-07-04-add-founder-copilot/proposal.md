# Proposal: add-founder-copilot

## Why

The founder feed (shipped in `add-founder-feed`) shows the business as it happens; the copilot is the other half of the locked product direction (Pencil board `EzobQ`): the place where the founder acts on it. Monitoring, compliance, auditing, and operational writes were deliberately removed as dashboard sections because the copilot does those jobs conversationally. The apiserver already has a production LLM agent loop with 23 business tools (`mods/agents`, LangChain, config-driven keys) — the copilot reuses it rather than building new intelligence.

## What Changes

- **Copilot dock in the founder shell** — collapsible right panel per the Pencil design (open/close via panel icon; closed state = the sparkles button already in the feed header, now functional). Message thread with capability chips (CONSULTAR / ACTUAR / VIGILAR / AUDITAR), provenance line per answer ("Mikro API · <tool> · <time>"), and persistent per-founder history.
- **Chat backend in the apiserver** — `copilotChat` runs the existing LangChain tool loop with a copilot-specific tool allowlist and system prompt. Read tools (Consultar/Auditar — including new event-log query tools) execute immediately.
- **Actuar = writes always behind confirmation** — when the model calls a write tool, execution STOPS and the client receives a pending action (tool, arguments, human summary). The founder confirms or rejects in the dock; confirmation executes through the existing tool executor and records a `copilot.action` business event (feed card with provenance).
- **Vigilar = watch rules** — the copilot can create/list/disable watch rules ("Avísame si la mora de una ruta pasa de 9%") over a fixed v1 metric set; a periodic evaluator publishes `rule.alert` business events (feed cards) on threshold crossings. Rule creation is direct (reversible via Desactivar); business writes are the ones that confirm.
- **Feed additions** — `copilot.action` and `rule.alert` event types with their Pencil catalog card treatments; the sparkles "ask copilot" chips on feed cards become functional (open dock with the question prefilled).
- **Chat storage** — reuse the existing `Message` model with a new `channel` discriminator (`whatsapp` default, `copilot`) so founder dock history never mixes with WhatsApp agent threads.
- **Out of scope**: token streaming (request/response like the rest of the stack), packaging the tool registry as a standalone `mikro-mcp` server (the copilot module keeps the registry MCP-exposable; packaging is a later change), rule metrics beyond the v1 enum, anomaly detection.

## Capabilities

### New Capabilities

- `founder-copilot`: the dock UI + chat procedure + read-tool execution + the confirm/reject flow for writes + provenance + history.
- `copilot-watch-rules`: watch-rule model, copilot rule tools, periodic evaluation, `rule.alert` publication, list/disable management.

### Modified Capabilities

- `business-event-log`: catalog gains `copilot.action` and `rule.alert` (both written intrinsically, not via annotated procedures).
- `founder-feed`: cards for the two new event types; ask-copilot chips become functional; the header copilot affordance opens the dock.

## Impact

- **apiserver**: `Message.channel` + `WatchRule` + `CopilotPendingAction` migrations; new `src/api/copilot/` module (chat loop reusing `mods/agents` executor with DI, pending-action lifecycle, rule tools, rule evaluator worker); new admin procedures (`copilotChat`, `copilotConfirmAction`, `copilotRejectAction`, `getCopilotHistory`, `listWatchRules`, `setWatchRuleEnabled`).
- **agents**: no changes to `agents.yaml`/profiles (the copilot is dashboard-scoped, not WhatsApp-routed); reuses `createChatModel`, tool definitions, and `createToolExecutor` via existing exports.
- **common**: copilot/rule schemas; two new business-event types + payload schemas.
- **dashboard**: `CopilotDock` + message/confirm/rule-card components (Storybook-first) in `src/founder/`, wired into `FounderShell`.
- Uses the existing `getLLMConfig("text")` key path — no new secrets or config surface.
