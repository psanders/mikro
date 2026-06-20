# agent-configuration Specification

## Purpose

TBD - created by archiving change externalize-agent-config. Update Purpose after archive.

## Requirements

### Requirement: Agents are defined in an external YAML file

The system SHALL load agent definitions from an external YAML file (path configured in `mikro.json`) rather than from compiled TypeScript objects. Each agent entry SHALL provide `profile`, `systemPrompt`, `allowedTools`, `temperature`, and a `name`, and MAY provide `model` and `enabled` (default `true`). `name` is a human-friendly display label for logs and eval output only — it is NOT an identity and the application SHALL NOT branch on it. Editing the config file and restarting the apiserver SHALL change agent behavior with no code change and no Docker image rebuild. (Hot reload without restart is out of scope for v1.)

#### Scenario: System prompt edited via config

- **WHEN** an operator edits an agent's `systemPrompt` in the YAML file and the apiserver restarts
- **THEN** the running agent uses the new prompt
- **AND** no recompilation or new image is required

#### Scenario: Allowed tools edited via config

- **WHEN** an operator changes an agent's `allowedTools` list in the config and the apiserver restarts
- **THEN** the agent is offered exactly the tools named in the new list on its next invocation

#### Scenario: Config file absent

- **WHEN** the agents config file does not exist at the resolved path
- **THEN** startup fails fast with an error naming the expected path and how to create it from the example

### Requirement: Agent config entries are validated on load

The system SHALL validate every agent entry against the `agentConfigSchema` Zod schema when loading the config. An invalid entry SHALL cause a fail-fast error that names the offending agent and the specific validation problem; the system SHALL NOT silently load a partially valid agent.

#### Scenario: Missing required field

- **WHEN** an agent entry omits `systemPrompt` (or `profile`, or `allowedTools`)
- **THEN** loading fails with an error identifying the agent and the missing field

#### Scenario: Invalid profile value

- **WHEN** an agent entry's `profile` is not one of ADMIN/COLLECTOR/REVIEWER/PROSPECT/GUEST
- **THEN** loading fails with an error listing the valid profiles

#### Scenario: Out-of-range temperature

- **WHEN** an agent entry sets `temperature` outside the allowed 0–2 range
- **THEN** loading fails with an error naming the agent and the invalid value

#### Scenario: Tool name not implemented

- **WHEN** an agent entry's `allowedTools` references a tool name that has no implementation in code
- **THEN** loading fails (or logs a hard error) naming the agent and the unknown tool, rather than offering a non-existent tool at runtime

### Requirement: Evaluations live in the agent config file, not in code

The system SHALL define agent `evaluations` (scenario suites) entirely in the agent's config-file entry, with no hardcoded eval data in source. `evaluations` is optional per agent and is validated by the agent schema. The eval harness SHALL run an agent's scenarios from its config entry.

#### Scenario: Eval suite read from config

- **WHEN** an agent entry includes an `evaluations` block and the eval harness runs for that agent
- **THEN** the harness runs the config-defined scenarios against the config-loaded agent

#### Scenario: Agent without evaluations

- **WHEN** an agent entry omits `evaluations`
- **THEN** the agent loads normally and the eval harness reports it has no scenarios

### Requirement: A new agent is defined entirely in config with no name in code

The system SHALL allow a new agent to be defined entirely by adding an entry to the YAML file — system prompt, allowed tools, temperature, model, display label, and the `profile` it serves — with no new TypeScript module and no agent name anywhere in code. The only constraints are that `profile` is one of the fixed code-defined profiles and every tool in `allowedTools` already exists in code. No Docker image rebuild is needed.

#### Scenario: Agent added via config alone

- **WHEN** an operator adds a well-formed agent entry for an unserved profile whose tools all exist
- **AND** the apiserver restarts
- **THEN** the agent serves that profile with no code change

#### Scenario: New agent referencing a missing tool

- **WHEN** an operator adds an agent entry whose `allowedTools` includes a tool with no implementation
- **THEN** loading fails with an error identifying the agent and the unknown tool

### Requirement: Agents are bound to audience profiles in config

The system SHALL bind each agent to exactly one audience profile (`ADMIN`, `COLLECTOR`, `REVIEWER`, `PROSPECT`, or `GUEST`) declared in `agents.yaml`, and SHALL resolve which agent serves an incoming message by profile rather than from a hardcoded mapping. A profile SHALL be served by at most one agent; a profile with no assigned agent SHALL receive no automated reply. Message routing SHALL map: a DB user to their role profile (ADMIN/COLLECTOR/REVIEWER), an unknown phone with a partial application to PROSPECT, and an unknown phone with no application to GUEST.

#### Scenario: Agent serves its declared profile

- **WHEN** a message routes to a profile that has an assigned, enabled agent
- **THEN** that agent handles the message

#### Scenario: Profile reassigned via config

- **WHEN** an operator changes an agent's `profile` in `agents.yaml` and the apiserver restarts
- **THEN** that agent serves the new profile and no longer serves the old one, with no code change

#### Scenario: Unassigned profile

- **WHEN** a message routes to a profile with no agent assigned (e.g. COLLECTOR or GUEST by default)
- **THEN** no automated reply is sent

#### Scenario: Two agents claim the same profile

- **WHEN** two agent entries declare the same `profile`
- **THEN** loading fails with an error naming the profile and the conflicting agents

#### Scenario: Disabled agent's profile is unserved

- **WHEN** the agent serving a profile has `enabled: false`
- **THEN** that profile resolves to no agent and receives no automated reply

### Requirement: Agents enable/disable themselves and default to enabled

The system SHALL let each agent turn itself on or off via an `enabled` boolean in its own `agents.yaml` entry, defaulting to `true` when omitted. There SHALL be no separate disable list in `mikro.json`. A disabled agent SHALL leave its profile unserved.

#### Scenario: Enabled by default

- **WHEN** an agent entry omits `enabled`
- **THEN** the agent is treated as enabled and serves its profile

#### Scenario: Disable an agent in place

- **WHEN** an operator sets `enabled: false` on an agent and the apiserver restarts
- **THEN** that agent's profile is unserved with no other config change

### Requirement: The agents file path is configured in mikro.json

The system SHALL read the agents definition file path from `mikro.json`'s `agentsFile` field (default `agents.yaml`), resolving relative paths against the `mikro.json` directory.

#### Scenario: Custom agents file path

- **WHEN** `mikro.json` sets `agentsFile` to a custom path
- **THEN** agents load from that file

#### Scenario: Default path

- **WHEN** `mikro.json` omits `agentsFile`
- **THEN** agents load from `agents.yaml` next to `mikro.json`
