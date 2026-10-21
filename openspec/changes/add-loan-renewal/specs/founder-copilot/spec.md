## ADDED Requirements

### Requirement: Renewal entry from the copilot

The copilot tool policy SHALL keep an `openRenewalForm` direct tool, optionally seeded with a loan hint, that the model calls when the founder asks to renew a loan (e.g. "renueva el préstamo 10034"). Executing the tool SHALL start a renewal for that loan (or return the existing open one) and return its id. The dock SHALL open the renewal panel for that renewal. The copilot SHALL NOT finalize or cancel a renewal; those actions are taken in the renewal panel. The copilot remains available to admins only.

#### Scenario: Asking to renew opens the renewal

- **WHEN** an admin asks the copilot to renew an ACTIVE loan
- **THEN** a DRAFT renewal exists and the renewal panel opens on it

#### Scenario: Existing open renewal is reused

- **WHEN** the loan already has an open renewal
- **THEN** the panel opens that renewal and no second renewal is created

#### Scenario: Closed loan

- **WHEN** the founder asks to renew a loan that is not ACTIVE
- **THEN** the copilot explains it cannot be renewed and no renewal is created
