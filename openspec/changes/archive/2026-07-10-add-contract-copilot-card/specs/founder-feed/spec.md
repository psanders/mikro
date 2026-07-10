## ADDED Requirements

### Requirement: Contract-generated events render as feed cards

The feed SHALL render `contract.generated` business events as type-specific cards following the existing card conventions (icon, summary line naming the customer, actor, relative time). The expanded card SHALL compose its narrative sentence client-side from the event payload (customer name and terms) with no LLM call or network request, and SHALL offer the standard "Metadata" and "IA insights" links and a functional ask-copilot chip. No PDF is stored on or downloadable from the event — the card is a record of the action, not the document.

#### Scenario: Contract event appears in the feed

- **WHEN** a founder generates a customer contract and later opens the feed
- **THEN** a `contract.generated` card is shown newest-first, naming the customer, actor, and time

#### Scenario: Expanded card narrates the terms from the payload

- **WHEN** an admin expands a `contract.generated` card
- **THEN** a narrative sentence composed from the payload (customer and loan terms) is shown, along with the Metadata and IA-insights links, and no PDF download is offered
