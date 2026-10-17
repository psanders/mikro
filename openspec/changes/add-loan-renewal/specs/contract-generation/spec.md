## ADDED Requirements

### Requirement: Renewal contracts are tied to the new loan

When a contract is generated as part of a loan renewal, the persisted `CustomerDocument` SHALL record the new loan's id in `loanId`, and the contract terms SHALL be the new loan's terms. Contracts generated outside renewal MAY leave `loanId` empty.

#### Scenario: Renewal contract carries loanId

- **WHEN** a renewal completes with the contract box checked
- **THEN** the stored CONTRACT document has `loanId` equal to the new loan's id
