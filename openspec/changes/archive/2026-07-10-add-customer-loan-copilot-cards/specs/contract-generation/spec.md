## MODIFIED Requirements

### Requirement: Generate a loan contract from a customer plus supplied terms

The apiserver SHALL expose a founder-only `generateCustomerContract` procedure that renders a loan-contract PDF for an existing `Customer` merged with founder-supplied loan terms. Its input SHALL be `{ customerId, principal (positive), installments (positive integer), frequency ("DAILY"|"WEEKLY"|"BIWEEKLY"|"MONTHLY"), installmentAmount (positive), startDate }` with optional `maritalStatus` and `occupation` overrides, validated against a shared schema. The procedure SHALL resolve the debtor identity from the `Customer` row — `name`, `cedula` from `idNumber`, `city` from `homeAddress`, `occupation` from the override or `jobPosition` — set `contractDate` to the current date, render via the shared `renderContractPdf` generator (it MUST NOT reimplement contract rendering, and the rendered text MUST be gender-neutral: no field on the debtor drives grammatical gender agreement), persist the rendered PDF as a `CustomerDocument` (`type: CONTRACT`, `source: DIRECT`) owned by the customer, and return the PDF as `{ dataBase64, filename, mimeType }`. Generation SHALL NOT change any loan, customer, or application record beyond creating the `CustomerDocument`.

#### Scenario: Contract generated for an existing customer

- **WHEN** a founder invokes `generateCustomerContract` with a valid `customerId` and complete terms
- **THEN** a contract PDF is returned as base64 whose debtor name and cédula match the customer row, whose principal and terms match the input, and whose creditor/bank/notary come from the `mikro.json` contract config

#### Scenario: Generated contract is persisted as a customer document

- **WHEN** `generateCustomerContract` successfully renders a PDF for a customer
- **THEN** a `CustomerDocument` row is created for that customer with `type: CONTRACT`, `source: DIRECT`, and a sha256 matching the returned PDF bytes

#### Scenario: Identity is sourced from the customer, terms from the input

- **WHEN** the customer row has `homeAddress` and `jobPosition` and the input omits the `occupation` override
- **THEN** the contract's city is the customer's `homeAddress` and the occupation is the customer's `jobPosition`, while principal, installments, frequency, installment amount, and start date are taken from the input

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

## ADDED Requirements

### Requirement: Manual contract generation via ctl

The `ctl` command `customers:generateContract` SHALL let an operator invoke `generateCustomerContract` for a given customer by prompting for the same terms the loan form card collects, then save the returned PDF to a local output directory. This is a fallback for a loan created without the loan form card's contract checkbox, or a loan that predates it — not a replacement for the checkbox, and not a dashboard or copilot surface.

#### Scenario: Generating a contract from ctl saves a local PDF

- **WHEN** an operator runs `customers:generateContract <customerId>` with complete terms
- **THEN** `generateCustomerContract` is invoked, the customer document is persisted exactly as any other call would, and the returned PDF is additionally written to the output directory on disk

#### Scenario: Missing terms are prompted interactively

- **WHEN** an operator runs the command without all term flags supplied
- **THEN** the command prompts for each missing term before calling `generateCustomerContract`
