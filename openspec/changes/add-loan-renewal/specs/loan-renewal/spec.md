## ADDED Requirements

### Requirement: Renewal process

The system SHALL model a loan renewal as a `LoanRenewal` with status `DRAFT`, `CONTRACT_READY`, `SIGNED`, `COMPLETED` or `CANCELLED`. A renewal SHALL be started from an ACTIVE loan, SHALL hold the proposed terms of the new loan (principal, term length, payment amount, frequency, optional start date, nickname, mora rate), and SHALL NOT change any loan or ledger row until it is finalized. Only one non-terminal renewal MAY exist per old loan. Transitions SHALL be decided by a single pure function shared by the server and the dashboard.

#### Scenario: Start a renewal

- **WHEN** an admin or reviewer starts a renewal on an ACTIVE loan
- **THEN** a `DRAFT` renewal exists with default terms, no loan changed, no ledger row posted, and a `loan.renewal.started` event is recorded

#### Scenario: Second open renewal rejected

- **WHEN** a renewal is started for a loan that already has a non-terminal renewal
- **THEN** the request fails with a conflict error and no second renewal is created

#### Scenario: Start on a closed loan rejected

- **WHEN** the loan is COMPLETED, DEFAULTED, CANCELLED or RENEWED
- **THEN** the request fails with a precondition error

### Requirement: Renewal quote

The system SHALL expose a quote for a renewal returning the old loan's snapshot `remainingBalance`, net accrued mora, `owed = remainingBalance + moraAccrued`, the renewal's principal and `net = principal − owed`. Start and edit-terms SHALL reject terms whose `net` is zero or negative.

#### Scenario: Quote for a partly paid loan

- **WHEN** a quote is requested for a renewal whose old loan has 2,300 remaining and 200 mora, with a 10,000 principal
- **THEN** it returns owed 2,500 and net 7,500

#### Scenario: Non-positive net rejected

- **WHEN** the proposed principal is less than or equal to what is owed
- **THEN** start or edit-terms fails with a validation error naming the amount owed

### Requirement: Editing terms

Terms SHALL be editable while the renewal is `DRAFT`, `CONTRACT_READY` or `SIGNED`. Any terms change SHALL clear the generated contract and any signed contract and return the renewal to `DRAFT`.

#### Scenario: Terms change invalidates the contract

- **WHEN** terms are edited on a `CONTRACT_READY` renewal
- **THEN** the renewal returns to `DRAFT` and the stored contract is cleared

### Requirement: Contract and documents

The system SHALL generate the new loan's contract from the renewal's stored terms (never from the amount owed) and move the renewal to `CONTRACT_READY`. It SHALL accept an uploaded signed contract (PDF only), which moves the renewal to `SIGNED`, and additional documents (images or PDF) of any status before completion. Documents SHALL be linked to the renewal until finalize.

#### Scenario: Generate contract

- **WHEN** a `DRAFT` renewal's contract is generated
- **THEN** a PDF is returned and stored, the renewal is `CONTRACT_READY`, and the PDF shows the new loan's terms without the amount owed on the old loan

#### Scenario: Signed contract must be a PDF

- **WHEN** a non-PDF file is uploaded as the signed contract
- **THEN** the upload is rejected

### Requirement: Cancel

A renewal SHALL be cancellable by an admin or reviewer at any status before `COMPLETED`. Cancelling SHALL NOT alter the old loan, create a loan, or touch the ledger, and SHALL free the old loan for a new renewal.

#### Scenario: Cancel mid-process

- **WHEN** a `SIGNED` renewal is cancelled
- **THEN** it is `CANCELLED`, the old loan is still ACTIVE, no ledger row exists for it, and a `loan.renewal.cancelled` event is recorded

#### Scenario: Cannot cancel a completed renewal

- **WHEN** a `COMPLETED` renewal is cancelled
- **THEN** the request fails with a precondition error

### Requirement: Finalize

Finalizing SHALL require a `SIGNED` renewal (a signed contract or additional documents uploaded) and the caller's `confirmedNet`. In a single database transaction it SHALL:

