# whatsapp-intake-agent Specification

## Purpose

Defines the behavior of José, the WhatsApp AI intake agent for prospect loan applications. José activates when a prospect with a partial loan application messages the business WhatsApp line, guides them through qualifying questions and remaining intake fields, and finalizes the application when done.

## Requirements

### Requirement: Route prospect messages to José

The system SHALL identify inbound WhatsApp messages from phones that have a partial loan application and route them to the José agent, without affecting any existing routes (customer, user/ADMIN, user/COLLECTOR).

#### Scenario: Partial application exists for sender phone

- **WHEN** a WhatsApp message arrives from a phone number
- **AND** a loan application with `partial: true` exists for that phone
- **THEN** the message is routed to the José agent
- **AND** no other agent or route handler processes the message

#### Scenario: Completed application exists for sender phone

- **WHEN** a WhatsApp message arrives from a phone number
- **AND** a loan application with `partial: false` exists for that phone
- **THEN** the system replies with a hold message ("Tu solicitud ya está en revisión. Pronto te contactaremos.")
- **AND** the José intake agent does NOT run

#### Scenario: No application found for sender phone

- **WHEN** a WhatsApp message arrives from a phone number
- **AND** no loan application exists for that phone
- **THEN** the message is handled by the existing unknown-phone path (ignored)

#### Scenario: Existing routes are unaffected

- **WHEN** a message arrives from a phone registered as a customer, user/ADMIN, or user/COLLECTOR
- **THEN** those routes execute as before, regardless of whether a loan application exists for that phone

---

### Requirement: Qualify prospects before full intake

José SHALL lead every intake conversation with qualifying gates — province, business type — before collecting remaining intake fields. If a prospect fails a gate, José SHALL decline gracefully, call `finalizeApplication`, and stop.

#### Scenario: Province is out of zone

- **WHEN** José determines the prospect's province is not Puerto Plata
- **THEN** José sends: "Gracias por escribirnos. Por el momento solo atendemos negocios en Puerto Plata. Si en el futuro expandimos nuestra cobertura, te avisamos."
- **AND** José calls `finalizeApplication` to mark the record as complete
- **AND** José stops the intake conversation

#### Scenario: Business type is critical

- **WHEN** José determines the prospect's business type falls in the critical category
- **THEN** José sends: "Gracias por tu interés. En este momento no podemos procesar solicitudes para ese tipo de negocio."
- **AND** José calls `finalizeApplication`
- **AND** José stops the intake conversation

#### Scenario: Province not yet on record

- **WHEN** the application has no province set
- **THEN** José asks for province before asking any other intake fields

---

### Requirement: Collect remaining fields conversationally

After qualifying gates pass, José SHALL ask for any missing intake fields, prioritizing by scoring impact: capacity fields first (`monthlySales`, `requestedAmount`, `requestedTermWeeks`), then business-risk fields, then remaining fields.

#### Scenario: All capacity fields missing

- **WHEN** none of `monthlySales`, `requestedAmount`, or `requestedTermWeeks` are set
- **THEN** José asks for `monthlySales` first (the field most often missing from the website form)

#### Scenario: Some capacity fields filled

- **WHEN** some but not all capacity fields are set
- **THEN** José asks for the missing capacity fields before moving to lower-weight categories

#### Scenario: Conditional fields skipped

- **WHEN** `maritalStatus` is not "Casado(a)" or "Unión libre"
- **THEN** José MUST NOT ask for `spouseName` or `spousePhone`

#### Scenario: Field answer saved

- **WHEN** the prospect provides a valid answer for a field
- **THEN** José calls `saveAnswer` with the field key and value before asking the next question

#### Scenario: Invalid answer not saved

- **WHEN** the prospect provides an answer that fails schema validation for a field
- **THEN** José does NOT call `saveAnswer`
- **AND** José re-asks the question with a brief explanation of what format is expected

---

### Requirement: Exit early when score reaches threshold

After each saved answer, José SHALL re-simulate the application score with `partial: false`. If the simulated ISC reaches 80 or above, José SHALL finalize immediately without asking remaining fields.

#### Scenario: Score reaches 80 mid-conversation

- **WHEN** after saving an answer the simulated ISC is ≥ 80
- **THEN** José calls `finalizeApplication` immediately
- **AND** José sends the closing message
- **AND** José does NOT ask any further intake questions

#### Scenario: Score below 80 after answer

- **WHEN** after saving an answer the simulated ISC is < 80
- **THEN** José continues asking for the next missing field

#### Scenario: Score simulation uses partial: false

- **WHEN** José evaluates the simulated score
- **THEN** the scoring engine is called with `partial: false` regardless of the DB record's partial value
- **AND** the DB record is NOT updated during simulation

---

### Requirement: Finalize when all fields gathered or stuck

José SHALL finalize the application when all collectible fields have been asked OR when 4 consecutive conversation turns pass without a `saveAnswer` call (stuck).

#### Scenario: All fields asked

- **WHEN** José has asked every applicable field at least once
- **THEN** José calls `finalizeApplication`
- **AND** José sends the closing message

#### Scenario: Stuck after 4 empty turns

- **WHEN** 4 consecutive turns pass without `saveAnswer` being called
- **THEN** José calls `finalizeApplication` with whatever data is on record
- **AND** José sends the closing message

---

### Requirement: Send closing message reflecting working hours

When finalizing (success or stuck), José SHALL send a single closing message in Spanish that communicates the next step and sets correct expectations about working-hour response time.

#### Scenario: Prospect has firstName on record

- **WHEN** `finalizeApplication` is called and `firstName` is set
- **THEN** the closing message includes the prospect's first name: "¡Listo, {firstName}! Tu información está completa. Un asesor de Mikro la revisará y te contactará en horario laboral (lunes a viernes). Si nos escribes en fin de semana, respondemos el lunes. ¡Gracias por tu interés!"

#### Scenario: Prospect has no firstName on record

- **WHEN** `finalizeApplication` is called and `firstName` is not set
- **THEN** the closing message omits the name: "¡Listo! Tu información está completa. Un asesor de Mikro la revisará y te contactará en horario laboral (lunes a viernes). Si nos escribes en fin de semana, respondemos el lunes. ¡Gracias por tu interés!"

#### Scenario: Closing message sent exactly once

- **WHEN** `finalizeApplication` is called
- **THEN** the closing message is sent exactly once
- **AND** no further intake messages are sent to that number

---

### Requirement: José's tool set is scoped to intake only

The José agent SHALL have access to exactly three tools: `getApplicationState`, `saveAnswer`, and `finalizeApplication`. José SHALL NOT have access to María's financial, payment, or admin tools.

#### Scenario: Tool access is isolated

- **WHEN** the José agent is invoked
- **THEN** only `getApplicationState`, `saveAnswer`, and `finalizeApplication` are available as tools

#### Scenario: getApplicationState returns score simulation

- **WHEN** José calls `getApplicationState`
- **THEN** the response includes: current field values (filled/missing), the simulated ISC (`partial: false`), and whether any qualifying gates have been tripped (OUT_OF_ZONE, CRITICAL_BUSINESS)

---

### Requirement: Conversation history is phone-keyed and in-memory

José's multi-turn conversation context SHALL be stored in the existing in-memory session store, keyed by the prospect's E.164 phone number. The DB application row is the source of truth for collected data; the session is used only for conversational context.

#### Scenario: Session restarts transparently

- **WHEN** the in-memory session for a prospect is lost (server restart, TTL expiry)
- **THEN** José re-greets the prospect on their next message
- **AND** no collected field data is lost (it persists in the DB row)
