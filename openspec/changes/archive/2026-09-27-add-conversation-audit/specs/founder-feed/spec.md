## ADDED Requirements

### Requirement: Conversation audit card

Each completed audit run SHALL post a `conversation.audited` feed event. The card SHALL only say whether the conversations comply, SHALL render from the event payload alone, and SHALL follow Pencil EzobQ section 09 (`PoM6l`):

- **Look:** amber with the warning icon when any conversation doesn't comply; green with the shield-check icon when all comply.
- **Headline:** "N de M conversaciones no cumplen" (worded naturally for one conversation or all of them), "las M conversaciones cumplen", or "sin conversaciones nuevas".
- **Meta line:** the critical and warning counts, then the trigger ("automática", or "Pedida por X desde el copiloto"); a clean run shows only the trigger.
- **Expanded content:** the run's status paragraph (`statusText`) and a "Ver detalle" link that opens the findings panel. Nothing else: no counts, per-agent breakdown, finding previews, Metadata/IA insights links or copilot chip.

Events recorded before `statusText` existed SHALL fall back to a counts sentence.

#### Scenario: Run with problems

- **WHEN** a run finds problems in 3 of 42 conversations (1 critical and 2 warning findings)
- **THEN** the card is amber, reads "3 de 42 conversaciones no cumplen", its meta line starts "1 crítico · 2 advertencias", and expanding it shows the status paragraph and "Ver detalle"

#### Scenario: Clean run

- **WHEN** a run finds no issues in 37 conversations
- **THEN** the card is green and reads "las 37 conversaciones cumplen"

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
