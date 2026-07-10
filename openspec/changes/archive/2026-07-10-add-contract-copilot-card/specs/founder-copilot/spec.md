## ADDED Requirements

### Requirement: Contract form card

The copilot tool policy SHALL bind an `openContractForm` direct tool that the model calls when the founder asks to generate a loan contract (e.g. "generá un contrato", "necesito un contrato para …"). Executing the tool SHALL NOT generate anything: it returns a `contractForm` payload on the chat reply (a new reply field alongside `pendingAction`/`createdRule`), optionally seeded with a customer hint the founder named. The dock SHALL render this as a new `contractForm` thread-item kind — an interactive form card distinct from the verbatim `pendingAction` confirm card — with a customer picker, a gender control, term inputs (principal, installments, frequency, installment amount, start date), optional marital-status / occupation overrides, and a generate control.

#### Scenario: Asking for a contract opens the form card

- **WHEN** an admin asks the copilot to generate a contract
- **THEN** the copilot replies with a short acknowledgement and the dock renders an interactive contract form card, and no contract is generated yet

#### Scenario: Form card is editable, unlike the confirm card

- **WHEN** the contract form card is shown
- **THEN** the founder can edit every field and pick a customer, rather than only confirming or rejecting pre-filled arguments

### Requirement: Customer search for the form picker

The copilot tool policy SHALL bind a `searchCustomers` read tool that resolves customers by name or phone, returning a bounded list of `{ id, name, phone, idNumber }`, so the contract form card's picker can search as the founder types and the model can answer "do you have customer X?" questions. The same search SHALL be reachable by the dashboard for the picker.

#### Scenario: Search returns matching customers

- **WHEN** the picker (or the copilot) searches customers by a partial name or phone
- **THEN** a bounded list of matching customers with their id, name, phone, and cédula is returned

#### Scenario: No match returns an empty result

- **WHEN** the search matches no customer
- **THEN** an empty list is returned rather than an error

### Requirement: Contract generation runs off the LLM loop

Generating the contract SHALL be performed by the founder-only `generateCustomerContract` procedure invoked directly by the form card's generate control — never by the LLM tool loop. On success the dock SHALL download the returned PDF inline. The copilot model SHALL be able only to open an empty form; it SHALL NOT collect the terms itself nor execute generation.

#### Scenario: Generate downloads the PDF

- **WHEN** the founder completes the form card and clicks generate
- **THEN** the card calls `generateCustomerContract`, and on success the PDF is downloaded in the browser

#### Scenario: The model never generates the contract

- **WHEN** the copilot processes the founder's contract request
- **THEN** the only contract-related tool it can call is `openContractForm`; it has no tool that renders or returns the PDF
