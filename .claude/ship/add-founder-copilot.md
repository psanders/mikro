# Ship checkpoint — add-founder-copilot

Started: 2026-07-04
Current stage: DONE (synced + archived + committed 2026-07-04)

**Scope:** The copilot for the founder app (Pencil board `EzobQ` section 03, screen `Uljd6`): collapsible right dock in the founder shell with the four verbs — Consultar (read), Actuar (writes ALWAYS behind an explicit confirmation step), Vigilar (user-created watch rules that publish feed cards), Auditar (query the event log). Backend agent loop in the apiserver reusing/extending existing `mods/agents` infra (explorer mapping in progress); copilot writes go through the same annotated tRPC path so they land in the event log as `copilot.action` cards; `rule.alert` events from a rule-evaluation worker. Predecessor `add-founder-feed` shipped (archived 2026-07-04, commit c279c21 on feat/founder-feed).

**Detected surfaces:** OpenSpec: yes · Pencil: yes (copilot.html + feed-dock-open.html exports in scratchpad/pencil-export/) · Storybook: yes (mods/dashboard) · E2E: no dashboard harness

| #   | Stage           | Status | Notes                                                                                                                                                                                                                                                                               |
| :-- | :-------------- | :----- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done   | Proposal written on top of agents-infra exploration (LangChain loop + 23 DI'd tools reusable; no confirm step or streaming exist)                                                                                                                                                   |
| 1   | Design (Pencil) | done   | Board section 03 user-approved in exploration; user mandate "keep building… including the copilot"; exports pulled (copilot.html, card-catalog.html)                                                                                                                                |
| 2   | Spec reconcile  | done   | design.md + 2 new specs + 2 modified deltas; `openspec validate` green                                                                                                                                                                                                              |
| 3   | Build           | done   | Contracts (Fable) + backend (Opus) + dock components (Opus) + wiring/seed (Opus). Seed now 30 events incl. real rule.alert (mora 38.89% vs 5) + copilot.action                                                                                                                      |
| 4   | Test            | done   | Backend: 331 unit + 454 integration green (1 known flake, passes on rerun). Dashboard: typecheck/lint/storybook green. Fable live-LLM smokes: read w/ provenance ✓, write→PENDING w/o execution ✓, reject ✓. Visual pass vs Pencil Uljd6 ✓. E2E **skipped** — no dashboard harness. |
| 5   | Sync            | done   | User approved after manual test; founder-copilot + copilot-watch-rules created, business-event-log + founder-feed merged                                                                                                                                                            |
| 6   | Archive         | done   | openspec/changes/archive/2026-07-04-add-founder-copilot                                                                                                                                                                                                                             |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

- 2026-07-04 — Dock components (tasks 3.1–3.3) landed: src/founder/copilot/ complete w/ stories, gates green; agent also added the missing typeConfig visual entries for copilot.action/rule.alert (unblocking typecheck after the enum grew). Backlog noted (pre-existing, not this change): dashboard `eslint .` hangs scanning src-tauri/target/ (needs ignore) + server-stub.ts lint errors since 51e8942.

- 2026-07-04 — User: "Keep building. try to get to a fully functional app. That's including the copilot features." add-founder-feed synced/archived/committed with that mandate.
- 2026-07-04 — Checkpoint created; framing pending agents-infra exploration.
