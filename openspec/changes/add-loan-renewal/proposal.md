## Why

Customers often renew a loan before finishing it (e.g. 8 of 10 cuotas paid): the new loan's principal covers what is still owed, and only the difference is handed over in cash. Today ops does this by hand — `updateLoanStatus` → COMPLETED on the old loan, then `createLoan` for the new one. That leaves four gaps (issue #334):

- No ledger entry: `createLoan` posts nothing, unlike `convertApplication`'s auto-disbursement.
- A COMPLETED loan with money still owed fails the `closed-loan-reconciled` health check.
- Mora keeps accruing on the closed loan.
- Nothing links the old loan, the new loan, and the new contract.

## What Changes

- New loan status `RENEWED`, plus `Loan.renewedFromLoanId` (link to the loan it replaced) and `Loan.closedAt` (when it was closed).
- New `getRenewalQuote` query: payoff = canonical snapshot `remainingBalance` + net accrued mora, for an ACTIVE loan.
- New `renewLoan` mutation (admin), atomic in one DB transaction:
  1. marks the old loan RENEWED with `closedAt`;
  2. creates the new loan for the full requested principal, linked via `renewedFromLoanId`;
  3. posts one net WITHDRAWAL (`principal − payoff`) to the disbursement account;
  4. optionally stores the generated contract as a `CustomerDocument` tied to the new loan (new optional `CustomerDocument.loanId`);
  5. records a `loan.renewed` business event.
- Mora on a RENEWED loan is frozen at `closedAt`.
- Copilot: new DIRECT tool `openRenewalForm` → `RenewalFormCard` in the dock (quote, editable payoff, new terms, net to disburse, account, contract checkbox). A "Renovar" quick action on the loan search row opens it.
- Founder feed renders `loan.renewed`.
- ctl: `loans renew` fallback command.
- No new `mikro.json` keys — reuses `accounting.disbursementAccountId` / `disbursementAccounts`.

## Capabilities

### New Capabilities

- `loan-renewal`: quote, atomic renewal, RENEWED status semantics, ledger posting, feed event, ctl fallback.

### Modified Capabilities

- `founder-copilot`: adds "Renewal form card" requirement.
- `contract-generation`: a contract generated during renewal is stored tied to the new loan.
- `mora-accrual`: RENEWED loans stop accruing at `closedAt`.

## Impact

- Prisma: `LoanStatus.RENEWED`, `Loan.renewedFromLoanId`, `Loan.closedAt`, `CustomerDocument.loanId`; migration + integration `SCHEMA_SQL`.
- `mods/common`: loan schemas/types, business event catalog, copilot reply schema, `lateFee.ts`/snapshot freeze.
- `mods/apiserver`: `createGetRenewalQuote`, `createRenewLoan`, shared contract render helper, tRPC routes, copilot tool + dispatch + prompt.
- `mods/dashboard`: `RenewalFormCard` + stories, dock wiring, search-row action, feed visuals; e2e spec + seed.
- `mods/ctl`: `loans renew`.
- Manual status changes cannot set RENEWED (`updateLoanStatusStatusEnum` unchanged).
