# Ship checkpoint — add-loan-renewal

Started: 2026-10-14
Issue: #334 · Branch: `feat/loan-renewal`
Current stage: 1 Design — drawn in pencil.pen, awaiting "we're happy"; build + tests done

**Scope:** Atomic "Renovar": old loan → RENEWED (closedAt, mora frozen), new loan with full principal + renewedFromLoanId, net WITHDRAWAL (principal − payoff), contract as CustomerDocument with loanId, `loan.renewed` feed event. Copilot RenewalFormCard + search-row action; ctl `loans:renew`.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (`pencil.pen`, has pre-existing uncommitted edits) · Storybook: yes (`mods/dashboard`) · E2E: yes (`mods/dashboard/e2e`, Playwright)

| #   | Stage           | Status      | Notes                                                                                                                                                                                                                                                           |
| :-- | :-------------- | :---------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done        | Issue #334 filed; change validated `--strict`                                                                                                                                                                                                                   |
| 1   | Design (Pencil) | in-progress | Drawn 2026-10-14 to match built UI: sec-03 renewalCards `pyY8v` (cp/renewal-form-card `Vpu1E` + net-invalid `q2wNw`, done `tfL9y`, error `OW2Aj`); sec-04 catálogo r3 "Préstamo renovado" `KBvyF`; Búsqueda loanCard `LThTJ` + Renovar. Awaiting user approval. |
| 2   | Spec reconcile  | done        | Search "Renovar" = prefill-then-send (ACTIVE only); validate --strict green. Re-check after Pencil design.                                                                                                                                                      |
| 3   | Build           | done        | Backend, ctl `loans:renew`, RenewalFormCard + 8 stories, dock wiring, search-row action, feed visuals                                                                                                                                                           |
| 4   | Test            | done        | apiserver 907 (unit+integration), common 298, dashboard e2e 11/11 incl. renew.spec, lint + typecheck (tsc -b) green, Storybook builds                                                                                                                           |
| 5   | Sync            | pending     |                                                                                                                                                                                                                                                                 |
| 6   | Archive         | pending     |                                                                                                                                                                                                                                                                 |

## Decision log

- 2026-10-14 — UI built ahead of Pencil (user: "adjust later"). Pencil release gate still applies: cp/renewal-form-card + loan.renewed feed row + search-row Renovar must land in pencil.pen before release. E2E stubs only copilotChat (no LLM in e2e).

- 2026-10-14 — Backend done: migration as plain ADD COLUMNs (no table rebuild, zero drift); renewLoan in one tx with in-tx `loan.renewed` event (listed as intrinsic in mapper-coverage test); tags skip RENEWED; contract render extracted to `renderAndStoreCustomerContract`.

- 2026-10-14 — User: start backend before the design gate, "we adjust later". UI (stage 3 dashboard part) still waits for the Pencil design.

- 2026-10-14 — User decisions: RENEWED status (no fake payoff payment); net WITHDRAWAL; payoff = remainingBalance + mora, editable; copilot card + search-row Renovar.
- 2026-10-14 — `closed-loan-reconciled` only inspects COMPLETED → RENEWED passes with no check change.
- 2026-10-14 — `closedAt` column as mora freeze anchor (updatedAt drifts).
- 2026-10-14 — Opened mikro/pencil.pen via `open -a Pen` (MCP only targets active canvas). Designs mirror code exactly; no spec change expected.
