## ADDED Requirements

### Requirement: Renewal form card

The copilot tool policy SHALL bind an `openRenewalForm` direct tool, optionally seeded with a loan hint, that the model calls when the founder asks to renew a loan (e.g. "renueva el préstamo 10034"). Executing the tool SHALL NOT write anything; it returns a `renewalForm` payload. The dock SHALL render a renewal form card that loads the renewal quote, shows remaining balance, mora and an editable payoff, collects the new loan terms, shows the net amount to disburse (principal − payoff), lets the founder pick the disbursement account, and has a "generar contrato con estos términos" checkbox checked by default. Submitting SHALL call `renewLoan` directly, off the LLM loop, and on success save the contract PDF when one was returned. The prestamo row in search results SHALL offer a "Renovar" action, only for ACTIVE loans, that opens the copilot with a renewal request for that loan prefilled (the same prefill-then-send pattern as "Ver préstamo").

#### Scenario: Asking to renew opens the card

- **WHEN** an admin asks the copilot to renew a loan
- **THEN** the dock renders the renewal form card and nothing is written yet

#### Scenario: Net amount guards submit

- **WHEN** the payoff is greater than or equal to the new principal
- **THEN** the card shows the net as invalid and the submit control is disabled

#### Scenario: Renovar from search

- **WHEN** the founder clicks "Renovar" on an ACTIVE loan search result and sends the prefilled request
- **THEN** the copilot opens the renewal form card seeded with that loan, and its quote loads

#### Scenario: No Renovar on closed loans

- **WHEN** a loan search result is not ACTIVE
- **THEN** the row offers no "Renovar" action
