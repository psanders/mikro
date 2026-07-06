# founder-copilot Specification

## Purpose

Conversational copilot for the founder app: a collapsible dock backed by the apiserver's LLM tool loop. Reads answer immediately with provenance; writes always go through an explicit confirm/reject step and land in the event log.

## Requirements

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

### Requirement: Chat with immediate read answers and provenance

The apiserver SHALL expose an admin-only `copilotChat` procedure that runs the LLM tool loop with the copilot tool policy: read tools (queries, reports, event-log queries, rule listing) execute during the loop and the founder receives the final answer in the same response. Each assistant answer that used tools SHALL carry provenance (tool name(s) and elapsed time) rendered under the message. Conversation history SHALL persist per founder on the copilot channel and reload with the dock, excluding messages that have been cleared (soft-deleted).

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

### Requirement: Clear conversation history

The founder app SHALL provide a small clear-history control in the copilot dock header. The apiserver SHALL expose an admin-only `clearCopilotHistory` procedure that soft-deletes (sets `deletedAt`) every `copilot`-channel `Message` row owned by the caller; soft-deleted rows are never returned by `getCopilotHistory` or the chat loop's history read and are never hard-deleted. The procedure SHALL refuse to clear while the caller has a `PENDING`, unexpired `CopilotPendingAction`, returning a structured error instead of clearing.

#### Scenario: Clearing resets the dock to a fresh state

- **WHEN** an admin clicks the clear-history control and confirms
- **THEN** the dock's thread empties, the capability suggestion chips reappear, and the founder's copilot messages are marked deleted (not removed) in storage

#### Scenario: Clearing is blocked by an unresolved pending action

- **WHEN** an admin clicks clear-history while a write proposed by the copilot is still awaiting confirm/reject
- **THEN** the clear is refused with a structured error telling the founder to resolve the pending action first, and no messages are marked deleted

#### Scenario: Cleared history never resurfaces

- **WHEN** an admin who previously cleared their history reopens the dock or asks a new question
- **THEN** none of the soft-deleted messages appear in the thread or are used as chat context

### Requirement: Application lookup by ID

The copilot tool policy SHALL bind a `getApplicationById` read tool that resolves a loan application (solicitud) by its UUID, so that questions referencing a solicitud by ID can be answered without requiring a phone number instead.

#### Scenario: Solicitud UUID resolves

- **WHEN** an admin asks the copilot for details of a solicitud by its UUID (e.g. via the "Ver solicitud" feed action, which prefills "Muéstrame los detalles de la solicitud `{uuid}`")
- **THEN** the copilot calls `getApplicationById` with that UUID and replies with the application's details, rather than reporting "cliente no encontrado" or asking for a phone number

#### Scenario: Unknown application ID

- **WHEN** `getApplicationById` is called with a UUID that matches no `LoanApplication` row
- **THEN** the tool result reports a not-found outcome distinct from a malformed or unsupported query, and the copilot tells the founder no solicitud was found with that ID

### Requirement: Tool result failure discrimination

Read tools that look up a single record by identifier (`getCustomer`, `getCustomerByPhone`, `getApplicationById`) SHALL report a `reason` of `NOT_FOUND` on their result when no matching record exists, distinct from a generic or unsupported-query failure, so the copilot's reply and any downstream feedback tooling can tell "no matching record" apart from "this tool can't answer that."

#### Scenario: Not-found is distinguishable

- **WHEN** `getCustomer`, `getCustomerByPhone`, or `getApplicationById` finds no matching row
- **THEN** the returned tool result carries `reason: "NOT_FOUND"` alongside `success: false`

### Requirement: Environment and tool-capability awareness

The copilot's system prompt SHALL be assembled per turn (not a static constant) to include the current date, the founder's name when known, and a short set of tool-disambiguation notes for tools whose inputs could otherwise be confused with one another (e.g. a customer UUID vs. a solicitud UUID), so the model can pick the correct tool for an ambiguous identifier without a failed round trip.

#### Scenario: Prompt carries current context

- **WHEN** the copilot chat loop builds the system message for a turn
- **THEN** the system prompt includes that day's date and the founder's name if it is known, in addition to the existing verb/confirmation guidance

#### Scenario: Disambiguation note prevents a wrong-tool call

- **WHEN** the founder references an identifier that could belong to either a customer or a solicitud
- **THEN** the system prompt's tool notes for `getCustomer` and `getApplicationById` are present, guiding the model to pick the tool matching the identifier's actual source before concluding no record exists

### Requirement: Application review actions

The copilot tool policy SHALL bind `approveApplication`, `rejectApplication`, and `deleteApplication` as write tools, so the founder can resolve a loan application (solicitud) from the copilot rather than only from the dashboard or mobile review UI. As write tools they SHALL follow the confirm-first flow (the model's call is intercepted, persisted as a pending action, and executed only after the founder confirms). A rejection SHALL require a non-empty reason, which SHALL be persisted as the application's review note so the decision and its motive remain on the record for audit; rejecting SHALL NOT delete the application row. The system prompt SHALL steer the model to prefer `rejectApplication` (which preserves the record) over `deleteApplication` for a real decline, reserving `deleteApplication` for dead or abandoned flows.

#### Scenario: Reject proposed with a reason, confirmed, evented

- **WHEN** an admin asks the copilot to reject a `RECEIVED` or `IN_REVIEW` solicitud with a stated reason and then clicks confirm on the returned card
- **THEN** the application moves to `REJECTED` only after the click, its review note stores the reason, the thread shows the outcome, and a `copilot.action` event appears in the feed — the application row is not deleted

#### Scenario: Rejection reason is required

- **WHEN** the model calls `rejectApplication` without a non-empty reason
- **THEN** the tool call fails validation and no pending action executes, so a solicitud can never be rejected without a recorded motive

#### Scenario: Approve proposed and confirmed

- **WHEN** an admin asks the copilot to approve a `RECEIVED` or `IN_REVIEW` solicitud and confirms the returned card
- **THEN** the application moves to `APPROVED` only after the click and a `copilot.action` event is recorded

#### Scenario: Review action confirmed while not in a valid source status is refused

- **WHEN** a confirmed `approveApplication` or `rejectApplication` targets a solicitud whose current status is outside the allowed source statuses (e.g. already `CONVERTED`)
- **THEN** the transition is refused with a structured error and no status change or `copilot.action` event occurs

#### Scenario: Delete stays available but is not the default for a decline

- **WHEN** an admin asks the copilot to turn down an applicant without indicating the flow is dead or spam
- **THEN** the copilot proposes `rejectApplication` with a reason rather than `deleteApplication`, and `deleteApplication` is proposed only when the founder indicates the solicitud should be purged
