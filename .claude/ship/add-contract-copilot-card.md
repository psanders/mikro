# Ship checkpoint — add-contract-copilot-card

Started: 2026-07-10
Current stage: DONE — shipped, archived; committing + PR

**Scope:** Let a founder generate an ad-hoc loan contract for an existing customer from the founder copilot dock. Asking the copilot opens an interactive form card (customer search + gender + loan terms); _Generá_ renders the PDF via the shared `renderContractPdf`, downloads it inline, and records a `contract.generated` feed event. Customer-sourced identity, founder-supplied terms, no PDF persistence, no status change.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (`pencil.pen`) · Storybook: yes (`mods/dashboard/.storybook`, `mods/mobile/.storybook`) · E2E: no (no Playwright/e2e dir)

| #   | Stage           | Status | Notes                                                                                                                                                                                                  |
| :-- | :-------------- | :----- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done   | Change proposed + validated (4/4 artifacts)                                                                                                                                                            |
| 1   | Design (Pencil) | done   | Approved: picked state only, city as read-only hint, optional collapsed. Screen z2TcOH, card O0r2pr                                                                                                    |
| 2   | Spec reconcile  | done   | No behavioral drift; design matches delta specs. `openspec validate` green                                                                                                                             |
| 3   | Build           | done   | Backend + copilot (openContractForm tool + contractForm reply channel) + dashboard ContractFormCard (Storybook, 4 stories) + picker (reuses listCustomers) + download + feed card. All typecheck clean |
| 4   | Test            | done   | common 102, apiserver 424 passing; new: 6 mapper + 5 gen-fn + 3 tool-policy. Lint clean on all changed files. e2e SKIPPED (no Playwright harness — verify via app run)                                 |
| 5   | Sync            | done   | 3 deltas promoted: contract-generation (new spec), founder-copilot + founder-feed (added reqs). Validate green (no-referrals pre-existing fail, unrelated)                                             |
| 6   | Archive         | done   | Moved to openspec/changes/archive/2026-07-10-add-contract-copilot-card                                                                                                                                 |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-07-10 — /code-review medium: 4 findings, all fixed except F3. F1 (start-date UTC-midnight off-by-one vs renderer's local getDate → parse yyyy-mm-dd at local noon in mapper + test) · F2 (amount inputs rejected thousands separators → parseNumeric strips `,`/spaces) · F4 (customerHint didn't trigger search → useEffect fires onSearch on mount). F3 (reopening dock leaves ack without its ephemeral form) noted as by-design limitation, not fixed. Re-test/typecheck/lint green.
- 2026-07-10 — Build COMPLETE + Test green: copilot `openContractForm` DIRECT tool + `contractForm` reply channel (schema+loop) w/ tool-policy test; dashboard `ContractFormCard` (Storybook, 4 stories) + container wiring (listCustomers picker, generateCustomerContract → saveFile download, feed invalidate); feed `contract.generated` card (icon/accent/narrative/Ver-cliente). All 3 mods typecheck + lint clean. e2e skipped (no harness). → Stage 5 gate: /code-review medium before PR.
- 2026-07-10 — Build (backend slice) DONE + green: `generateCustomerContractSchema` + `buildContractDataFromCustomer` mapper (common, 6 tests) · `createGenerateCustomerContract` fn (apiserver, 5 tests, real %PDF) · `contract.generated` event type+payload+mapper · ADMIN `generateCustomerContract` procedure w/ `.meta` event capture. apiserver typecheck clean. Scope trim: reuse `createListCustomers` for the picker (no new search tool). Remaining build = copilot tool/reply channel + dashboard form card/feed card + tests.
- 2026-07-10 — Design gate PASSED: picked-state only, city = read-only hint (homeAddress), optional fields collapsed. Stage 2 spec reconcile: no drift, `openspec validate` green. → Stage 3 Build.
- 2026-07-10 — Design (Pencil): built reusable `cp/contract-form-card` (O0r2pr) + mock screen "Founder / Copiloto — generar contrato" (z2TcOH, dock bOd3Q) showing the in-thread flow. Awaiting design-gate approval. (Isolated root-frame screenshot renders blank/50px-offset — an isolation artifact; renders correct as an instance inside the themed dock.)
- 2026-07-10 — Architecture: chose the **live copilot form-card** path (Option B) over the task-automation-catalog path — matches "generate from within the copilot". New `openContractForm` direct tool + `contractForm` reply channel + `generateCustomerContract` procedure (off the LLM loop) + `searchCustomers` read tool + `contract.generated` feed event.
- 2026-07-10 — Customer-sourced identity (name/cédula/city/occupation from `Customer`); gender + terms are founder-supplied on the card; picker = search-as-you-type; download-only (no PDF persistence).
- 2026-07-10 — Ad-hoc contract for Enersida Brito Estrella generated via standalone script (kept in scratchpad, uncommitted) — motivated this feature.
- 2026-07-10 — Checkpoint created; frame done, proposal/design/specs/tasks written and `openspec validate` green.
