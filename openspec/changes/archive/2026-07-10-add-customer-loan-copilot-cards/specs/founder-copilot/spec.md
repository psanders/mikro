## ADDED Requirements

### Requirement: Customer form card

The copilot tool policy SHALL bind an `openCustomerForm` direct tool that the model calls when the founder asks to create a new customer (e.g. "creá un cliente nuevo", "agregá un cliente"). Executing the tool SHALL NOT create anything: it returns a `customerForm` payload on the chat reply (a new reply field alongside `pendingAction`/`createdRule`). The dock SHALL render this as a new `customerForm` thread-item kind — an interactive form card distinct from the verbatim `pendingAction` confirm card — with inputs for every `createCustomer` field (name, phone, cédula, home address, assigned collector required; nickname, collection point, job position, income, business-owner flag, notes, preferred payment day optional) and a create control. `createCustomer` SHALL remain reachable as a write tool with the confirm-card path as a fallback.

#### Scenario: Asking to create a customer opens the form card

- **WHEN** an admin asks the copilot to create a new customer
- **THEN** the copilot replies with a short acknowledgement and the dock renders an interactive customer form card, and no customer is created yet

#### Scenario: Form card is editable, unlike the confirm card

- **WHEN** the customer form card is shown
- **THEN** the founder can edit every field before submitting, rather than only confirming or rejecting pre-filled arguments

#### Scenario: Customer creation runs off the LLM loop

- **WHEN** the founder completes the form card and clicks create
- **THEN** the card calls `createCustomer` directly; the model never executes the creation itself

### Requirement: Loan form card

The copilot tool policy SHALL bind an `openLoanForm` direct tool that the model calls when the founder asks to create a new loan for an existing customer (e.g. "creá un préstamo para Enersida", "necesito abrir un préstamo"). Executing the tool SHALL NOT create anything: it returns a `loanForm` payload on the chat reply, optionally seeded with a customer hint the founder named. The dock SHALL render this as a new `loanForm` thread-item kind with a customer picker (reusing the `searchCustomers` read tool), inputs for every `createLoan` field (customer, principal, term length, payment amount, payment frequency required; starting date, nickname, type, mora rate optional), a "generar contrato con estos términos" checkbox (checked by default), and a create control. `createLoan` SHALL remain reachable as a write tool with the confirm-card path as a fallback. The contract text rendered by `generateCustomerContract` is gender-neutral, so the card collects no gender field.

#### Scenario: Asking to create a loan opens the form card

- **WHEN** an admin asks the copilot to create a loan
- **THEN** the copilot replies with a short acknowledgement and the dock renders an interactive loan form card, and no loan is created yet

#### Scenario: Form card is editable, unlike the confirm card

- **WHEN** the loan form card is shown
- **THEN** the founder can pick the customer and edit every term before submitting, rather than only confirming or rejecting pre-filled arguments

#### Scenario: Loan creation runs off the LLM loop

- **WHEN** the founder completes the form card and clicks create
- **THEN** the card calls `createLoan` directly; the model never executes the creation itself

#### Scenario: Checked box also generates a contract, in the same submit

- **WHEN** the founder submits the loan form card with the contract checkbox checked (the default)
- **THEN** the card calls `createLoan` and then `generateCustomerContract` with the same submitted terms, as one flow with no second step

#### Scenario: Unchecked box creates the loan only

- **WHEN** the founder unchecks the contract checkbox before submitting
- **THEN** only `createLoan` is called; no contract is generated

## MODIFIED Requirements

### Requirement: Customer search for the form picker

The copilot tool policy SHALL bind a `searchCustomers` read tool that resolves customers by name or phone, returning a bounded list of `{ id, name, phone, idNumber }`, so a copilot form card's picker (e.g. the loan form card) can search as the founder types and the model can answer "do you have customer X?" questions. The same search SHALL be reachable by the dashboard for the picker.

#### Scenario: Search returns matching customers

- **WHEN** the picker (or the copilot) searches customers by a partial name or phone
- **THEN** a bounded list of matching customers with their id, name, phone, and cédula is returned

#### Scenario: No match returns an empty result

- **WHEN** the search matches no customer
- **THEN** an empty list is returned rather than an error

## REMOVED Requirements

### Requirement: Contract form card

**Reason**: Retired in favor of generating a contract as an optional, checked-by-default step of the loan form card's single submit (see the new "Loan form card" requirement) — a standalone ad-hoc "generate a contract without creating a loan" flow added avoidable UI/decision surface for a case that, in practice, always accompanies a loan.

**Migration**: None for existing loans — `generateCustomerContract` is unchanged and still callable. A founder who needs a contract for a loan that predates this flow (or was created with the checkbox unchecked) uses the new `ctl customers:generateContract` fallback command instead of a copilot card.

### Requirement: Contract generation runs off the LLM loop

**Reason**: This requirement documented the retired standalone contract form card specifically. The same guarantee (the model never executes generation itself) now applies to the loan form card's checkbox-triggered generation, covered by the "Loan form card" requirement's scenarios above.

**Migration**: None.
