# Ship checkpoint — add-conversation-audit

Started: 2026-09-26
Current stage: done

**Scope:** A scheduled audit of stored CX WhatsApp conversations: on/off switch and cron in `mikro.json`, plus an on-demand run from the copilot. Each run applies code checks and an AI rules judge (per-agent `policies` in agents.yaml), stores runs and findings, and posts a `conversation.audited` founder-feed card with a findings detail panel.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (pencil.pen, board EzobQ) · Storybook: yes (mods/dashboard) · E2E: yes (mods/dashboard/e2e, Playwright)

| #   | Stage           | Status | Notes                                                                                                                                                                |
| :-- | :-------------- | :----- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done   | proposal.md; worktree .claude/worktrees/conversation-audit                                                                                                           |
| 1   | Design (Pencil) | done   | EzobQ sec-09 `T6xLA`: feed `Mc4mI` (card `ZfXZu`, clean row `c6H15`), panel `d1f06w` (drawer `VA81L`), copilot `v2nCpn`, notes `EFMTn`. User approved ("Looks good") |
| 2   | Spec reconcile  | done   | design.md + 4 delta specs + tasks; `openspec validate --strict` OK. Findings query is admin-only (feed is admin)                                                     |
| 3   | Build           | done   | common → agents (policies, checks, judge, runAudit, tool) → apiserver (models+migration, run/list, worker, copilot DIRECT, tRPC) → dashboard (card, panel, stories)  |
| 4   | Test            | done   | agents 277, apiserver 588 unit + 856 integration, e2e 8/8 (new conversation-audit.spec), lint + tsc clean; screenshots checked vs Pencil                             |
| 5   | Sync            | done   | synced by `openspec archive` (follow-up PR, card simplification)                                                                                                     |
| 6   | Archive         | done   | archived as 2026-09-27-add-conversation-audit                                                                                                                        |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

- 2026-09-26: The user asked for a daily card on schedule, plus an on-demand run from the copilot, like other events (→ a DIRECT tool, forceQCobroSync precedent).
- 2026-09-26: User answers: review window is "since last run"; findings are stored in audit tables and shown in a detail view; the judge reads every conversation up to `maxConversations`; work happens in a new worktree.
- 2026-09-26: José's 7-turn cap stays unchanged. The check only reports it (cap under review, see memory).
- 2026-09-26: Checkpoint created.
- 2026-09-26: At the user's request, renamed `mikro.json.example` to `mikro.example.json` and updated the live references: the deploy workflow's CI smoke, README, openspec/project.md, and the config.ts error message. Archived changes and CHANGELOG are untouched. Added a `conversationAudit` block to the example. The example boots the CI smoke container, so the same change adds `conversationAuditSchema` and `getConversationAuditConfig` (both barrels). Common tests: 289 passing.
- NOTE: Pencil edits land in the MAIN checkout's `pencil.pen`. Copy it into the worktree before committing.
- 2026-09-26: Build + tests done. Summary drops the trailing period (Pencil). The e2e seed runs the real audit with a stub judge (no LLM): one failed_send warning.
- 2026-09-26: The committed pencil.pen was copied from the main checkout. It also carries the post-#303 Conversación sync, which was never committed.
- 2026-09-27: #305 merged. User: card too busy, it should only say whether we comply. Redesign (Pencil `PoM6l`): headline + AI status paragraph (template fallback) + "Ver detalle". Other screens updated. Built in worktree audit-card-simplify; synced and archived in the same PR (offered earlier, user said "That's good").
