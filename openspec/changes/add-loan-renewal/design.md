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

## Renewal as a process (amendment)

9. **`LoanRenewal` is its own entity**, not a `LoanApplication` kind. An application is applicant-shaped (session, score, WhatsApp intake, ad attribution) and its graph is review → decision → contract → convert. A renewal is anchored on an existing customer and loan, has no review step, and must be cancellable at any point. It reuses the *pattern*: a pure `evaluateRenewalTransition` shared by server and dashboard, optimistic `updateMany` transitions, read-time state joined onto feed events.
10. **Nothing touches loans or the ledger before finalize.** Start/edit/contract/upload/cancel only write the renewal (and its documents). Cancel therefore needs no reversal. Finalize is the old `renewLoan` transaction, driven by the stored terms.
11. **Owed amount is recomputed inside the finalize transaction** with `buildLoanSnapshotFromDb`. `net = round2(principal − (remainingBalance + moraAccrued))`. The caller sends the `confirmedNet` it saw; on mismatch the transaction rolls back with `NET_CHANGED` carrying the fresh quote. The owed amount never feeds contract text or loan terms — it only sets the WITHDRAWAL. The earlier "operator may edit the payoff" idea is dropped: the ledger records what is actually owed.
12. **Net must be positive.** If `principal ≤ owed`, start/edit-terms are rejected with a clear message (and finalize re-checks). One open renewal per old loan: partial unique index in the migration + a check in start; `renewedFromLoanId @unique` stays the loan-side guard.
13. **Terms edits invalidate the contract**: after any terms change the renewal returns to `DRAFT` and the stored contract is cleared; the signed copy must match the final terms.
14. **Documents attach by `renewalId`** (the new loan does not exist yet) and are re-pointed to the new loan at finalize. A cancelled renewal's documents stay on the customer, linked to the cancelled renewal.
15. **Feed**: renewal events (`loan.renewal.*`) get their live state joined at read time like `application.*`; the hard-coded `application.` prefix in the feed code is generalized, and reviewer scoping is extended so reviewers see renewal cards. `loan.renewed` is still emitted on completion for history.
16. **Search is one procedure for both roles.** Application matches use token-AND on first/last name and business name, digits-normalized phone, and cédula with or without dashes; only statuses with value are searchable (`SEARCHABLE_APPLICATION_STATUSES`: not DRAFT, not ABANDONED).
17. **Privilege widening is deliberate**: reviewers can see every customer, loan and document and edit customer data. Deleting a document stays admin-only. The copilot dock stays admin-only.

## Risks (amendment)

- Mora accrues daily, so `NET_CHANGED` will happen across a day boundary; the UI must make re-confirmation cheap.
- Accent-insensitive search is limited by SQLite `LIKE` (ASCII-only case folding); revisit with a normalized column if misses are reported.
- Application phones are free-form while customer phones are E.164; normalization must be centralised (`drPhoneDigits`).
