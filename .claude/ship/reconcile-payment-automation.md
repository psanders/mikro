# Ship checkpoint — reconcile-payment-automation

Started: 2026-07-29
Current stage: DONE — all 6 stages complete, change archived

**Scope:** Issue #224 asked for an optional Cantidad field on the Registrar Pago task card; the
behavior already shipped in PR #163 (`b42355e`, 2026-07-09) as the `payment` automation's static
`suggestedAmount` slot plus `amount`'s `defaultFrom` prefill. This change repays the spec debt #163
left behind — 12 stale `pay-collector`/`collectorId` references across 4 capabilities, one of which
asserts the _opposite_ of shipped behavior ("it does not prefill the amount") — and fixes the one
real code gap found: `TaskFormModal` renders money static slots as a plain text box.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (`pencil.pen`) · Storybook: yes (dashboard + mobile) · E2E: no

| #   | Stage           | Status | Notes                                                                                                                    |
| :-- | :-------------- | :----- | :----------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done   | #224 verified already-shipped; scope re-cut with user to spec reconcile + UX polish                                      |
| 1   | Design (Pencil) | done   | **No edit needed** — `aMH1d` audited node-by-node, already ahead of the code. Pencil released to the #214 agent.         |
| 2   | Spec reconcile  | done   | 4 delta specs written (catalog, tasks, feed, copilot); `openspec validate --strict` clean                                |
| 3   | Build           | done   | `TaskFormModal` amount branch + placeholder token + story; `toolPolicy` optional-slot doc + new test                     |
| 4   | Test            | done   | 673 pass / 1 **pre-existing** unrelated failure (see log); typecheck + eslint + prettier clean; e2e `skipped` (no infra) |
| 5   | Sync            | done   | User approved; 4 deltas merged into `openspec/specs/**`; `openspec validate --all --strict` = 43/43 pass                 |
| 6   | Archive         | done   | Archived to `openspec/changes/archive/2026-07-29-reconcile-payment-automation/`; #224 closed; 19/19 tasks                |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Concurrency note — Pencil is shared

**Resolved.** A background Sonnet agent worked issue #214 (Pencil design cleanup) in a separate
worktree. Pencil MCP ignores `filePath` and acts on whichever `.pen` file the editor has open, so
there was exactly one shared editor. Protocol: read-only Phase A audit, `batch_design` blocked
until this thread handed over. Handover sent after stage 1 turned out to need no edit; that agent
has since completed.

**Consequence for `pencil.pen`:** its working-tree diff now contains _two_ unrelated bodies of
work — the large pre-existing uncommitted diff that was already there when this session started,
plus the #214 agent's edits (report-selector fix `ynfBC`/`yxSH2`, orphan deletions `VRebo`/`dlxBa`,
relocations `A3u7y`→`nCQnp` and `oW3Pd`→`gzBYk`, copy fixes in `d1E5om`). **Neither belongs to
this change.** Do not stage `pencil.pen` when committing `reconcile-payment-automation`, and do not
revert or stash it. #214 still has two open checkboxes (the "Regla activa" and "Excepción de
políticas" cards were not found anywhere; only 2 of 4 relocation targets identified).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-07-29 — Fixed `npm run lint` hanging forever (`eslint.config.mjs`): flat config ignores `.gitignore`, and `mods/dashboard/storybook-static/` (44 minified bundles, 3.1M single-line `globals-runtime.js`) was gitignored but not eslint-ignored, so `eslint-plugin-prettier` tried to reformat it — 1h45m/100% CPU, never terminating. Also fixed `files: [".scripts/**"]` → `"**/.scripts/**"` (flat-config globs are config-dir-relative, so mobile's build script failed `no-undef` on globals that block was meant to grant). Hang → 9s; 15 errors → 4 pre-existing, all in files this change never touches. **This is a repo-tooling fix, not part of `reconcile-payment-automation` — commit it separately.** No CI workflow runs lint (only `lint-staged` pre-commit), which is why it went unnoticed.
- 2026-07-29 — Stage 5 synced on user approval. Two `pay-collector` mentions intentionally survive in main specs: `task-automation-catalog:37` (documents the supersession — correct history, not staleness) and `founder-tasks:109` (the loan-statement requirement, owned by `move-loan-statement-to-copilot`). User deferred the `pencil.pen` merge to the end, so it stays unstaged.
- 2026-07-29 — Stages 1–4 done; stopped at the stage-5 human gate. Did NOT touch `openspec/specs/**` yet.
- 2026-07-29 — Left the pre-existing `daily-close` INCOME/DEPOSIT test failure alone (stale assertion from PR #220), verified pre-existing by stashing this change and re-running on clean HEAD. Fixing accounting-semantics tests inside a spec-reconcile change would bury it.
- 2026-07-29 — Matched the money input to Pencil `dOBaU` (numeric + muted "2,500" placeholder, currency in the label) instead of the `RD$` in-field prefix I first specified; corrected the delta spec and design doc to follow the design rather than an invention.
- 2026-07-29 — Stage 1 needed no Pencil edit at all: `aMH1d` already had `f-monto-sugerido`/`Pago`/`Empleado (opcional)` and the "con el sugerido precargado" note. #163 updated Pencil; only the spec lagged. Pencil handed to the #214 agent immediately.

- 2026-07-29 — Folded in a third, small item (task 3): `automationCatalogDoc()` ignores a slot's `optional` flag, so `employeeId` reads as required to the model. Needed for the copilot spec clause to be true; called out to user as beyond the two chosen halves.
- 2026-07-29 — Left `founder-tasks`'s loan-statement requirement's stale `pay-collector` ref alone: the in-flight `move-loan-statement-to-copilot` change (19/20) deletes that automation, so touching it would conflict.
- 2026-07-29 — Rejected the issue's "Cantidad" label in favor of the shipped "Monto sugerido (RD$, opcional)": `Monto` is the app-wide money term and "sugerido" conveys the value is editable at confirm.
- 2026-07-29 — Specified `defaultFrom` as a generic slot property on the registry requirement rather than a `payment` special case, matching how the code actually dispatches it.
- 2026-07-29 — User re-cut scope after frame: spec reconcile + UX polish, close #224 crediting #163.
- 2026-07-29 — Frame found #224's four acceptance criteria all already satisfied in code by PR #163; specs never reconciled.
- 2026-07-29 — Checkpoint created; framing the change.
