# Ship checkpoint — add-founder-feed

Started: 2026-07-01
Current stage: 5 — Sync (gated; awaiting user's second manual test + approval)

**Scope:** First shippable slice of the Founder Dashboard ("Feed en vivo", pencil.pen board `EzobQ`): an append-only business event log in the apiserver (single source of truth — stores everything in the feed forever) plus the founder-facing dashboard UI: chronological feed home with compact/expandable cards, universal search, and a light reports list with downloads. The copilot + `mikro-mcp` intelligence layer is a follow-up change that consumes this event log. Local SQLite speed cache: scoping decision pending design gate (lean = defer to follow-up change).

**Detected surfaces:** OpenSpec: yes · Pencil: yes (pencil.pen, MCP only) · Storybook: yes (mods/dashboard) · E2E: no Playwright in dashboard (Maestro exists in mobile only — not applicable)

| #   | Stage           | Status  | Notes                                                                                                                                                                                                                                                                           |
| :-- | :-------------- | :------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | Frame           | done    | Change scaffolded; proposal.md written                                                                                                                                                                                                                                          |
| 1   | Design (Pencil) | done    | Board EzobQ iterated 4 rounds w/ user this session; user's "/ps:ship — start building this" = gate approval                                                                                                                                                                     |
| 2   | Spec reconcile  | done    | design.md + 5 delta specs authored from approved board; `openspec validate` green                                                                                                                                                                                               |
| 3   | Build           | done    | All task groups 1–5 complete: contract (Fable), backend w/ middleware capture (Opus), components (Sonnet), pages+shell (Sonnet)                                                                                                                                                 |
| 4   | Test            | done    | apiserver 331 unit + 435 integration passing (1 pre-existing Chat failure, unrelated); typecheck green common/apiserver/dashboard; dashboard lint clean except pre-existing server-stub.ts; e2e **skipped** — no dashboard e2e harness exists. Manual user testing in progress. |
| 5   | Sync            | pending | gate                                                                                                                                                                                                                                                                            |
| 6   | Archive         | pending | gate                                                                                                                                                                                                                                                                            |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

- 2026-07-04 — Founder app rebuilt Pencil-faithful (Opus, tasks 5.1–5.6): self-contained src/founder/ (own components, zero ops design-system imports), routes /founder|/founder/buscar|/founder/reportes outside ops Layout, RequireFounder gate, ops UI byte-identical to HEAD. Fable visual pass via Storybook screenshot vs Pencil w9SdH: matched; fixed English payload leakage (curated Spanish snapshot rows, enum translations). Gates green (typecheck/lint/storybook). Feed seeded (19 events).

- 2026-07-04 — **User rejected UI** ("Is this a joke?"): didn't match Pencil, felt bolted-on, no data. Fixes: (1) capture pipeline verified working via createCaller smoke test — zero events likely means user's actions failed/weren't annotated mutations; (2) specs reconciled to a SEPARATE founder entry (`/founder/*`, own FounderShell, ops nav reverted to untouched); (3) Opus agent rebuilding UI with Pencil `export_html` files as ground truth (scratchpad/pencil-export/); (4) seed script `scripts/seed-feed-events.mjs` added + run — 19 events, 6 types, day-spread. Also fixed Vite fs-externalized crash (root-barrel import → `@mikro/common/schemas`).

- 2026-07-02 — Backend landed under revised design (tasks 1–3, 6.1–6.3 checked): middleware capture, mappers registry, 24 feed tests green, mutation files verified back at HEAD. Deviations accepted: policyException hardcoded false (no override concept in approve flow yet), loan.status_changed lacks prior status, conversion emits application.converted only. Pages+shell agent (Sonnet) launched for tasks 5.x.

- 2026-07-02 — **Event capture redesigned with user** (they flagged mutation-function pollution): events now captured at tRPC boundary via middleware + `.meta({event})` + central mapper registry; mutation functions untouched (except createDeleteApplication returning the deleted row for snapshots). Post-commit write accepted (ms loss window, loud logging); NATS considered and deferred behind the recordEvent seam. design.md, business-event-log spec, tasks.md updated; `openspec validate` green.
- 2026-07-01 — Stage 3 started. Fable authored the shared contract (`mods/common/src/schemas/businessEvent.ts`, exported from @mikro/common, typecheck green). Backend (Prisma model+migration, recordEvent, producers, feed/restore/search/export procedures, tests) delegated to Opus agent; Storybook feed components delegated to Sonnet agent; both in parallel. Pages+shell wiring queued for after both land.
- 2026-07-01 — Design decisions locked in design.md: transactional event write (no bus/outbox); one wide table, payload as JSON String (sqlite); cursor pagination for feed (documented convention exception); founder=ADMIN (no new role); restore=applications-only from event snapshot, 30-day window; SQLite cache + copilot + synthetic producers + PDF reports deferred.

Newest first. One line per meaningful decision or stage transition.

- 2026-07-01 — Scope decision: change 1 = event log + feed + search + reports list; copilot/mikro-mcp = follow-up change. Name `add-founder-feed`.
- 2026-07-01 — Architecture locked (user, corrected twice): apiserver event log = permanent source of truth; local SQLite = disposable speed cache; reports = exports of the log.
- 2026-07-01 — Checkpoint created; framing the change.
