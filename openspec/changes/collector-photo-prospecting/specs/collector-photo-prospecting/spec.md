## ADDED Requirements

### Requirement: Collector image triggers phone extraction and confirmation

When a registered COLLECTOR user sends an image via WhatsApp, the system SHALL download the image, invoke the vision LLM to extract the first phone number visible in the image, and respond with a WhatsApp interactive reply-button message presenting the extracted number and asking for confirmation. The system SHALL store the extracted number in a pending state keyed on the collector's phone with a 5-minute TTL.

#### Scenario: Valid phone number extracted from image

- **WHEN** a COLLECTOR sends a WhatsApp image message
- **AND** the vision LLM returns a string that parses to a valid E.164 number
- **THEN** the system stores that number in the pending map (TTL 5 min)
- **AND** sends an interactive button message with "Sí, enviar" and "No" buttons showing the E.164 number

#### Scenario: No phone number detected in image

- **WHEN** a COLLECTOR sends a WhatsApp image message
- **AND** the vision LLM returns "NONE" or a value that cannot be parsed to E.164
- **THEN** the system does NOT store any pending entry
- **AND** sends a text reply: "No vi ningún número en la foto. Por favor toma otra foto."

#### Scenario: Multiple numbers in image — first used

- **WHEN** a COLLECTOR sends an image containing more than one phone number
- **THEN** the system uses only the first number the vision LLM returns
- **AND** confirms that single number to the collector

### Requirement: Collector button reply dispatches or cancels the promo send

When a COLLECTOR taps "Sí, enviar" on the confirmation button, the system SHALL send the configured intake Flow CTA promo template (via `sendTemplateMessage` + `getWhatsAppPromoTemplate`) to the pending target phone and confirm to the collector. When the collector taps "No", the system SHALL cancel without sending and confirm no action was taken. In both cases, the pending entry is cleared.

#### Scenario: Collector confirms — promo sent

- **WHEN** a COLLECTOR sends an interactive `button_reply` with id `"yes"`
- **AND** a valid pending entry exists for that collector's phone
- **THEN** the system calls `sendTemplateMessage` with the intake Flow CTA template targeting the pending phone
- **AND** sends the collector a text reply confirming the number the promo was sent to
- **AND** clears the pending entry

#### Scenario: Collector declines — no promo sent

- **WHEN** a COLLECTOR sends an interactive `button_reply` with id `"no"`
- **AND** a valid pending entry exists for that collector's phone
- **THEN** no promo is sent
- **AND** the system sends a text reply: "Ok, no envié nada."
- **AND** clears the pending entry

#### Scenario: Button reply with no pending entry

- **WHEN** a COLLECTOR sends a `button_reply`
- **AND** no pending entry exists (expired or never created)
- **THEN** the system sends a text reply indicating nothing is pending

#### Scenario: Pending entry expires before button tap

- **WHEN** a COLLECTOR received a confirmation button message
- **AND** more than 5 minutes pass without a reply
- **AND** the collector then sends a `button_reply`
- **THEN** the pending entry is gone (TTL expired)
- **AND** the system responds as if no pending entry exists

### Requirement: Non-image messages from a COLLECTOR receive a guidance reply

When a registered COLLECTOR user sends any WhatsApp message that is not an image and not a button reply, the system SHALL respond with a brief message explaining that it can only help with sending the promo via photo.

#### Scenario: Text message from collector

- **WHEN** a COLLECTOR sends a text message via WhatsApp
- **THEN** the system replies: "Solo puedo ayudarte a enviar el promo. Envíame una foto del negocio."
- **AND** no promo is sent

#### Scenario: Audio message from collector

- **WHEN** a COLLECTOR sends a voice note via WhatsApp
- **THEN** the system replies with the same guidance message as for text

### Requirement: COLLECTOR users are routed to the collector handler regardless of agent assignment

The message router SHALL return `{ type: "user", role: "COLLECTOR" }` for any enabled COLLECTOR-role user, bypassing the `getAgentForProfile` gate (which was designed for LLM agents only). The `processMessage` function SHALL dispatch `route.role === "COLLECTOR"` to `handleCollectorMessage` before attempting LLM agent resolution.

#### Scenario: Enabled COLLECTOR routed to collector handler

- **WHEN** a WhatsApp message arrives from a phone belonging to an enabled COLLECTOR user
- **THEN** the router returns `{ type: "user", role: "COLLECTOR", userId, phone }`
- **AND** `processMessage` delegates to `handleCollectorMessage`

#### Scenario: Disabled COLLECTOR still ignored

- **WHEN** a WhatsApp message arrives from a phone belonging to a COLLECTOR user with `enabled: false`
- **THEN** the router returns `{ type: "ignored" }`
- **AND** no reply is sent

### Requirement: `button_reply` parsed from incoming interactive messages

The `whatsappInteractiveSchema` SHALL include an optional `button_reply` field with `id` and `title` string properties, so that taps on reply-button messages can be dispatched correctly.

#### Scenario: Button reply decoded from webhook

- **WHEN** a WhatsApp webhook delivers an `interactive` message with `interactive.type === "button_reply"`
- **THEN** `message.interactive.button_reply.id` is accessible as a string in the handler
