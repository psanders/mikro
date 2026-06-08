## ADDED Requirements

### Requirement: Convert a signed application into a Customer and Loan

A reviewer (ADMIN or REVIEWER) SHALL be able to convert a `SIGNED` application into a `Customer` + `Loan` using operator-supplied loan terms, atomically, setting the application to `CONVERTED` and linking the created records.

#### Scenario: Conversion creates customer and loan

- **WHEN** a reviewer converts a `SIGNED` application with loan terms (principal, term, payment amount, frequency)
- **THEN** a `Loan` is created with those terms, a `Customer` exists for the applicant, and the application's `customerId`/`loanId` are set and status becomes `CONVERTED`

#### Scenario: Conversion is atomic

- **WHEN** loan creation fails during conversion (e.g. invalid terms)
- **THEN** no `Customer` or `Loan` is left created and the application stays `SIGNED`

#### Scenario: Converting an unsigned application is rejected

- **WHEN** a reviewer converts an application that is not `SIGNED`
- **THEN** the request fails with an error naming the current and attempted status

#### Scenario: Double conversion is blocked

- **WHEN** a reviewer converts an application that already has `customerId`/`loanId` set
- **THEN** the request fails (already converted)

#### Scenario: Invalid applicant data blocks conversion

- **WHEN** the application's `idNumber` is not in cédula format `000-0000000-0`
- **THEN** the request fails with an error identifying the field to fix

### Requirement: Returning borrowers reuse the existing customer

Conversion SHALL match an existing `Customer` by `idNumber` (cédula), falling back to `phone`; if found, the new `Loan` is attached to that customer rather than creating a duplicate.

#### Scenario: Existing customer reused

- **WHEN** converting an application whose cédula matches an existing customer
- **THEN** no new customer is created and the new loan is attached to the existing customer; the application links to that `customerId`

#### Scenario: New customer created when no match

- **WHEN** converting an application with no matching customer by cédula or phone
- **THEN** a new `Customer` is created from the application's stable fields (name, phone, idNumber, homeAddress, isBusinessOwner)

### Requirement: Conversion is restricted to reviewers

Conversion SHALL be restricted to callers whose roles include `ADMIN` or `REVIEWER`.

#### Scenario: Non-reviewer is forbidden

- **WHEN** an authenticated user without `ADMIN` or `REVIEWER` invokes conversion
- **THEN** the request is rejected as forbidden
