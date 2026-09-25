## MODIFIED Requirements

### Requirement: Agents are bound to audience profiles in config

The system SHALL bind each agent to exactly one audience profile (`ADMIN`, `COLLECTOR`, `REVIEWER`, `CUSTOMER`, `APPLICANT`, `PROSPECT`, or `GUEST`) declared in `agents.yaml`, and SHALL resolve which agent serves an incoming message by profile rather than from a hardcoded mapping. A profile SHALL be served by at most one agent; a profile with no assigned agent SHALL receive no automated reply. Message routing SHALL map: a DB user to their role profile (ADMIN/REVIEWER/COLLECTOR), a customer phone to CUSTOMER, an unknown phone with a DRAFT (or reopened) application to PROSPECT, an unknown phone with an in-pipeline application (RECEIVED through APPROVED) to APPLICANT, and any other unknown phone to GUEST.

#### Scenario: Agent serves its declared profile

- **WHEN** a message routes to a profile that has an assigned, enabled agent
- **THEN** that agent handles the message

#### Scenario: Profile reassigned via config

- **WHEN** an operator changes an agent's `profile` in `agents.yaml` and the apiserver restarts
- **THEN** that agent serves the new profile and no longer serves the old one, with no code change

#### Scenario: Unassigned profile

- **WHEN** a message routes to a profile with no agent assigned (e.g. COLLECTOR by default)
- **THEN** no automated reply is sent

#### Scenario: Two agents claim the same profile

- **WHEN** two agent entries declare the same `profile`
- **THEN** loading fails with an error naming the profile and the conflicting agents

#### Scenario: Disabled agent's profile is unserved

- **WHEN** the agent serving a profile has `enabled: false`
- **THEN** that profile resolves to no agent and receives no automated reply

#### Scenario: New profiles are valid in config

- **WHEN** an agent entry declares `profile: CUSTOMER` or `profile: APPLICANT`
- **THEN** the config loads and the agent serves that profile
