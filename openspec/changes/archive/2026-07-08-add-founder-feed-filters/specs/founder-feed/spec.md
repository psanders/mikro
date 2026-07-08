## ADDED Requirements

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
