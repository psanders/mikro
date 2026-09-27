## ADDED Requirements

### Requirement: Run the conversation audit on demand

The copilot SHALL offer a `runConversationAudit` tool that runs the conversation audit immediately, as a direct tool with no confirm card. The run SHALL have trigger `MANUAL` and the founder as actor. The tool SHALL work whether or not the scheduled audit is enabled. It SHALL return a short result for the copilot to relay, built from the run's status paragraph (the same words as the feed card). When a run is already in progress, it SHALL return that error instead.

#### Scenario: Founder asks for an audit

- **WHEN** the founder writes "Corre la auditoría de conversaciones ahora"
- **THEN** the audit runs, a `conversation.audited` card with "Pedida por <founder> desde el copiloto" appears in the feed, and the copilot replies with the counts

#### Scenario: Audit already running

- **WHEN** the founder asks for an audit while one is running
- **THEN** the copilot relays that an audit is already in progress, and no second run starts
