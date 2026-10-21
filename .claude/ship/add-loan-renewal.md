# Ship checkpoint — add-loan-renewal

Started: 2026-10-14
Issue: #334 · Branch: `feat/loan-renewal`
Current stage: built + tested (phases 1-6); draft PR #359 awaiting the user's review; walkthrough video recorded

**Scope:** Atomic "Renovar": old loan → RENEWED (closedAt, mora frozen), new loan with full principal + renewedFromLoanId, net WITHDRAWAL (principal − payoff), contract as CustomerDocument with loanId, `loan.renewed` feed event. Copilot RenewalFormCard + search-row action; ctl `loans:renew`.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (`pencil.pen`, has pre-existing uncommitted edits) · Storybook: yes (`mods/dashboard`) · E2E: yes (`mods/dashboard/e2e`, Playwright)

| #   | Stage           | Status      | Notes                                                                                                                                                                                                                                                                           |
| :-- | :-------------- | :---------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | Frame           | done        | Issue #334 filed; change validated `--strict`                                                                                                                                                                                                                                   |
| 1   | Design (Pencil) | in-progress | Redrawn 2026-10-17 on main's pencil.pen after merge: sec-03 renewalCards `JEmaR` (cp/renewal-form-card `uf915`, net-invalid `SNsbi`, done `twcth`, error `j7Y4v`); sec-04 catálogo r3 "Préstamo renovado" `UGEkK`; Búsqueda loanCard `qHOCL` + Renovar. Awaiting user approval. |
| 2   | Spec reconcile  | done        | Search "Renovar" = prefill-then-send (ACTIVE only); validate --strict green. Re-check after Pencil design.                                                                                                                                                                      |
| 3   | Build           | done        | Backend, ctl `loans:renew`, RenewalFormCard + 8 stories, dock wiring, search-row action, feed visuals                                                                                                                                                                           |
| 4   | Test            | done        | apiserver 907 (unit+integration), common 298, dashboard e2e 11/11 incl. renew.spec, lint + typecheck (tsc -b) green, Storybook builds                                                                                                                                           |
| 5   | Sync            | pending     |                                                                                                                                                                                                                                                                                 |
| 6   | Archive         | pending     |                                                                                                                                                                                                                                                                                 |

## Decision log

- 2026-10-14 — UI built ahead of Pencil (user: "adjust later"). Pencil release gate still applies: cp/renewal-form-card + loan.renewed feed row + search-row Renovar must land in pencil.pen before release. E2E stubs only copilotChat (no LLM in e2e).

- 2026-10-14 — Backend done: migration as plain ADD COLUMNs (no table rebuild, zero drift); renewLoan in one tx with in-tx `loan.renewed` event (listed as intrinsic in mapper-coverage test); tags skip RENEWED; contract render extracted to `renderAndStoreCustomerContract`.

- 2026-10-14 — User: start backend before the design gate, "we adjust later". UI (stage 3 dashboard part) still waits for the Pencil design.

- 2026-10-14 — User decisions: RENEWED status (no fake payoff payment); net WITHDRAWAL; payoff = remainingBalance + mora, editable; copilot card + search-row Renovar.
- 2026-10-14 — `closed-loan-reconciled` only inspects COMPLETED → RENEWED passes with no check change.
- 2026-10-14 — `closedAt` column as mora freeze anchor (updatedAt drifts).
- 2026-10-14 — Opened mikro/pencil.pen via `open -a Pen` (MCP only targets active canvas). Designs mirror code exactly; no spec change expected.
- 2026-10-17 — Merged origin/main (v3.16.0, 18 commits) into the branch. schema.prisma conflict was main's whole-file `prisma format`; re-applied renewal fields on main's file. Migration renamed 20261014120000 → 20261017130000_loan_renewal so it sorts after main's; zero drift verified. RenewalFormCard moved to dark-mode tokens (#352). pencil.pen: took main's, redrew renewal designs; pre-merge copy at .claude/ship/pencil.pen.pre-merge-20261017 (held the user's older uncommitted edits).
- 2026-10-17 — Post-merge: build + typecheck (all pkgs) green; unit 54/343/352/675 passing; integration 963 passing; Playwright 12/12. Agents unit tests need MIKRO_CONFIG_FILE=apiserver test fixture locally — the untracked mods/agents/test/fixtures/mikro.json is pre-#350 config.
- 2026-10-20 — Scope change (user): renewal becomes a process (`LoanRenewal`: DRAFT→CONTRACT_READY→SIGNED→COMPLETED, cancel anytime), own feed card, admins+reviewers, customer profile panel, search incl. past applications (no DRAFT/ABANDONED). Payoff recomputed at finalize, affects only the ledger net. Plan: ~/.claude/plans/i-see-a-few-gleaming-flame.md. Work moved to branch `feat/renewal-process` (worktree .claude/worktrees/renewal-process, off feat/loan-renewal). OpenSpec change rewritten (proposal, design 9-17, specs loan-renewal/founder-copilot/contract-generation + new customer-profile, unified-search, tasks reset). `openspec` CLI not installed locally — specs not machine-validated.
- 2026-10-20 — Pencil sec-12 "Renovación como proceso" drawn on board EzobQ (end of board): A feed cards per status (oddNV), B customer profile panel (Ed9ql), C renewal panel views + cancel confirm (CFqIT), D Búsqueda with applications (b9wff), E rules note (x6gM6). sec-03 marked superseded. Awaiting design sign-off; no code started.
- 2026-10-20 — Built: phase 1 schema/common, 2 apiserver (lifecycle, roles, search, feed), 3 copilot+ctl (one-step renewLoan removed), 4 dashboard (customer panel, renewal panel, feed card, search for reviewers), 5 tests (common 383, apiserver unit 686 / integration 1011, dashboard e2e 18), walkthrough via `npm run demo:renewal`. Known gaps: Pencil sec-12 not re-synced to the final UI details (tab counts, WhatsApp link, doc labels); NET_CHANGED covered in integration + the demo, not in CI e2e.
