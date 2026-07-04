# founder-copilot — delta

## MODIFIED Requirements

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
