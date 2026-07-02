# founder-feed — delta

## MODIFIED Requirements

### Requirement: Founder shell matches the Pencil design

The founder app SHALL render inside its own shell — the only shell in the app now that the operations layout is retired — that visually matches the Pencil board `EzobQ` screens: a slim dark icon rail on the left (feed home, búsqueda, reportes, profile at the bottom), the feed column layout titled "Feed", and the copilot affordance (plain sparkles button, no presence dot; the feed header carries no "EN VIVO"/online indicator). Colors, spacing, typography (Geist), radii, and copy SHALL follow the Pencil screens.

#### Scenario: Founder shell is independent of the ops layout

- **WHEN** an admin is on any `/founder` route
- **THEN** the founder shell (icon rail + founder chrome) renders and no operations navigation is visible

#### Scenario: Rail navigation

- **WHEN** an admin clicks the búsqueda or reportes rail icon
- **THEN** the app navigates to `/founder/buscar` or `/founder/reportes` and the icon shows the active state

#### Scenario: Feed header without live indicator

- **WHEN** an admin views the feed
- **THEN** the header reads "Feed" with no EN VIVO chip; day groups inside the list keep their Hoy/Ayer labels

### Requirement: Card content and actions are event-type specific

Expanded cards SHALL show detail and actions per event type, matching the Pencil catalog (board section `zmif2`): `application.deleted` cards render with the destructive (red) treatment and a "Restaurar" action that calls the restore mutation (shown only while the 30-day window is open); policy-exception approvals render with the warning (amber) treatment; cards whose subject still exists offer a "Ver …" action that opens the copilot dock prefilled with a question about that entity (the retired operations detail views are no longer navigation targets). Actions that write MUST reflect the result in the UI (success or structured error).

`copilot.action` events render with the copilot (sparkles) treatment showing the tool provenance from the payload; `rule.alert` events render with the alert (bell) treatment showing rule name, observed value, and threshold. Every card's ask-copilot chip SHALL be functional: clicking it opens the copilot dock with the chip's question prefilled.

#### Scenario: Restore from a deletion card

- **WHEN** an admin expands an `application.deleted` card within the restore window and clicks "Restaurar"
- **THEN** the restore mutation is called and the card reflects the outcome — success (with the new state visible on refresh) or the structured error message

#### Scenario: Expired deletion card hides restore

- **WHEN** an admin expands an `application.deleted` card older than 30 days
- **THEN** the snapshot detail is visible but no "Restaurar" action is offered

#### Scenario: Subject action opens the copilot

- **WHEN** an admin uses an event card's "Ver solicitud" / "Ver préstamo" / "Ver cliente" action
- **THEN** the copilot dock opens prefilled with a question about that entity instead of navigating to a retired ops view

#### Scenario: Copilot action card shows provenance

- **WHEN** an admin expands a `copilot.action` card
- **THEN** the executed tool and its arguments are visible as the card's detail

#### Scenario: Rule alert card shows the breach

- **WHEN** an admin views a `rule.alert` card
- **THEN** the rule name, observed value, and threshold are shown with the alert treatment

#### Scenario: Ask-chip opens the dock

- **WHEN** an admin clicks a card's ask-copilot chip
- **THEN** the copilot dock opens with the chip's question prefilled
