## ADDED Requirements

### Requirement: CX agents can hand a conversation off to a human

Every CX agent (`GUEST`, `PROSPECT`, `APPLICANT`, `CUSTOMER`) SHALL be able to request a hand-off with a short reason. It SHALL do so when the person shows frustration, explicitly asks for a person, or is stuck (the agent cannot resolve the request within its scope). An explicit request for a person ("quiero hablar con alguien", "un humano", "un asesor") SHALL trigger a hand-off deterministically, even if the model does not call the tool.

#### Scenario: Explicit request for a person

- **WHEN** a customer writes "quiero hablar con una persona"
- **THEN** a hand-off is opened for that phone
- **AND** the person receives one short acknowledgement saying a team member will reply

#### Scenario: Frustrated prospect

- **WHEN** the PROSPECT agent judges the prospect frustrated and calls `requestHumanHandoff`
- **THEN** a hand-off is opened
- **AND** the DRAFT application is not marked ABANDONED

### Requirement: An open hand-off silences agents for that phone

While a hand-off is open for a phone, the system SHALL NOT invoke any agent or send any automated reply to that phone. A hand-off SHALL stay open for 24 hours after its last inbound message from the person, then close automatically. Opening a hand-off when one is already open SHALL NOT create a duplicate.

#### Scenario: Person writes during an open hand-off

- **WHEN** a hand-off is open and the person sends another message
- **THEN** no automated reply is sent
- **AND** the hand-off's expiry is extended by 24 hours

#### Scenario: Hand-off expires

- **WHEN** 24 hours pass with no inbound message from the person
- **THEN** the hand-off closes and the next message is routed to an agent normally

#### Scenario: Hand-off survives a restart

- **WHEN** the apiserver restarts while a hand-off is open
- **THEN** agents stay silent for that phone

### Requirement: Hand-offs are visible to founders

Opening a hand-off SHALL append a `cx.handoff_requested` business event to the founder feed. The event SHALL include the phone, the profile, the reason, and the customer or application it relates to when known.

#### Scenario: Hand-off appears in the feed

- **WHEN** a hand-off is opened for an applicant
- **THEN** a `cx.handoff_requested` event with the application id and reason appears in the founder feed
