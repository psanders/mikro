## ADDED Requirements

### Requirement: Conversation audit card

Each completed audit run SHALL post a `conversation.audited` feed event. The card SHALL render from the event payload alone and SHALL follow Pencil EzobQ section 09:

- **Look:** amber with the warning icon when the run found problems; green with the shield-check icon when it found none.
- **Summary:** "encontró N problemas en M conversaciones", or "sin problemas en M conversaciones".
- **Meta line:** the critical and warning counts, then the trigger: "automática" plus the time, or "Pedida por X desde el copiloto".
- **Expanded content:**
  - a counts strip: conversaciones, mensajes, pasaron a persona, no entregado, problemas;
  - a per-agent list with each `agent_version` and an issue pill per agent, where a version that differs from the previous run's is marked "nueva";
  - a preview of the worst finding, with its quote and "Ver conversación";
  - the Metadata and IA insights links, a "Ver detalle" action, and an ask-copilot chip.

#### Scenario: Run with problems

- **WHEN** a run finds 1 critical and 2 warning issues in 42 conversations
- **THEN** the card is amber, reads "encontró 3 problemas en 42 conversaciones", and its meta line starts "1 crítico · 2 advertencias"

#### Scenario: Clean run

- **WHEN** a run finds no issues
- **THEN** the card is green and reads "sin problemas en M conversaciones"

### Requirement: Findings detail panel

"Ver detalle" SHALL open the right side panel, the founder app's only overlay. The panel lists the run's findings grouped as Crítico, then Advertencias. Each finding shows:

- its severity, its rule, and its source ("Juez IA" or "Chequeo fijo");
- the person (the name when an application or customer is known, otherwise the phone), the application, and the agent with its version;
- the cited turn's speaker, time, and quote;
- the reason;
- "Ver conversación", which opens the application panel on its conversation when the finding has an application.

The footer SHALL state how many conversations had no problems and how many judge errors occurred. If fetching the findings fails, the panel SHALL show an error state.

#### Scenario: Open details

- **WHEN** an admin clicks "Ver detalle" on an audit card
- **THEN** the side panel lists that run's findings, critical ones first, each with its quote and reason

#### Scenario: Jump to the conversation

- **WHEN** an admin clicks "Ver conversación" on a finding linked to an application
- **THEN** the application panel opens for that application
