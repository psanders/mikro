# founder-copilot — delta

## ADDED Requirements

### Requirement: Copilot dock in the founder shell

The founder app SHALL provide a collapsible copilot dock rendered by the founder shell on all founder routes, visually matching the Pencil design (screens `Uljd6` and the dock in `YrWVt`): open state is a right panel with header (name, "en línea" status, close control), message thread, and input; closed state is the sparkles icon-button with presence dot in the feed header. The dock SHALL open with a prefilled question when an event card's ask-copilot chip is clicked. Capability suggestion chips (CONSULTAR / ACTUAR / VIGILAR / AUDITAR groups) SHALL be offered when the thread is empty.

#### Scenario: Open and close the dock

- **WHEN** an admin clicks the sparkles button and later the dock's close control
- **THEN** the dock opens as the right panel and collapses back to the button, across all founder routes

#### Scenario: Ask-chip prefills the dock

- **WHEN** an admin clicks an event card's ask-copilot chip (e.g. "¿Qué se borró esta semana?")
- **THEN** the dock opens with that question prefilled in the input

### Requirement: Chat with immediate read answers and provenance

The apiserver SHALL expose an admin-only `copilotChat` procedure that runs the LLM tool loop with the copilot tool policy: read tools (queries, reports, event-log queries, rule listing) execute during the loop and the founder receives the final answer in the same response. Each assistant answer that used tools SHALL carry provenance (tool name(s) and elapsed time) rendered under the message. Conversation history SHALL persist per founder on the copilot channel and reload with the dock.

#### Scenario: Business question answered with provenance

- **WHEN** an admin asks a question answerable from business data (e.g. cobranza de hoy)
- **THEN** the copilot executes read tools, replies in Spanish in the same response, and the message shows the tool provenance line

#### Scenario: History survives reload

- **WHEN** an admin reopens the dashboard and opens the dock
- **THEN** the prior copilot conversation for that user is shown, with no WhatsApp messages mixed in

#### Scenario: Non-admin access is rejected

- **WHEN** an authenticated non-ADMIN user calls `copilotChat`
- **THEN** the request is rejected with an authorization error

### Requirement: Writes require explicit confirmation

When the model calls a write tool, the apiserver SHALL NOT execute it: it persists a pending action (tool, arguments, human-readable Spanish summary) and returns it in the chat response. The dock SHALL render the pending action as a confirmation card showing the summary and the arguments, with confirm and reject controls. `copilotConfirmAction` SHALL verify the action belongs to the caller, is still pending, and is younger than the expiry window before executing through the tool executor; `copilotRejectAction` marks it rejected. A confirmed action SHALL record a `copilot.action` business event with tool provenance in the payload. Expired or already-resolved actions SHALL NOT be executable.

#### Scenario: Write proposed, confirmed, executed, evented

- **WHEN** an admin asks the copilot to register a payment and then clicks confirm on the returned card
- **THEN** the payment is executed only after the click, the thread shows the outcome, and a `copilot.action` event appears in the feed

#### Scenario: Rejected action never executes

- **WHEN** an admin rejects a pending action
- **THEN** no business mutation occurs, no `copilot.action` event is written, and the card shows the rejected state

#### Scenario: Expired action is refused

- **WHEN** an admin confirms an action older than the expiry window
- **THEN** the mutation is refused with a structured error and nothing executes

#### Scenario: Unlisted tools are never available

- **WHEN** the copilot model is invoked
- **THEN** only tools present in the copilot tool policy are bound; tools in neither the read nor write nor direct list cannot be called
