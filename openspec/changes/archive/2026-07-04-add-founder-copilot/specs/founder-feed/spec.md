# founder-feed — delta

## MODIFIED Requirements

### Requirement: Card content and actions are event-type specific

Expanded cards SHALL show detail and actions per event type, matching the Pencil catalog (board section `zmif2`): `application.deleted` cards render with the destructive (red) treatment and a "Restaurar" action that calls the restore mutation (shown only while the 30-day window is open); policy-exception approvals render with the warning (amber) treatment and a link to the application; cards whose subject still exists link to it (application, loan, or client detail). Actions that write MUST reflect the result in the UI (success or structured error).

`copilot.action` events render with the copilot (sparkles) treatment showing the tool provenance from the payload; `rule.alert` events render with the alert (bell) treatment showing rule name, observed value, and threshold. Every card's ask-copilot chip SHALL be functional: clicking it opens the copilot dock with the chip's question prefilled.

#### Scenario: Restore from a deletion card

- **WHEN** an admin expands an `application.deleted` card within the restore window and clicks "Restaurar"
- **THEN** the restore mutation is called and the card reflects the outcome — success (with the new state visible on refresh) or the structured error message

#### Scenario: Expired deletion card hides restore

- **WHEN** an admin expands an `application.deleted` card older than 30 days
- **THEN** the snapshot detail is visible but no "Restaurar" action is offered

#### Scenario: Navigate to the subject

- **WHEN** an admin uses an event card's link to its subject (e.g. "Ver solicitud")
- **THEN** the app navigates to that entity's existing detail view

#### Scenario: Copilot action card shows provenance

- **WHEN** an admin expands a `copilot.action` card
- **THEN** the executed tool and its arguments are visible as the card's detail

#### Scenario: Rule alert card shows the breach

- **WHEN** an admin views a `rule.alert` card
- **THEN** the rule name, observed value, and threshold are shown with the alert treatment

#### Scenario: Ask-chip opens the dock

- **WHEN** an admin clicks a card's ask-copilot chip
- **THEN** the copilot dock opens with the chip's question prefilled
