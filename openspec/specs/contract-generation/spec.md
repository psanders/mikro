# contract-generation Specification

## Purpose

On-demand loan-contract generation from the founder app: render a loan-contract PDF for an existing customer merged with founder-supplied gender and terms, via the shared renderer, returning it for download and recording a Founder-feed event. Read-only with respect to business data — produces a document, changes no loan/customer/application records.

## Requirements

### Requirement: Generate a loan contract from a customer plus supplied terms

The apiserver SHALL expose a founder-only `generateCustomerContract` procedure that renders a loan-contract PDF for an existing `Customer` merged with founder-supplied gender and loan terms. Its input SHALL be `{ customerId, gender ("M"|"F"), principal (positive), installments (positive integer), frequency ("DAILY"|"WEEKLY"|"BIWEEKLY"|"MONTHLY"), installmentAmount (positive), startDate }` with optional `maritalStatus` and `occupation` overrides, validated against a shared schema. The procedure SHALL resolve the debtor identity from the `Customer` row — `name`, `cedula` from `idNumber`, `city` from `homeAddress`, `occupation` from the override or `jobPosition` — set `contractDate` to the current date, render via the shared `renderContractPdf` generator (it MUST NOT reimplement contract rendering), and return the PDF as `{ dataBase64, filename, mimeType }`. Generation SHALL persist no PDF bytes and SHALL NOT change any loan, customer, or application record.

#### Scenario: Contract generated for an existing customer

- **WHEN** a founder invokes `generateCustomerContract` with a valid `customerId` and complete terms
- **THEN** a contract PDF is returned as base64 whose debtor name and cédula match the customer row, whose principal and terms match the input, and whose creditor/bank/notary come from the `mikro.json` contract config

#### Scenario: Identity is sourced from the customer, terms from the input

- **WHEN** the customer row has `homeAddress` and `jobPosition` and the input omits the `occupation` override
- **THEN** the contract's city is the customer's `homeAddress` and the occupation is the customer's `jobPosition`, while gender, principal, installments, frequency, installment amount, and start date are taken from the input

#### Scenario: Occupation override takes precedence

- **WHEN** the input supplies an `occupation` override
- **THEN** the contract uses the override verbatim rather than the customer's `jobPosition`

#### Scenario: Unknown customer is rejected

- **WHEN** `generateCustomerContract` is called with a `customerId` matching no `Customer`
- **THEN** the request fails with a not-found error and no PDF is produced

#### Scenario: Customer missing required identity is rejected

- **WHEN** the referenced customer lacks a name or `idNumber`
- **THEN** the request fails with a structured validation error naming the missing field and no PDF is produced

#### Scenario: Invalid terms are rejected before rendering

- **WHEN** the input carries a non-positive principal, a non-positive installment count, or an unsupported frequency
- **THEN** a structured validation error is returned and the generator is never invoked

### Requirement: Generation is restricted to founders

The `generateCustomerContract` procedure SHALL be restricted to authenticated ADMIN users; other callers SHALL be rejected as forbidden.

#### Scenario: Non-admin is forbidden

- **WHEN** an authenticated non-ADMIN user invokes `generateCustomerContract`
- **THEN** the request is rejected with an authorization error and no PDF is produced

### Requirement: Generation records a Founder-feed business event

On a successful render, the procedure SHALL record a `contract.generated` business event carrying `{ customerId, customerName, principal, installments, frequency, installmentAmount, startDate }` and the acting founder — never the PDF bytes — so the action is a durable record in the Founder feed. The event SHALL be written after the render succeeds, following the event-log convention: an event-write failure SHALL be logged without failing the request, and no event SHALL be written when generation failed.

#### Scenario: Successful generation is evented

- **WHEN** a founder generates a contract for a customer
- **THEN** a `contract.generated` event referencing that customer and the supplied terms appears in the feed, and the event payload contains no PDF bytes

#### Scenario: Failed generation writes no event

- **WHEN** generation fails validation or the customer is not found
- **THEN** no `contract.generated` event is recorded
