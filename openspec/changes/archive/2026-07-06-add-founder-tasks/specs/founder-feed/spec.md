## ADDED Requirements

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
