## ADDED Requirements

### Requirement: Agents declare audit policies

An agent entry in `agents.yaml` MAY declare `policies`, a list of `{ id, rule, severity }`, where `severity` is `critical` or `warning` and `id` is unique within the agent. Only the conversation audit's rules judge SHALL use policies. They SHALL NOT change the agent's runtime behavior or its `agent_version`.

#### Scenario: Policies load with the agent

- **WHEN** an agent entry declares two policies
- **THEN** the loaded agent carries both, and its `agent_version` is the same as without them

#### Scenario: Invalid policy rejected

- **WHEN** a policy has a severity other than `critical` or `warning`, or two policies share an id
- **THEN** loading the agents file fails with an error naming the agent