1. move the renewal to `COMPLETED` only if it is still in the expected status;
2. recompute what is owed from the old loan's live snapshot and `net = round2(principal − owed)`;
3. fail with `NET_CHANGED` (writing nothing) when `net` differs from `confirmedNet`;
4. set the old loan `RENEWED` with `closedAt`, only if it is still ACTIVE;
5. create the new loan from the renewal's stored terms, `renewedFromLoanId` pointing to the old loan;
6. post one WITHDRAWAL of `net` to the resolved disbursement account;
7. attach the renewal's documents and contract to the new loan;
8. record `loan.renewal.completed` (and no separate `loan.renewed`, which would show as a second card for the same renewal; `loan.renewed` remains only on rows from the earlier one-step flow).

If any step fails, none of the writes SHALL persist. The ledger SHALL record only `net`; the amount owed SHALL NOT alter the new loan's terms.

#### Scenario: Golden path with a balance owed

- **WHEN** a reviewer finalizes a renewal of 10,000 on a loan that still owes 2,500
- **THEN** the old loan is RENEWED with closedAt, a new ACTIVE loan exists with renewedFromLoanId set, one WITHDRAWAL of 7,500 is posted, the documents are attached to the new loan, and the feed shows the completion

#### Scenario: Owed amount moved since the card showed it

- **WHEN** a day of mora accrues between the last quote and finalize, so `net` differs from `confirmedNet`
- **THEN** finalize fails with `NET_CHANGED` carrying the new quote, nothing is written, and finalizing again with the new `confirmedNet` succeeds

#### Scenario: Old loan no longer ACTIVE

- **WHEN** the old loan was closed between start and finalize
- **THEN** finalize fails with a conflict error and nothing is written

#### Scenario: Concurrent finalize

- **WHEN** two finalize calls race on the same renewal
- **THEN** exactly one succeeds and the other fails with a conflict error

### Requirement: RENEWED status semantics

`RENEWED` SHALL mean the loan was closed by being rolled into a newer loan; it MAY carry a remaining balance. It SHALL NOT be settable through `updateLoanStatus`. RENEWED loans SHALL be excluded from default active-loan listings, collection balances and renewal-candidate reports, and SHALL NOT fail the `closed-loan-reconciled` health check.

#### Scenario: Manual status change cannot produce RENEWED

- **WHEN** someone calls `updateLoanStatus` with status RENEWED
- **THEN** the request fails validation

### Requirement: Renewal feed card

Each renewal SHALL appear as one card in the founder feed at its newest event, showing its live status, customer, old loan, new terms and the last quoted net. The card SHALL offer actions according to status and the viewer's role (open the renewal, cancel), and SHALL be visible to admins and reviewers. Renewal events SHALL carry the renewal, loan and customer ids. Completion SHALL record a `loan.renewal.completed` event carrying old and new loan ids, new principal, owed, net disbursed and account name.

#### Scenario: Reviewer sees the card

- **WHEN** a reviewer starts a renewal
- **THEN** a renewal card appears in their feed with the DRAFT status and an open action

#### Scenario: Card follows the live status

- **WHEN** the renewal is cancelled
- **THEN** the same card shows CANCELLED with no further actions, not a second card

### Requirement: Roles

Admins and reviewers SHALL both be able to start, edit, generate the contract for, upload documents to, cancel and finalize a renewal. Other users SHALL be rejected.

#### Scenario: Reviewer finalizes

- **WHEN** a reviewer finalizes a signed renewal
- **THEN** it succeeds, including the ledger posting

#### Scenario: Collector rejected

- **WHEN** a collector calls any renewal procedure
- **THEN** the request fails with a forbidden error

### Requirement: Renewal via ctl

The `ctl` SHALL provide `loans:renew` to start a renewal for a loan (showing the quote and printing the renewal id), and subcommands to cancel and finalize it.

#### Scenario: ctl starts a renewal

- **WHEN** an operator runs `loans:renew` for an ACTIVE loan
- **THEN** a DRAFT renewal is created and its id and quote are printed
