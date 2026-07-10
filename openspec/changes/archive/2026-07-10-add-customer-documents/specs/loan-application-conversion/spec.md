## MODIFIED Requirements

### Requirement: Convert a signed application into a Customer and Loan

A reviewer (ADMIN or REVIEWER) SHALL be able to convert a `SIGNED` application into a `Customer` + `Loan` using operator-supplied loan terms, atomically, setting the application to `CONVERTED` and linking the created records. As part of the same atomic operation, any documents already stored on the application (signed contract, ID front/back images) SHALL be copied — by reference to their existing sha256-keyed files, without moving or duplicating bytes and without modifying the application's own document columns — into `CustomerDocument` records (`source: MIGRATED_FROM_APPLICATION`) owned by the resulting customer.

#### Scenario: Conversion creates customer and loan

- **WHEN** a reviewer converts a `SIGNED` application with loan terms (principal, term, payment amount, frequency)
- **THEN** a `Loan` is created with those terms, a `Customer` exists for the applicant, and the application's `customerId`/`loanId` are set and status becomes `CONVERTED`

#### Scenario: Conversion is atomic

- **WHEN** loan creation fails during conversion (e.g. invalid terms)
- **THEN** no `Customer` or `Loan` is left created and the application stays `SIGNED`, and no `CustomerDocument` rows are created

#### Scenario: Converting an unsigned application is rejected

- **WHEN** a reviewer converts an application that is not `SIGNED`
- **THEN** the request fails with an error naming the current and attempted status

#### Scenario: Double conversion is blocked

- **WHEN** a reviewer converts an application that already has `customerId`/`loanId` set
- **THEN** the request fails (already converted)

#### Scenario: Invalid applicant data blocks conversion

- **WHEN** the application's `idNumber` is not in cédula format `000-0000000-0`
- **THEN** the request fails with an error identifying the field to fix

#### Scenario: Application's stored documents are migrated to the customer

- **WHEN** a reviewer converts a `SIGNED` application that has a stored signed contract and ID front/back images
- **THEN** the resulting customer has 3 `CustomerDocument` rows (`CONTRACT`, `ID_FRONT`, `ID_BACK`, each `source: MIGRATED_FROM_APPLICATION`) referencing the same files already on disk, and the application's own `contract*`/`idFront*`/`idBack*` columns and files are unchanged

#### Scenario: Conversion with no stored documents migrates nothing

- **WHEN** a reviewer converts a `SIGNED` application that has no signed contract or ID images stored
- **THEN** conversion succeeds as before and no `CustomerDocument` rows are created

#### Scenario: Reviewer application view is unaffected

- **WHEN** an application is converted and its documents are migrated to the customer
- **THEN** the reviewer mobile app's application detail screen continues to show the application's own contract/ID documents exactly as before conversion

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
