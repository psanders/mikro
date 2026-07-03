# founder-feed Specification

## Purpose

Founder-facing home of the desktop app: a reverse-chronological feed of business events with expandable, type-specific cards, rendered in the founder shell per the Pencil board EzobQ.

## Requirements

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

Expanded cards SHALL show a per-type narrative sentence (when the event carries fields beyond its compact summary line), a "Metadata" link, an "IA insights" link, and type-specific actions — matching the Pencil catalog (board section `zmif2`, exploration row `VIflA`). `application.deleted` cards render with the destructive (red) treatment and a "Restaurar" action that calls the restore mutation (shown only while the 30-day window is open); policy-exception approvals render with the warning (amber) treatment; cards whose subject still exists offer a "Ver …" action that opens the copilot dock prefilled with a question about that entity (the retired operations detail views are no longer navigation targets). Actions that write MUST reflect the result in the UI (success or structured error).

The narrative sentence SHALL be composed client-side from fields already present on the event (`FeedEvent` top-level fields and `payload`) — no LLM call, no network request, no persistence. When an event type has no fields beyond what its compact summary line already shows (`application.signed`, `application.restored`, `customer.created`, `rule.alert`), the narrative sentence SHALL be omitted rather than repeating the compact summary a second time.

The "Metadata" link SHALL open a view of the event's raw `payload` (plus `type`, `occurredAt`, `actorName`) as formatted JSON — the same link and rendering for every event type, no per-type logic. The "IA insights" link SHALL open the copilot dock prefilled with a question about that specific record (reusing `subjectQuestion()` for event types that already resolve a subject link; a type-specific question otherwise) — this replaces the KV-grid's generic unhandled-payload-key fallback, which is removed.

`copilot.action` events render with the copilot (sparkles) treatment showing the tool provenance from the payload; `rule.alert` events render with the alert (bell) treatment showing rule name, observed value, and threshold. Every card's ask-copilot chip SHALL be functional: clicking it opens the copilot dock with the chip's question prefilled.

The `application.deleted` narrative SHALL NOT include a deletion reason — no reason is captured by the delete flow today; adding one is out of scope for this change. The `loan.status_changed` narrative SHALL degrade to naming only the resulting status when the prior status is unavailable (`payload.from` empty), matching current behavior.

#### Scenario: Restore from a deletion card

- **WHEN** an admin expands an `application.deleted` card within the restore window and clicks "Restaurar"
- **THEN** the restore mutation is called and the card reflects the outcome — success (with the new state visible on refresh) or the structured error message

#### Scenario: Expired deletion card hides restore

- **WHEN** an admin expands an `application.deleted` card older than 30 days
- **THEN** the narrative and Metadata link are still visible but no "Restaurar" action is offered

#### Scenario: Subject action opens the copilot

- **WHEN** an admin uses an event card's "Ver solicitud" / "Ver préstamo" / "Ver cliente" action
- **THEN** the copilot dock opens prefilled with a question about that entity instead of navigating to a retired ops view

#### Scenario: Copilot action card shows provenance

- **WHEN** an admin expands a `copilot.action` card
- **THEN** the executed tool's result is shown as the narrative sentence (falling back to the tool name when no result summary was recorded), and the full arguments are available via the Metadata link

#### Scenario: Rule alert card shows the breach

- **WHEN** an admin views a `rule.alert` card
- **THEN** the compact summary already states the rule name, observed value, and threshold, so no separate narrative sentence is shown — only the Metadata and IA insights links plus any actions

#### Scenario: Ask-chip opens the dock

- **WHEN** an admin clicks a card's ask-copilot chip
- **THEN** the copilot dock opens with the chip's question prefilled

#### Scenario: Event type with no extra fields omits the narrative

- **WHEN** an admin expands an `application.signed`, `application.restored`, `customer.created`, or `rule.alert` card
- **THEN** no narrative sentence row is rendered — the card goes directly from the head to the Metadata/IA-insights links (and any actions)

#### Scenario: Metadata link shows the raw event

- **WHEN** an admin clicks a card's "Metadata" link
- **THEN** a view opens showing the event's `type`, `occurredAt`, `actorName`, and full `payload` as formatted JSON, unchanged by event type

#### Scenario: IA insights link opens the copilot with context

- **WHEN** an admin clicks a card's "IA insights" link
- **THEN** the copilot dock opens with a question prefilled that references the specific record (not a generic weekly question)

#### Scenario: Deletion narrative has no reason

- **WHEN** an admin expands an `application.deleted` card
- **THEN** the narrative sentence describes who requested what and who deleted it, with no "motivo" clause, since no reason is captured today

#### Scenario: Loan status change without a known prior status

- **WHEN** an admin expands a `loan.status_changed` card whose event has an empty `payload.from`
- **THEN** the narrative names only the resulting status (e.g. "Préstamo actualizado a completado.")
