## ADDED Requirements

### Requirement: Inbound messages route to a profile by role and application status

The system SHALL resolve every inbound WhatsApp conversation message to exactly one route, evaluated in this order:

1. A phone that belongs to an enabled DB user routes to that user's role profile (`ADMIN` > `REVIEWER` > `COLLECTOR` precedence when the user has several roles). A disabled user is ignored.
2. A phone that belongs to a customer routes to `CUSTOMER`. When that phone's most recent application is in the review pipeline (`RECEIVED` → `APPROVED`), the route SHALL carry that application so the CUSTOMER agent can follow it.
3. A phone whose most recent application is `DRAFT` routes to `PROSPECT`.
4. A phone whose most recent application is `ABANDONED` with no `submittedAt` is reopened to `DRAFT` and routes to `PROSPECT`.
5. A phone whose most recent application is `RECEIVED`, `IN_REVIEW`, `PENDING_DECISION` or `APPROVED` routes to `APPLICANT`.
6. Any other phone routes to `GUEST`. This covers no application, `REJECTED` (flagged as previously rejected), `CONVERTED` without a customer match, and `ABANDONED` after submission.

The serving agent SHALL be resolved from the profile via `agents.yaml`. A profile with no agent assigned SHALL receive no reply.

#### Scenario: Unknown phone with no application

- **WHEN** a message arrives from a phone with no user, no customer and no application
- **THEN** it routes to `GUEST`

#### Scenario: Draft prospect

- **WHEN** a message arrives from an unknown phone whose latest application is `DRAFT`
- **THEN** it routes to `PROSPECT` with that application's session

#### Scenario: In-pipeline applicant

- **WHEN** a message arrives from an unknown phone whose latest application is `IN_REVIEW`
- **THEN** it routes to `APPLICANT` with that application's id

#### Scenario: Rejected applicant is treated as a flagged guest

- **WHEN** the phone's latest application is `REJECTED`
- **THEN** it routes to `GUEST`, flagged as previously rejected

#### Scenario: Returning customer with a new application

- **WHEN** a customer's phone has an application `IN_REVIEW`
- **THEN** it routes to `CUSTOMER` carrying that application's id

#### Scenario: Customer

- **WHEN** a message arrives from a phone that matches a customer
- **THEN** it routes to `CUSTOMER` with that customer's id

#### Scenario: Employee who is also a customer

- **WHEN** a phone matches both an enabled user and a customer
- **THEN** it routes to the user's role profile

#### Scenario: Reviewer-only user

- **WHEN** a message arrives from an enabled user whose only role is `REVIEWER`
- **THEN** it routes to `REVIEWER`, not `COLLECTOR`

### Requirement: Employees receive no automated reply

Messages from employees (`ADMIN`, `COLLECTOR`, `REVIEWER`) SHALL receive no automated reply unless an agent is explicitly assigned to that role's profile. The system SHALL NOT send the fixed ADMIN or COLLECTOR redirect texts. The message stays visible to humans in the Chatwoot inbox through the WABA fan-out; the apiserver SHALL NOT forward it itself.

#### Scenario: Collector texts the line

- **WHEN** a collector with no assigned COLLECTOR agent sends a message
- **THEN** no WhatsApp reply is sent
- **AND** no LLM is invoked

#### Scenario: Admin with an assigned agent

- **WHEN** an agent is assigned to the `ADMIN` profile and an admin sends a message
- **THEN** that agent handles the message as it does today

### Requirement: Canned replies are replaced by agent replies

The system SHALL NOT send the fixed "Tu solicitud ya está en revisión" hold message to a submitted prospect. It SHALL NOT silently drop customer messages when a `CUSTOMER` agent is assigned. Those turns SHALL be answered by the `APPLICANT` and `CUSTOMER` agents respectively.

#### Scenario: Submitted prospect writes in

- **WHEN** an applicant whose application is `RECEIVED` sends "¿cómo va mi solicitud?"
- **THEN** the `APPLICANT` agent answers
- **AND** the fixed hold message is not sent

### Requirement: The kill switch silences every CX path

When `whatsapp.agentRepliesEnabled` is `false`, the system SHALL send no reply on any route, SHALL NOT invoke any LLM, and SHALL NOT reopen abandoned applications. It SHALL still record prospect activity for the abandon timer, and intake Flow submissions SHALL still be persisted.

#### Scenario: Replies disabled

- **WHEN** replies are disabled and a guest, applicant or customer writes in
- **THEN** no reply is sent and no LLM is invoked

### Requirement: Previously rejected applicants are handed to a person

When a message routes to `GUEST` flagged as previously rejected, and an agent serves `GUEST`, the system SHALL open a human hand-off (reason "Solicitud anterior no aprobada") and send one fixed acknowledgement that the previous application was not approved and a person will reply. It SHALL NOT invoke the GUEST agent, which would otherwise invite them to apply again. No message SHALL be sent at the moment of rejection (no template exists for it).

#### Scenario: Rejected applicant writes in

- **WHEN** a person whose latest application is `REJECTED` writes "quiero volver a aplicar"
- **THEN** a hand-off is opened and a `cx.handoff_requested` feed card appears
- **AND** they receive the fixed acknowledgement
- **AND** no LLM is invoked

#### Scenario: Rejected applicant during an open hand-off

- **WHEN** that person writes again while the hand-off is open
- **THEN** no reply is sent and the hand-off is extended
