## Why

Since #299, every CX WhatsApp conversation is stored in `conversation_turns`, tagged with its agent and `agent_version`. Nobody reads them. Agents can drift after a prompt or model change, or misbehave: leak an applicant's score, show someone else's loan, ignore a request for a person, or loop. Today nobody notices until a customer complains. We want a recurring audit that flags these problems and lands in the founder feed, so monitoring and compliance run by themselves.

## What Changes

- **Scheduled audit**, controlled from `mikro.json`: a new `conversationAudit` section with `enabled` (default `false`), `schedule` (5-field cron in `timezone`, default daily `0 7 * * *`) and `maxConversations` (default 200). It follows the same pattern as `qcobro.schedule`.
- **On-demand run from the copilot**: a new `runConversationAudit` tool that runs immediately, like `forceQCobroSync`, and posts the same feed card. It works even when the schedule is off.
- **Each run** reviews conversations that have new turns since the last completed run (the first run looks back 24h). A conversation is one phone's turns in the window. Two layers:
  - **Code checks** (no AI) on every conversation: failed sends, an error reply sent, the person asked for a human but no hand-off happened, José past the turn cap, and sensitive data (score, band, decision dates) in replies to applicants or guests.
  - **Rules judge** (AI): for each conversation, up to `maxConversations`, grades the agent's `policies` from `agents.yaml`. The result is pass/fail per rule, with the turn and a quote as evidence. It reuses the eval judge setup (`getLLMConfig("evals")`, structured output).
- **Stored results**: new `conversation_audit_runs` and `conversation_audit_findings` tables. Findings keep the agent name and `agent_version`, so drift shows by version.
- **Feed card** `conversation.audited`: conversations reviewed, hand-offs, failed sends, issues by severity and by agent. The card is amber when there are critical issues. "Ver detalle" opens the findings in the right panel, each with a link to the application's conversation.
- **Policies in `agents.yaml`**: each agent gets an optional `policies` list (`id`, `rule`, `severity`). Guest, José, applicant and customer agents ship with a first set.

## Capabilities

### New Capabilities

- `conversation-audit`: the audit run (window, code checks, rules judge, cap), storing runs and findings, scheduling from config, and the single-run lock.

### Modified Capabilities

- `agent-configuration`: agents can declare `policies` for the audit judge. Policies don't change `agent_version`.
- `founder-feed`: new `conversation.audited` card and the findings detail panel.
- `founder-copilot`: new `runConversationAudit` tool, run immediately.

## Impact

- **mods/common**: `conversationAudit` config section plus its getter; audit schemas and types (both barrels); the `conversation.audited` event type and payload.
- **mods/agents**: an `audit/` module with the code-check registry and the rules judge (pure, DI); the policies schema; the `runConversationAudit` tool definition and executor.
- **mods/apiserver**: Prisma models plus migration (and the integration `SCHEMA_SQL`); `createRunConversationAudit`; a croner worker; tRPC queries for runs and findings; copilot wiring.
- **mods/dashboard**: the feed card plus the detail panel, matching Pencil.
- **mikro.json**: a new optional section. Add it to prod `mikro.json` only **after** the release is deployed (the file is `.strict()`, so a key that arrives before its release crashes boot and rollback).
- **Out of scope**: changing José's 7-turn cap (under review separately; the check only reports it), staff Chatwoot replies, proactive sends, replay against a new prompt, and ctl commands.
