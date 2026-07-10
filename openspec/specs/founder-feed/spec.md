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

### Requirement: Open task firings render as amber action cards in the feed

`task.due` and `task.needs_input` events whose firing is still unresolved SHALL render in the feed with the amber (warning) accent and an action widget; all other `task.*` events, and `task.due`/`task.needs_input` events whose firing was since resolved, SHALL render as plain event rows using the payload's denormalized fields. The action widget SHALL fetch the firing's live state by the `taskFiringId` in the event payload (the event row itself renders without any fetch), and present: the resolved payload for review, one input per pending `ask` slot, a confirm action, and a skip action. Confirm and skip SHALL reflect success or a structured error in place, and a resolved firing's card SHALL drop the widget. If the firing state fetch fails, the card SHALL degrade to a plain event row rather than blocking the feed.

#### Scenario: Due task shows the confirm widget

- **WHEN** a founder views the feed containing a `task.due` event whose firing is `READY`
- **THEN** the card renders with the amber accent, the resolved payload, an input for each ask slot, and confirm/skip actions

#### Scenario: Confirming from the card completes the task

- **WHEN** the founder fills the amount on a `pay-collector` task card and confirms
- **THEN** the widget reflects success, the card drops its action affordance, and the resulting `task.completed` event appears in the feed

#### Scenario: Resolved firing renders as a plain row

- **WHEN** the feed renders a `task.due` event whose firing was already confirmed or skipped
- **THEN** the card is a plain event row with no widget and no live fetch beyond the initial state check

#### Scenario: Needs-input card explains what is missing

- **WHEN** the feed renders a `task.needs_input` event for an unresolved firing
- **THEN** the amber card names the missing or failed slots and offers inputs to supply them plus confirm/skip

### Requirement: Feed events can be filtered by type, actor, and date range

The feed SHALL provide a persistent filter bar directly below the header — separate from the header's copilot (sparkles) icon — with active-filter chips flowing from the left and a filter icon button right-aligned. The filter bar renders even with no filters active (icon only, no chips), so its position never shifts the feed content. Clicking the filter icon opens a popup panel offering: a "Tipo" multi-select of the existing type groupings (Pagos, Contratos, Decisiones, Alertas, Tareas, Mensajes), an "Actor" single-select sourced from platform users, and a "Rango de fechas" control with Hoy/7d/30d presets plus a custom from/to range. Applying the popup SHALL re-query the feed (`listFeedEvents`) with the selected `types`, `actorId`, and `from`/`to` bounds, and populate the chip row. Removing a chip SHALL clear only that filter dimension and re-query. The filter bar replaces the prior always-visible type-pill row.

#### Scenario: Opening the filter popup

- **WHEN** an admin clicks the filter bar's filter icon
- **THEN** a popup opens with Tipo checkboxes, an Actor dropdown, and a date-range control, reflecting the currently active filters

#### Scenario: Filter bar has no layout shift

- **WHEN** an admin clears the last active filter
- **THEN** the filter bar remains visible showing only the filter icon (no chips), and the feed content below does not shift position

#### Scenario: Applying a combined filter

- **WHEN** an admin selects "Pagos" under Tipo, an actor under Actor, and a custom date range, then clicks Aplicar
- **THEN** the popup closes, the feed re-queries with all three constraints, and a chip appears for each active dimension (Tipo, Actor, Rango de fechas)

#### Scenario: Clearing one filter via its chip

- **WHEN** an admin clicks the "×" on the Actor chip while Tipo and Rango de fechas are also active
- **THEN** only the actor constraint is removed, the feed re-queries with the remaining filters, and the Actor chip disappears while the other chips remain

#### Scenario: Date range presets

- **WHEN** an admin opens the date-range control and selects "7d"
- **THEN** the from/to inputs populate with a range covering the last 7 days and the feed re-queries once Aplicar is clicked

#### Scenario: Empty filter result

- **WHEN** an admin applies a filter combination that matches no events
- **THEN** the feed shows its existing empty state rather than an error

#### Scenario: Default filter state on first visit

- **WHEN** an admin opens the feed with no previously saved filter preference
- **THEN** the filter bar shows no Tipo/Actor chips but a "Hoy" date-range chip, and the feed query is scoped to today's events

#### Scenario: Filter preference persists across sessions

- **WHEN** an admin applies a filter combination and later reopens the founder app (new session, same browser)
- **THEN** the feed reloads with the same filter combination applied, without the admin re-selecting it

### Requirement: Consecutive similar events collapse into a grouped summary row

Within a single day group, consecutive feed events (as returned, newest-first) that share the same `type` and `actorId` SHALL render as one collapsible summary row (e.g. "5 pagos recibidos · Ana R. · hace 2h") instead of one row per event, once the run length is 2 or more. The summary row SHALL expand and collapse independently via its own chevron, matching the existing per-card expand pattern; expanding SHALL reveal the individual events in their original (newest-first) order, each rendered as its normal card. A run SHALL NOT cross a day-group boundary (grouping is computed over the full loaded list, so a run may span a "load more" page fetch — that's fine since the list is one continuous newest-first stream). Events rendered with `TaskFeedCard` (i.e. `task.due`/`task.needs_input` with a live action widget) SHALL NOT be grouped, even if adjacent and matching, so their action affordance stays visible.

#### Scenario: Consecutive same-type same-actor events group

- **WHEN** the feed contains five consecutive `payment.collected` events from the same actor within one day group
- **THEN** they render as a single summary row reading a count, the event type label, the actor, and the most recent relative time

#### Scenario: Expanding a grouped run

- **WHEN** an admin clicks the chevron on a grouped summary row
- **THEN** the row expands to show each underlying event as its normal card, newest-first, and clicking the chevron again collapses it back to the summary row

#### Scenario: Non-consecutive matching events do not group

- **WHEN** two `payment.collected` events from the same actor are separated by an event of a different type or actor
- **THEN** each renders as its own row; grouping only applies to strictly consecutive matches

#### Scenario: Single event does not form a group

- **WHEN** an event's type/actor combination has no adjacent match
- **THEN** it renders as a normal single card, not a one-item summary row

#### Scenario: Task action cards are never grouped

- **WHEN** two consecutive `task.due` events from the same actor appear in the feed
- **THEN** each still renders as its own `TaskFeedCard` with its action widget, not folded into a summary row

### Requirement: Contract-generated events render as feed cards

The feed SHALL render `contract.generated` business events as type-specific cards following the existing card conventions (icon, summary line naming the customer, actor, relative time). The expanded card SHALL compose its narrative sentence client-side from the event payload (customer name and terms) with no LLM call or network request, and SHALL offer the standard "Metadata" and "IA insights" links and a functional ask-copilot chip. No PDF is stored on or downloadable from the event — the card is a record of the action, not the document.

#### Scenario: Contract event appears in the feed

- **WHEN** a founder generates a customer contract and later opens the feed
- **THEN** a `contract.generated` card is shown newest-first, naming the customer, actor, and time

#### Scenario: Expanded card narrates the terms from the payload

- **WHEN** an admin expands a `contract.generated` card
- **THEN** a narrative sentence composed from the payload (customer and loan terms) is shown, along with the Metadata and IA-insights links, and no PDF download is offered
