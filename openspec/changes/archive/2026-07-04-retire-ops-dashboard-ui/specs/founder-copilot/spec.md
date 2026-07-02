# founder-copilot — delta

## MODIFIED Requirements

### Requirement: Copilot dock in the founder shell

The founder app SHALL provide a collapsible copilot dock rendered by the founder shell on all founder routes, visually matching the Pencil design (screens `Uljd6` and the dock in `YrWVt`): open state is a right panel with header (copilot name and close control — no online/presence indicator), message thread, and input; closed state is the plain sparkles icon-button in the feed header (no presence dot). The dock SHALL open with a prefilled question when an event card's ask-copilot chip is clicked. Capability suggestion chips (CONSULTAR / ACTUAR / VIGILAR / AUDITAR groups) SHALL be offered when the thread is empty.

#### Scenario: Open and close the dock

- **WHEN** an admin clicks the sparkles button and later the dock's close control
- **THEN** the dock opens as the right panel and collapses back to the button, across all founder routes

#### Scenario: Ask-chip prefills the dock

- **WHEN** an admin clicks an event card's ask-copilot chip (e.g. "¿Qué se borró esta semana?")
- **THEN** the dock opens with that question prefilled in the input

#### Scenario: No online indicators

- **WHEN** an admin views the dock header or the feed header
- **THEN** no "en línea"/"EN VIVO" status or presence dot is shown (user decision 2026-07-04: the indicators added noise without information)
