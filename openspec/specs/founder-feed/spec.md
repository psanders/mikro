# founder-feed Specification

## Purpose

Founder-facing home of the desktop app: a reverse-chronological feed of business events with expandable, type-specific cards, rendered in the founder shell per the Pencil board EzobQ.

## Requirements

### Requirement: Founder shell matches the Pencil design

The founder app SHALL render inside its own shell — independent of the operations layout — that visually matches the Pencil board `EzobQ` screens: a slim dark icon rail on the left (feed home, búsqueda, reportes, profile at the bottom), the feed column layout, header, and copilot affordance (sparkles button with presence dot; the copilot itself is a later change and the affordance is inert). Colors, spacing, typography (Geist), radii, and copy SHALL follow the Pencil screens, not the operations design system components.

#### Scenario: Founder shell is independent of the ops layout

- **WHEN** an admin is on any `/founder` route
- **THEN** the founder shell (icon rail + founder chrome) renders and no operations navigation is visible

#### Scenario: Rail navigation

- **WHEN** an admin clicks the búsqueda or reportes rail icon
- **THEN** the app navigates to `/founder/buscar` or `/founder/reportes` and the icon shows the active state

### Requirement: Feed home shows business events reverse-chronologically

The founder app SHALL provide the feed view at `/founder`, available to ADMIN users, that renders business events newest-first, grouped by day, loading further pages on demand via the feed query's cursor. When the feed is empty it SHALL show an empty state; when loading fails it SHALL surface an error state (per the dashboard's online-only behavior).

#### Scenario: Feed renders events newest-first

- **WHEN** an admin opens `/founder` and events exist
- **THEN** event cards render newest-first with day group headers, and scrolling to the end loads the next page

#### Scenario: Empty feed

- **WHEN** an admin opens `/founder` and no events exist yet
- **THEN** an empty state is shown instead of cards

### Requirement: Cards are compact and manually expandable

Each event SHALL render as a compact card (icon, summary line, actor, relative time, amount when present). A card SHALL expand and collapse only via its own chevron control — there is no global expand switch. Expansion state is per-card and client-side only.

#### Scenario: Expand and collapse one card

- **WHEN** an admin clicks a card's chevron
- **THEN** that card alone expands to show its type-specific detail, and clicking again collapses it

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
