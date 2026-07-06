## ADDED Requirements

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
