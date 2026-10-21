## Why

Customers often renew a loan before finishing it (e.g. 8 of 10 cuotas paid): the new loan's principal covers what is still owed, and only the difference is handed over in cash. Today ops does this by hand — `updateLoanStatus` → COMPLETED on the old loan, then `createLoan` for the new one. That leaves four gaps (issue #334):

- No ledger entry: `createLoan` posts nothing, unlike `convertApplication`'s auto-disbursement.
- A COMPLETED loan with money still owed fails the `closed-loan-reconciled` health check.
- Mora keeps accruing on the closed loan.
- Nothing links the old loan, the new loan, and the new contract.

The first cut made renewal one atomic, admin-only action inside the copilot. Real renewals are a **process**: terms get negotiated, a contract is generated, the signed copy comes back days later, and the deal can fall through. Reviewers handle customers too, but cannot search, open a customer, or renew. This change turns renewal into a process with its own feed card, gives admins and reviewers one search and a real customer profile, and lets them find past applications.

## What Changes

- **Renewal is a process** (`LoanRenewal`): `DRAFT → CONTRACT_READY → SIGNED → COMPLETED`, or `CANCELLED` from any state before completion. It appears as its own card in the feed. Finalizing is the only step that writes to loans or the ledger.
  - Start, edit terms, generate the contract for the new loan, upload the signed contract or additional documents, cancel, finalize.
  - **Finalize** (one DB transaction): the old loan becomes `RENEWED` with `closedAt`; the new loan is created from the renewal's stored terms (`renewedFromLoanId`); **one WITHDRAWAL of `newPrincipal − what is still owed on the old loan`** is posted (owes 2,500, new loan 10,000 → ledger 7,500); the renewal's documents attach to the new loan; events are recorded.
  - What is owed is **recomputed at finalize** from the old loan's live snapshot. It changes **only the ledger amount**, never the contract or the new loan's terms. If it moved since the card last showed it, finalize fails with `NET_CHANGED` and nothing is written until the user re-confirms.
- **Admins and reviewers** can search, open customers, and run renewals. The copilot stays admin-only.
- **Unified search**: customers, loans, events **and past loan applications** by name (full or partial), phone, or cédula. `DRAFT` and `ABANDONED` applications are never returned. Clicking an application opens the right-hand application panel.
- **Customer profile panel** (opened by "Ver perfil"): edit customer data, view and upload documents, see loans and past applications, start a renewal.
- Loan status `RENEWED`, `Loan.renewedFromLoanId`, `Loan.closedAt`; mora on a RENEWED loan is frozen at `closedAt` (unchanged from the first cut).
- The one-shot `renewLoan` mutation and the copilot `RenewalFormCard` are **removed**. The copilot `openRenewalForm` tool and `mikro loans:renew` now **start** a renewal and open it.
- No new `mikro.json` keys — reuses `accounting.disbursementAccountId` / `disbursementAccounts`.

## Capabilities

### New Capabilities

- `loan-renewal`: the renewal process, its state machine, finalize/ledger semantics, RENEWED status, feed card and events, ctl.
- `customer-profile`: customer panel — edit, documents (view/upload), loans, past applications, renew.
- `unified-search`: one search for admins and reviewers across customers, loans, events and applications.

### Modified Capabilities

- `founder-copilot`: `openRenewalForm` starts a renewal and opens its panel (no one-shot form card).
- `contract-generation`: the renewal contract is generated from the renewal's terms and tied to the new loan at finalize.
- `mora-accrual`: RENEWED loans stop accruing at `closedAt`.
- `founder-feed` / `founder-search` / `customer-documents`: renewal card and events; search open to reviewers with applications; documents can be uploaded from the dashboard.

## Impact

- Prisma: `LoanRenewal`, `LoanStatus.RENEWED`, `Loan.renewedFromLoanId`, `Loan.closedAt`, `CustomerDocument.loanId` and `CustomerDocument.renewalId`; partial unique index (one open renewal per loan); migration + integration `SCHEMA_SQL`.
- `mods/common`: renewal schemas and `evaluateRenewalTransition`, event catalog (`loan.renewal.*`), `SEARCHABLE_APPLICATION_STATUSES`, widened `updateCustomerSchema`, `searchAllSchema` applications group.
- `mods/apiserver`: renewal lifecycle functions, customer-document upload/get/delete, `searchAll` with applications, feed join + reviewer scoping for renewal events, role changes in `protected.ts`.
- `mods/dashboard`: Búsqueda for reviewers, `CustomerPanel`, `LoanRenewalFeedCard` + `RenewalPanel`, application search rows; e2e + seed.
- `mods/ctl`: `loans:renew` starts a renewal (+ finalize/cancel).
- Reviewers gain read access to all customers, loans and documents, and edit access to customer data including cédula. `deleteCustomerDocument` stays admin-only.
- Manual status changes cannot set RENEWED (`updateLoanStatusStatusEnum` unchanged).
