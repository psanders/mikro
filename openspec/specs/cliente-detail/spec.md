# cliente-detail Specification

## Purpose

TBD - created by archiving change add-clientes-dashboard. Update Purpose after archive.

## Requirements

### Requirement: Customer detail screen

The dashboard SHALL provide a `/clientes/:id` screen that fetches a customer via `getCustomer` (id from the route) and presents it as a two-column layout per Pencil v2 frame `hvr34`: a flat content card with labeled sections (Datos del cliente, Relaciones y asignación, Préstamos, Pagos recientes, Notas) and a 360px rail (financial summary + inline "Registrar pago"). Fields are drawn from what the procedure returns on `Customer`: nickname, phone, cédula (`idNumber`), home address, collection point, job position, income, business-owner flag, ID-card-on-record flag, preferred payment day, notes, and the assigned collector / creator (resolved to names via `listUsers`). Status (loan/customer) renders as plain text, not chips. The screen MUST render only fields the procedure returns and MUST NOT fabricate values for absent data; rail figures are limited to reliable client-side aggregates (total prestado, total pagado, préstamos activos, en-mora flag) — no invented balances or schedules.

#### Scenario: Register a payment from the rail

- **WHEN** the customer has an ACTIVE loan and the operator submits the rail "Registrar pago" form
- **THEN** `createPayment` is called with the active loan's `loanId`, the entered amount/method/notes, and the current user as `collectedById`, and the loans/payments refresh

#### Scenario: Detail loads and renders

- **WHEN** an authenticated operator navigates to `/clientes/:id`
- **THEN** the customer is fetched via `getCustomer` and the header plus contact/identity fields are rendered

#### Scenario: Loading, error, not-found states

- **WHEN** the query is loading, fails, or returns no customer for the id
- **THEN** the screen shows a loading indicator, an error message, or a not-found state respectively

#### Scenario: Absent optional fields are handled

- **WHEN** an optional field (e.g. nickname, income, notes) is null on the returned customer
- **THEN** that field is omitted or shown as empty rather than rendering a placeholder value

### Requirement: Customer loans

The detail screen SHALL show the customer's loans by calling `listLoansByCustomer` with the customer id, rendering one row per loan from the returned fields.

#### Scenario: Loans render

- **WHEN** the customer has loans
- **THEN** `listLoansByCustomer` is queried and each loan is shown as a row

#### Scenario: No loans

- **WHEN** the customer has no loans
- **THEN** an empty-state for loans is shown

### Requirement: Recent payments

The detail screen SHALL show the customer's recent payments by calling `listPaymentsByCustomer` with the customer id, rendering the returned payments.

#### Scenario: Payments render

- **WHEN** the customer has payments
- **THEN** `listPaymentsByCustomer` is queried and recent payments are shown

#### Scenario: No payments

- **WHEN** the customer has no payments
- **THEN** an empty-state for payments is shown
