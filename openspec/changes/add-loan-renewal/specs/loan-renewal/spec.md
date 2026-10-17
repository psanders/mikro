## ADDED Requirements

### Requirement: Renewal quote

The system SHALL expose a `getRenewalQuote` query that, given an ACTIVE loan's `loanId`, returns the loan's current terms, its customer, the canonical snapshot `remainingBalance`, the net accrued mora, and `suggestedPayoff = remainingBalance + moraAccrued`. The query SHALL reject loans that are not ACTIVE.

#### Scenario: Quote for a partly paid loan

- **WHEN** a quote is requested for an ACTIVE loan with 10 cuotas of 1,300 and 10,400 paid and 200 mora owed
- **THEN** the quote returns remainingBalance 2,600, moraAccrued 200 and suggestedPayoff 2,800

#### Scenario: Quote for a closed loan is rejected

- **WHEN** a quote is requested for a loan that is COMPLETED, DEFAULTED, CANCELLED or RENEWED
- **THEN** the request fails with a precondition error and nothing is returned

### Requirement: Atomic renewal

The system SHALL expose an admin-only `renewLoan` mutation taking the old `loanId`, a `payoffAmount`, the new loan's terms (principal, term length, payment amount, frequency, optional start date, nickname, mora rate), an optional disbursement account, and a `generateContract` flag. In a single database transaction it SHALL:

1. set the old loan's status to `RENEWED` and its `closedAt` to now, only if it is still ACTIVE;
2. create the new loan for the same customer with the full principal and `renewedFromLoanId` pointing to the old loan;
3. post one WITHDRAWAL of `principal − payoffAmount` to the resolved disbursement account;
4. when `generateContract` is set, store the contract as a `CustomerDocument` (CONTRACT, DIRECT) with `loanId` set to the new loan;
5. record a `loan.renewed` business event.

If any step fails, none of the writes SHALL persist.

#### Scenario: Golden path

- **WHEN** an admin renews loan 10034 (payoff 2,800) into a 10,000 principal loan with the contract box checked
- **THEN** loan 10034 is RENEWED with closedAt set, a new ACTIVE loan exists with renewedFromLoanId = 10034's id, the disbursement account balance drops by 7,200, a CONTRACT document tied to the new loan exists, a `loan.renewed` event is recorded, and the response includes the contract PDF

#### Scenario: Payoff not less than principal

- **WHEN** `payoffAmount` is greater than or equal to the new principal
- **THEN** the mutation fails with a validation error and nothing is written

#### Scenario: Old loan no longer ACTIVE

- **WHEN** the old loan was closed between quote and submit
- **THEN** the mutation fails with a conflict error and nothing is written

#### Scenario: Contract box unchecked

- **WHEN** `generateContract` is false
- **THEN** the renewal completes without a contract document and the response has no contract

### Requirement: RENEWED status semantics

`RENEWED` SHALL mean the loan was closed by being rolled into a newer loan; it MAY carry a remaining balance. It SHALL NOT be settable through `updateLoanStatus`. RENEWED loans SHALL be excluded from default active-loan listings, collection balances and renewal-candidate reports, and SHALL NOT fail the `closed-loan-reconciled` health check.

#### Scenario: Manual status change cannot produce RENEWED

- **WHEN** someone calls `updateLoanStatus` with status RENEWED
- **THEN** the request fails validation

### Requirement: Renewal feed event

A `loan.renewed` event SHALL carry the old and new loan ids, customer name, new principal, payoff, net disbursed amount, account name and, when generated, the contract filename. The founder feed SHALL render it with a narrative naming both loans and the net amount.

#### Scenario: Feed shows the renewal

- **WHEN** a renewal is completed
- **THEN** the feed shows one row like "X renovó el préstamo #10034 → #10051 · desembolso RD$7,200"

### Requirement: Renewal via ctl

The `ctl` SHALL provide a `loans:renew` command that prompts for the old loan, shows the quote, collects payoff and new terms, calls `renewLoan`, and writes the contract PDF locally when generated.

#### Scenario: ctl renewal

- **WHEN** an operator runs `loans:renew` and confirms
- **THEN** the same atomic renewal runs and the PDF is written to the output path
