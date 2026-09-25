## ADDED Requirements

### Requirement: Guest agent answers FAQ and pushes the solicitud

The `GUEST` agent SHALL answer general questions about Mikro (what it offers, coverage area, requirements, how to apply) and SHALL end every substantive reply by inviting the guest to fill out the solicitud (the website link or the WhatsApp intake Flow). It SHALL NOT collect application fields in free text and SHALL NOT quote approval odds or promise amounts.

#### Scenario: Guest asks about requirements

- **WHEN** a guest asks "¿qué necesito para un préstamo?"
- **THEN** the agent answers briefly
- **AND** invites the guest to fill out the solicitud

### Requirement: Applicant agent is limited to status, missing evidence and FAQ

The `APPLICANT` agent SHALL be able to:

- tell the applicant their application's stage in plain language (received / in review / pending decision / approved);
- ask for the evidence still missing (cédula front/back images; business photos below the configured minimum) and attach images the applicant sends to the application;
- answer the FAQ.

It SHALL NOT disclose score, risk band, recommendation, rejection or decision reasons, reviewer names, timelines or approval odds. Any other request SHALL lead to a hand-off to a human.

#### Scenario: Applicant asks for status

- **WHEN** an applicant whose application is `IN_REVIEW` asks how it is going
- **THEN** the agent says it is being reviewed
- **AND** does not mention a score, a date or the chance of approval

#### Scenario: Applicant sends a missing business photo

- **WHEN** the application has fewer business photos than the configured minimum and the applicant sends a photo
- **THEN** the image is attached to the application as a `BUSINESS_PHOTO` document
- **AND** the agent confirms and asks for any evidence still missing

#### Scenario: Applicant asks why it is taking long

- **WHEN** an applicant asks when they will get an answer
- **THEN** the agent gives no date or time estimate

#### Scenario: Applicant asks for something out of scope

- **WHEN** an applicant asks to change the requested amount
- **THEN** the agent hands off to a human

### Requirement: Customer agent sees only the sender's own loans

The `CUSTOMER` agent SHALL answer about the sender's own loans (status, balance, next payment, payment history) and SHALL be able to resend a receipt for one of the sender's own payments. Customer tools SHALL take the customer identity from the conversation context and SHALL ignore any phone, customer id or loan id supplied by the model that does not belong to that customer.

#### Scenario: Customer asks for balance

- **WHEN** a customer asks "¿cuánto debo?"
- **THEN** the agent answers from that customer's own active loan(s)

#### Scenario: Customer asks about another person's loan

- **WHEN** a customer asks for the balance of another phone number or loan id
- **THEN** the tool returns no data for it
- **AND** the agent declines

#### Scenario: Customer requests a receipt

- **WHEN** a customer asks for the receipt of their last payment
- **THEN** the receipt for that customer's payment is sent to the sender's phone

### Requirement: CX agents are defined in agents.yaml

The GUEST, APPLICANT and CUSTOMER agents SHALL be defined as entries in `agents.yaml` bound to their profiles, each with an explicit `allowedTools` list. No agent name SHALL appear in code.

#### Scenario: Customer agent disabled

- **WHEN** the CUSTOMER agent has `enabled: false`
- **THEN** customer messages receive no reply
