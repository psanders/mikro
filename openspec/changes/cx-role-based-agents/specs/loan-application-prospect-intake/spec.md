## ADDED Requirements

### Requirement: A never-submitted abandoned application reopens on return

When a prospect writes in and their most recent application is `ABANDONED` with no `submittedAt`, the system SHALL set it back to `DRAFT`, schedule a fresh ABANDON timer, and route the message to the PROSPECT agent. An application that was submitted and later withdrawn (`ABANDONED` with `submittedAt` set) SHALL NOT be reopened.

#### Scenario: Timed-out draft comes back

- **WHEN** a prospect whose DRAFT was auto-abandoned yesterday writes "hola, quiero seguir"
- **THEN** the application returns to `DRAFT`
- **AND** José continues from the fields still missing

#### Scenario: Opted-out prospect comes back

- **WHEN** a prospect who earlier declined (ABANDONED, never submitted) writes in again
- **THEN** the application returns to `DRAFT` and José resumes

#### Scenario: Withdrawn after approval is not reopened

- **WHEN** a prospect whose application went APPROVED → ABANDONED writes in
- **THEN** the application is not modified and the message routes to `GUEST`

### Requirement: José can hand off to a human

The PROSPECT agent SHALL have `requestHumanHandoff` available. It SHALL use it when the prospect is frustrated or asks for a person, instead of closing the application as abandoned. An explicit opt-out ("no me interesa") SHALL still close the application as ABANDONED.

#### Scenario: Prospect asks for a person mid-intake

- **WHEN** a prospect writes "prefiero hablar con alguien"
- **THEN** a hand-off is opened and the application stays `DRAFT`
