## ADDED Requirements

### Requirement: Renewal contracts come from the renewal's terms

A contract generated during a renewal SHALL use the renewal's stored terms for the new loan and SHALL NOT include the amount owed on the old loan. The stored `CustomerDocument` SHALL be linked to the renewal while it is open and to the new loan once the renewal is finalized. Contracts generated outside renewal MAY leave `loanId` empty.

#### Scenario: Contract matches stored terms

- **WHEN** a renewal's contract is generated
- **THEN** its principal, installments and frequency equal the renewal's terms

#### Scenario: Contract tied to the new loan at finalize

- **WHEN** the renewal is finalized
- **THEN** the stored CONTRACT document has `loanId` equal to the new loan's id
