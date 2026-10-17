## Context

Renewal = close loan A with a balance, open loan B for customer of A, hand over cash `B.principal − payoff(A)`. Precedent for an atomic multi-write with ledger posting: `createConvertApplication.ts` (loan + WITHDRAWAL via `postTransactionCore` in one `$transaction`).

## Decisions

1. **RENEWED status, not a synthetic payoff payment.** A fake INSTALLMENT payment for the payoff would be picked up by the daily close as a cash DEPOSIT that never happened. A distinct status keeps cash reports honest and makes "closed by renewal" queryable. The `closed-loan-reconciled` check only inspects COMPLETED, so RENEWED loans (which legitimately carry a balance) pass without change.
2. **Net WITHDRAWAL.** Only `principal − payoff` leaves the account. One ledger row, `reference: loan-renewal:<newLoanId>`, description names both loans and the payoff. Rejected if net ≤ 0.
3. **Payoff = `remainingBalance + moraAccrued (net)` from `buildLoanSnapshotFromDb`**, suggested by the quote; the operator may edit it in the form (negotiated discounts happen). The submitted payoff is what is recorded (event + ledger description).
4. **`closedAt` column**, not `updatedAt`, as the mora freeze anchor — `updatedAt` moves on any later edit (nickname, notes relation, etc.).
5. **Contract rendered before the transaction**, file saved by sha256 (idempotent content-addressed), DB row inserted inside the transaction. A failed transaction leaves at most an orphaned file, never an orphaned row. Rendering is extracted from `createGenerateCustomerContract` into a shared helper.
6. **Event written in-transaction via `recordEvent(tx, …)`**, not `.meta({event})`, so the feed never shows a renewal that rolled back.
7. **Race guard**: inside the tx, `updateMany({ where: { id, status: "ACTIVE" } })` must affect exactly 1 row, otherwise CONFLICT.
8. **Entry point**: copilot DIRECT tool + form card (same pattern as `openLoanForm`); the card calls `renewLoan` directly, off the LLM loop.

## Risks

- `loanId` allocation (`findFirst desc + 1`) is not concurrency-safe; same as today's `createLoan`, unique constraint makes a collision fail loudly. Not addressed here.
- Old loans renewed by hand before this ships stay COMPLETED with a balance; unchanged.
