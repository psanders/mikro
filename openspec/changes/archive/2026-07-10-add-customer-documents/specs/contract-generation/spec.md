## MODIFIED Requirements

### Requirement: Generate a loan contract from a customer plus supplied terms

The apiserver SHALL expose a founder-only `generateCustomerContract` procedure that renders a loan-contract PDF for an existing `Customer` merged with founder-supplied gender and loan terms. Its input SHALL be `{ customerId, gender ("M"|"F"), principal (positive), installments (positive integer), frequency ("DAILY"|"WEEKLY"|"BIWEEKLY"|"MONTHLY"), installmentAmount (positive), startDate }` with optional `maritalStatus` and `occupation` overrides, validated against a shared schema. The procedure SHALL resolve the debtor identity from the `Customer` row — `name`, `cedula` from `idNumber`, `city` from `homeAddress`, `occupation` from the override or `jobPosition` — set `contractDate` to the current date, render via the shared `renderContractPdf` generator (it MUST NOT reimplement contract rendering), persist the rendered PDF as a `CustomerDocument` (`type: CONTRACT`, `source: DIRECT`) owned by the customer, and return the PDF as `{ dataBase64, filename, mimeType }`. Generation SHALL NOT change any loan, customer, or application record beyond creating the `CustomerDocument`.

#### Scenario: Contract generated for an existing customer

- **WHEN** a founder invokes `generateCustomerContract` with a valid `customerId` and complete terms
- **THEN** a contract PDF is returned as base64 whose debtor name and cédula match the customer row, whose principal and terms match the input, and whose creditor/bank/notary come from the `mikro.json` contract config

#### Scenario: Generated contract is persisted as a customer document

- **WHEN** `generateCustomerContract` successfully renders a PDF for a customer
- **THEN** a `CustomerDocument` row is created for that customer with `type: CONTRACT`, `source: DIRECT`, and a sha256 matching the returned PDF bytes

#### Scenario: Identity is sourced from the customer, terms from the input

- **WHEN** the customer row has `homeAddress` and `jobPosition` and the input omits the `occupation` override
- **THEN** the contract's city is the customer's `homeAddress` and the occupation is the customer's `jobPosition`, while gender, principal, installments, frequency, installment amount, and start date are taken from the input

#### Scenario: Occupation override takes precedence

- **WHEN** the input supplies an `occupation` override
- **THEN** the contract uses the override verbatim rather than the customer's `jobPosition`

#### Scenario: Unknown customer is rejected

- **WHEN** `generateCustomerContract` is called with a `customerId` matching no `Customer`
- **THEN** the request fails with a not-found error and no PDF is produced, and no `CustomerDocument` is created

#### Scenario: Customer missing required identity is rejected

- **WHEN** the referenced customer lacks a name or `idNumber`
- **THEN** the request fails with a structured validation error naming the missing field and no PDF is produced, and no `CustomerDocument` is created

#### Scenario: Invalid terms are rejected before rendering

- **WHEN** the input carries a non-positive principal, a non-positive installment count, or an unsupported frequency
- **THEN** a structured validation error is returned, the generator is never invoked, and no `CustomerDocument` is created
