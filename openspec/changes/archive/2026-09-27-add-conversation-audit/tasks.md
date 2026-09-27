## 1. Config and shared types

- [x] 1.1 Add the `conversationAudit` config section and `getConversationAuditConfig` (both barrels). Add it to `mikro.example.json`, and rename the example file from `mikro.json.example`.
- [x] 1.2 Add the `conversation.audited` event type and payload schema. Add the audit schemas and types (`runConversationAuditSchema`, `listConversationAuditFindingsSchema`) to common, exported from both barrels.

## 2. Agents: policies, checks, judge

- [x] 2.1 Add `policies` to `agentConfigSchema` and `Agent`, with unique ids per agent. Keep them out of `agentVersionOf`.
- [x] 2.2 Export `isHumanRequest`, `MAX_JOSE_TURNS` and the error-reply constant for the checks.
- [x] 2.3 Add `audit/checks.ts`: the code-check registry (failed_send, error_reply, handoff_ignored, jose_turn_cap, sensitive_score).
- [x] 2.4 Add `audit/judge.ts`: the rules judge (evals LLM, structured output, numbered transcript).
- [x] 2.5 Add `audit/runAudit.ts`: pure orchestration (checks on all conversations, judge up to the cap, counts, per-agent breakdown, judge errors).
- [x] 2.6 Add the `runConversationAudit` tool definition, executor and deps type.
- [x] 2.7 Add first `policies` sets to the CX agents in `agents.yaml`.

## 3. Apiserver

- [x] 3.1 Add the `ConversationAuditRun` and `ConversationAuditFinding` Prisma models with a migration, and mirror them in the integration `SCHEMA_SQL`.
- [x] 3.2 Add `createRunConversationAudit`: the lock, window, loading turns and hand-offs, running the audit, persisting results, and recording the feed event.
- [x] 3.3 Add `createListConversationAuditFindings`, which resolves person names.
- [x] 3.4 Add a croner worker gated by `enabled`, started at boot.
- [x] 3.5 Wire the copilot: DIRECT tool policy, summarizeAction, and executor deps in index.ts.
- [x] 3.6 Add a tRPC `listConversationAuditFindings` query (admin, like the feed).

## 4. Dashboard

- [x] 4.1 typeConfig: visual, meta, narrative and insights question for `conversation.audited`.
- [x] 4.2 Add a `ConversationAuditCard` (strip, per-agent rows, top finding, actions) with a story.
- [x] 4.3 Add a `ConversationAuditPanel` (findings side panel) with a story. "Ver conversación" opens the application panel.
- [x] 4.4 Route the event in FeedScreen, and add it to the "Mensajes" filter.

## 5. Tests

- [x] 5.1 Agents unit tests: checks (each check, plus negatives), runAudit (cap, judge error, breakdown), policies schema.
- [x] 5.2 Apiserver integration tests: window watermark, lock, persistence, feed event, findings list.
- [x] 5.3 Seed the e2e data with an audit run, and add a Playwright spec: card, then detail panel, then conversation.
- [x] 5.4 Run lint, typecheck and all test suites green.

## 6. Docs

- [x] 6.1 Add a CX_EXPLAINER section: how to enable the audit, the checks, policies, and rollout order (config after deploy).

## 7. Card simplification (follow-up)

- [x] 7.1 Pencil: the card states the verdict only (headline + status paragraph + "Ver detalle"). The panel screen, copilot screen and notes are updated.
- [x] 7.2 Agents: `auditHeadline`, `auditCountingPhrase`, `auditStatusFallback`, and `createWriteAuditStatus` (the evals LLM).
- [x] 7.3 Apiserver: the run writes `statusText` and `flaggedConversations` into the event (LLM only when there are findings, with the template as fallback), plus the new headline. The copilot relays the status.
- [x] 7.4 Dashboard: the card shows the narrative (`statusText`) and a "Ver detalle" link. FeedCard gains `hideLinks`. The old detail components are removed.
- [x] 7.5 Tests: status unit tests, integration (AI status, fallback, a clean run doesn't call the writer), e2e.
