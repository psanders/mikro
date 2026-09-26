## ADDED Requirements

### Requirement: Username-only messages are processed, never dropped

The system SHALL accept inbound WhatsApp messages without `from`, identifying the sender by `from_user_id` / `contacts[].user_id` (BSUID) and `contacts[].profile.username`. Each message in a delivery SHALL be validated on its own: a message that fails validation SHALL be skipped and logged without affecting the others.

#### Scenario: Username sender writes

- **WHEN** a message arrives with `from_user_id` and no `from`
- **THEN** it is routed and answered, addressed to the BSUID

#### Scenario: One malformed message in a delivery

- **WHEN** a delivery contains one message of an unknown shape and one valid message
- **THEN** the valid message is processed

### Requirement: Replies to a username sender go to the BSUID

A reply whose address is a BSUID SHALL be sent with Meta's `recipient` field; a phone address SHALL use `to`.

#### Scenario: Text reply to a username sender

- **WHEN** an agent replies to `DO.1610031533916997`
- **THEN** the request body has `recipient: "DO.1610031533916997"` and no `to`

### Requirement: The BSUID is remembered on customers and applications

When a message carries both a phone and a BSUID, the system SHALL store the BSUID (and username) on every customer and application with that phone, internally, without changing rows that already hold it. When the sender shares their own number in answer to a contact-info request (`origin: "contact_request"`), the system SHALL fill that phone on their BSUID-linked applications that have none, and link it. Shared contact cards with any other origin SHALL be ignored. None of this SHALL be shown in the dashboard.

#### Scenario: Customer writes with phone and BSUID

- **WHEN** a customer's message includes both `from` and `from_user_id`
- **THEN** their customer and application rows get the BSUID

#### Scenario: Customer later hides their number

- **WHEN** that customer later writes with only the BSUID
- **THEN** they are routed to the CUSTOMER agent as before

#### Scenario: Forwarded contact card

- **WHEN** a sender forwards someone else's contact card (`origin: "other"`)
- **THEN** no phone is recorded

### Requirement: Username senders are routed by their stored BSUID

A sender with only a BSUID SHALL be matched to the customer and the latest application holding that BSUID, and then follow the same routing rules as a phone sender. A sender matching neither SHALL be handed to a person: a hand-off with reason "Escribe con nombre de usuario, sin número" and one fixed acknowledgement, without invoking an LLM (subject to the usual hand-off silence and GUEST agent being enabled).

#### Scenario: Unmatched username sender

- **WHEN** a username sender with no linked customer or application writes "info del préstamo"
- **THEN** a hand-off is opened (feed card + Chatwoot note with `@username`)
- **AND** they receive the fixed acknowledgement
- **AND** no LLM is invoked

#### Scenario: Applicant hides their number

- **WHEN** an applicant whose application holds their BSUID writes with only the BSUID
- **THEN** they are routed to the APPLICANT agent

### Requirement: Hand-offs hold across phone and username

A hand-off SHALL store the sender's BSUID when known, and an open hand-off SHALL be found by the phone/address OR the BSUID.

#### Scenario: Hand-off opened with the phone visible

- **WHEN** a hand-off was opened while the person's phone was visible and they then write with only their BSUID
- **THEN** no agent replies and the hand-off is extended

### Requirement: WhatsApp Flow submissions from username senders

A WhatsApp Flow submission from a sender without a phone SHALL be stored with the sender's BSUID and username, and SHALL fold into the latest application already linked to that BSUID, keeping its phone.

#### Scenario: Username sender submits the Flow

- **WHEN** a username sender with no prior application submits the WhatsApp Flow
- **THEN** a new application is stored with no phone and their BSUID
