# Ship checkpoint — add-feed-card-narratives

Started: 2026-07-02
Current stage: 6 — Archive (complete)

**Scope:** Replace the expanded feed card's generic KV-grid detail view with (1) a per-event-type template-composed narrative sentence — no LLM call, all fields already available client-side — (2) a small "Metadata" link that opens the raw event JSON, and (3) a small "IA insights" link that opens the founder copilot dock prefilled with a contextual question about that record. Must cover all 12 `BusinessEventType` values in `typeConfig.ts`, not just the two mocked in Pencil (payment.collected, application.deleted).

**Detected surfaces:** OpenSpec: yes · Pencil: yes (`pencil.pen`) · Storybook: yes (`mods/dashboard`) · E2E: no (no Playwright in repo)

| #   | Stage           | Status | Notes                                                                                                                                                                                                                                                                                                                           |
| :-- | :-------------- | :----- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | Frame           | done   | New change `add-feed-card-narratives`; no prior checkpoint existed                                                                                                                                                                                                                                                              |
| 1   | Design (Pencil) | done   | Visual pattern locked in Pencil (row `VIflA`, board `EzobQ`). Per-type narrative copy for all 12 event types drafted in `design.md`; both open questions confirmed by user with recommended defaults                                                                                                                            |
| 2   | Spec reconcile  | done   | `proposal.md`, `design.md`, delta spec, and `tasks.md` written; `openspec validate --strict` passes                                                                                                                                                                                                                             |
| 3   | Build           | done   | `resolveNarrative`/`resolveInsightsQuestion` added to `typeConfig.ts`, `resolveDetailRows`/`snapshotDetailRows`/`DetailRow`/`HANDLED_KEYS` removed (confirmed no other callers); `FeedCard.tsx` rewired (narrative row + Metadata/IA-insights links); new `EventMetadataPanel.tsx`; fixtures + stories updated for all 12 types |
| 4   | Test            | done   | No unit-test runner in `mods/dashboard` (Storybook is the existing convention, per tasks.md §5.1) — `tsc -b --noEmit` clean, `eslint` clean (3 prettier issues auto-fixed)                                                                                                                                                      |
| 5   | Sync            | done   | `founder-feed` requirement "Card content and actions are event-type specific" replaced with the delta's narrative/Metadata/IA-insights version + 5 new scenarios, merged into `openspec/specs/founder-feed/spec.md`                                                                                                             |
| 6   | Archive         | done   | Moved to `openspec/changes/archive/2026-07-03-add-feed-card-narratives/`                                                                                                                                                                                                                                                        |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-07-03 — Synced and archived: merged the delta spec into `openspec/specs/founder-feed/spec.md` (full requirement rewrite + 5 new scenarios), archived the change to `openspec/changes/archive/2026-07-03-add-feed-card-narratives/`. Landed as part of PR #77 alongside copilot markdown rendering, formatting guidance, the profile menu, and ops-terminology cleanup.
- 2026-07-03 — Verified build + test stages directly (background agent session hit a connection error mid-run and looped on self-reporting without converging): `tasks.md` checkboxes ticked (all 5 groups genuinely complete on inspection of the diff), `tsc -b --noEmit` clean, `eslint` had 3 prettier-only errors auto-fixed with `--fix`, `openspec validate --strict` passes, no dangling references to removed `resolveDetailRows`/`DetailRow`. Stages 2-4 marked done; stopping here for the Sync human gate.
- 2026-07-03 — Both open questions confirmed by user with recommended defaults: (1) omit "motivo" from `application.deleted` narrative this change; (2) `loan.status_changed` degrades to "Préstamo actualizado a {to}" when `from` is empty. Design gate closed; proceeding into spec reconcile.
- 2026-07-02 — Wrote `proposal.md` (Why/What Changes/Capabilities/Impact/Open Questions) and `design.md` (full 12-type narrative template table + IA-insights question table + Metadata link spec) under `openspec/changes/add-feed-card-narratives/`.
- 2026-07-02 — No LLM call for narratives: confirmed via `typeConfig.ts` (`resolveDetailRows`/`snapshotDetailRows`) and `mappers.ts` that every field needed is already on `FeedEvent`/`payload` at write time. Template composition only.
- 2026-07-02 — Pencil row `VIflA` updated: removed manual "Generar nota con IA" button and async "Generando..." state; added `cp/metadata-link` and `cp/insights-link` reusable components; added a JSON-metadata demo card.
- 2026-07-02 — Found scope gap: the Pencil mockup's "Motivo: duplicada" on the deletion card is **not backed by real data** — `deleteApplicationSchema` has no `reason` field. Flagged for user decision (see design presentation).
- 2026-07-02 — Found scope gap: `loan.status_changed` mapper always writes `payload.from = ""` (prior status not observable at the tRPC boundary today) — template must degrade gracefully.
- 2026-07-02 — Checkpoint created; framing the change.
