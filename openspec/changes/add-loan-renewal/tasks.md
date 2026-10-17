## 1. Schema

- [x] 1.1 `LoanStatus.RENEWED`; `Loan.renewedFromLoanId String? @unique` (self-relation), `Loan.closedAt DateTime?`; `CustomerDocument.loanId String?` (relation to Loan, SetNull)
- [x] 1.2 Prisma migration — hand-written ADD COLUMNs (Prisma's diff wanted a full `loans` table rebuild); verified zero drift vs schema
- [x] 1.3 Mirror in `test/integration/setup.ts` SCHEMA_SQL

## 2. Common

- [x] 2.1 `loanStatusEnum` + `Loan` type gain RENEWED (keep `updateLoanStatusStatusEnum` unchanged)
- [x] 2.2 `getRenewalQuoteSchema`, `renewLoanSchema` (+ refine payoff < principal); export through both barrels
- [x] 2.3 `loan.renewed` event type + payload schema + registry
- [x] 2.4 `renewalForm` on copilot reply schema
- [x] 2.5 Mora freeze for RENEWED at `closedAt` (lateFee + snapshot input plumbing + callers)

## 3. Apiserver

- [x] 3.1 Extract shared contract render helper from `createGenerateCustomerContract`
- [x] 3.2 `createGetRenewalQuote`
- [x] 3.3 `createRenewLoan` (single tx: guard+close, create, WITHDRAWAL, document, event)
- [x] 3.4 tRPC `getRenewalQuote` (query) + `renewLoan` (admin)
- [x] 3.5 Copilot `openRenewalForm` DIRECT tool, dispatch, TOOL_NOTES, system prompt
- [x] 3.6 Audit RENEWED through reports/tags/qcobro/listings — ACTIVE-only filters already exclude it; tags engine now skips RENEWED (else leftover balance → dpd tags); status labels added; `closed-loan-reconciled` rationale + generated collections spec updated

## 4. ctl

- [x] 4.1 `loans:renew` command

## 5. Dashboard

- [x] 5.1 `RenewalFormCard` + stories + fixtures
- [x] 5.2 Types + dock wiring (`handleRenewLoan`, saveFile, toast)
- [x] 5.3 "Renovar" action on prestamo search row
- [x] 5.4 Feed visuals/compact meta/narrative/subject link for `loan.renewed` (no filter change: the filter popup has no loan group today)

## 6. Tests

- [x] 6.1 Unit: `createRenewLoan` (golden, validation failure w/ no side effects, not ACTIVE, net ≤ 0, no contract)
- [x] 6.2 Unit: `createGetRenewalQuote`; lateFee RENEWED freeze; copilot tool binding
- [x] 6.3 Integration: real tx, account balance, double-renew refused, rollback when ledger post fails (contract path covered by unit only — no integration test renders PDFs today)
- [x] 6.4 E2E `e2e/renew.spec.ts`: seed loan (8/10 paid); search → Renovar → (copilotChat stubbed, no LLM in e2e) → real quote → renew → contract download → feed row. Full suite 11/11
- [x] 6.5 lint + typecheck + test green across workspaces (dashboard: `npm run typecheck` = `tsc -b`; bare `tsc --noEmit` checks nothing there)
