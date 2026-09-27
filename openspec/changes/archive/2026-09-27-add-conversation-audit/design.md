## Context

`conversation_turns` (#299) stores every CX WhatsApp turn with phone, role, profile, agent name, `agent_version`, tool calls and a `failed` flag. Hand-offs are in `conversation_handoffs`. The eval harness (`mods/agents/src/eval`) already has an LLM judge that uses `getLLMConfig("evals")` and structured output. Scheduled work that posts a feed card already exists: the QCobro croner worker writes `qcobro.synced`. The copilot has READ, WRITE (confirm-first) and DIRECT tool lists. The Pencil design is EzobQ section 09 (`T6xLA`).

## Goals / Non-Goals

**Goals:** a recurring, config-controlled audit that finds agent misbehavior in real conversations, keeps the results, and shows them in the founder feed. An on-demand run from the copilot. Drift visible by `agent_version`.

**Non-Goals:** changing José's turn cap, replaying transcripts against a new prompt, auditing staff Chatwoot replies or proactive sends, ctl commands, and auto-remediation.

## Decisions

### D1. Two layers: code checks and a rules judge

- **Code checks** are deterministic and cheap, and run on every conversation in the window. They live in a registry in `mods/agents/src/audit/checks.ts` (id, title, severity, `run(conversation) → hits`), the same pattern as `mods/common/src/eval/checks.ts`. v1 checks:
  - `failed_send` (warning): an AGENT/SYSTEM turn with `failed = true`.
  - `error_reply` (warning): a SYSTEM turn whose content is the generic processing-error text (exported as a constant from the handler).
  - `handoff_ignored` (warning): an INBOUND turn that matches `isHumanRequest`, with no hand-off opened for that phone between 1 min before and 10 min after the turn.
  - `jose_turn_cap` (warning): more than `MAX_JOSE_TURNS` delivered José (PROSPECT, AGENT) turns for one application in the loaded history. It only reports; the cap itself is not changed.
  - `sensitive_score` (critical): an AGENT turn to a non-staff profile that states a score or band with a number (regex).
- **Rules judge**: one LLM call per conversation. The input is a numbered transcript plus the serving agent's `policies`. The output is structured: `{ results: [{ policyId, pass, turnId?, evidence?, reason }] }`. It uses `getLLMConfig("evals")` at temperature 0.1, like `similarityJudge`. A judge failure on one conversation is counted (`judgeErrors`) and never fails the run.

Both layers produce the same `AuditFinding` shape (source `CODE` | `JUDGE`).

### D2. Policies live in `agents.yaml`

`agentConfigSchema` gains `policies?: [{ id, rule, severity: critical | warning }]`, carried on `Agent`. `agentVersionOf` does **not** hash policies, so editing audit rules doesn't look like agent drift. A conversation is judged against the policies of the agent named on its latest AGENT turn. If that agent has no policies, the judge is skipped and code checks still run.

### D3. The window and what counts as a conversation

- A run reviews turns with `id > lastRun.lastTurnId`, where `lastRun` is the latest DONE run. The first run takes turns from the last 24h.
- Using the id watermark instead of timestamps means no turn is skipped or reviewed twice, and the autoincrement id is already the ordering key.
- A conversation is one phone's turns. For context, the judge also sees up to 20 turns before the window for that phone, marked as prior context; findings may only cite turns inside the window.
- `maxConversations` caps judge calls, taking the conversations with the most recent activity first. The rest get code checks only, and `judgeSkipped` records how many.

### D4. Persistence

- `ConversationAuditRun`: `id`, `trigger` (SCHEDULED | MANUAL), `actorName`, `status` (RUNNING | DONE | FAILED), `startedAt`, `finishedAt?`, `windowStart?`, `firstTurnId?`, `lastTurnId?`, `conversations`, `turns`, `handoffs`, `failedSends`, `criticalCount`, `warningCount`, `judged`, `judgeSkipped`, `judgeErrors`, `byAgent` (JSON: name, profile, version, conversations, critical, warning), `error?`.
- `ConversationAuditFinding`: `id`, `runId`, `phone`, `applicationId?`, `customerId?`, `profile?`, `agentName?`, `agentVersion?`, `checkId`, `source`, `severity`, `rule`, `turnId?`, `evidence?`, `reason`, `createdAt`.
- No foreign keys to domain rows, like `conversation_turns`. The finding → run relation is kept.

### D5. One run at a time

Before starting, a run fails fast with a structured error when a RUNNING run exists that started less than 30 minutes ago. After 30 minutes, a stale RUNNING row (for example, one orphaned by a crash) is marked FAILED and the new run proceeds. The scheduled tick skips quietly; the copilot tool returns the error message.

### D6. Surfaces

- **Worker** (`createConversationAuditWorker`): croner on `conversationAudit.schedule` in `timezone`. It starts only when `enabled` is true, and it logs at boot either way.
- **Copilot**: `runConversationAudit` is a DIRECT tool. It is read-only with respect to business data (it only writes audit rows and a feed event), so there's no confirm card, which matches the Pencil copilot screen. The actor is the founder's name.
- **Feed event** `conversation.audited`: summary text plus a payload with `runId`, `trigger`, the counts, `byAgent`, and a `topFinding` (severity, rule, agentName, personLabel, quote, applicationId). The card renders from the payload alone.
- **Details**: `listConversationAuditFindings({ runId })` (reviewer+) returns findings with the person's name resolved (application or customer) for the side panel. "Ver conversación" opens the application panel when `applicationId` is known; otherwise the finding shows the phone.

### D7. Card accent

Amber when `criticalCount + warningCount > 0`, green otherwise. The card's meta line shows the counts and the trigger ("automática · 7:00" or "Pedida por X desde el copiloto").

## Risks / Trade-offs

- **LLM cost/latency**: at today's volume (tens of conversations a day) it's small, and `maxConversations` bounds it.
- **Judge noise**: a false positive shows as a finding the founder can dismiss by reading it; there's no automated action. Critical checks that must be exact (the score leak) also have a regex backstop.
- **Transcript privacy**: transcripts already go to the same LLM provider during the conversation, so no new vendor is involved.
- **Config rollout**: prod `mikro.json` must get `conversationAudit` only after deploy (strict schema).
