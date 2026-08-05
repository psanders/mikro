# founder-copilot — delta

## MODIFIED Requirements

### Requirement: Task management tools

The copilot SHALL expose three DIRECT tools — `createTask`, `listTasks`, `cancelTask` — executed inline without a confirmation gate, because task definitions are reversible configuration (mirroring the watch-rule tools). `createTask` SHALL constrain `automationId` to an enum of the registered catalog ids and describe each automation's static and ask slots in its parameter documentation, so the model can bind only automations and slots that exist; its inputs are validated by the same rules as manual creation (schema-valid static slots, gate clamped to the automation's floor). A static slot the automation declares optional MAY be omitted by the model, and the tool documentation SHALL mark it optional so the model does not invent a value for it. Task _execution_ SHALL never pass through the copilot loop: firing, gathering, confirmation, and execute involve no LLM.

#### Scenario: Natural-language task creation

- **WHEN** the founder tells the copilot to remind them every Friday at 8am to pay a named collector
- **THEN** the copilot calls `createTask` with `automationId: "payment"`, a weekly Friday 8:00 schedule, and the resolved collector as a static slot, and the dock shows the created task

#### Scenario: Fixed amount captured at creation

- **WHEN** the founder tells the copilot to set up a weekly RD$3,500 payment to a named collector
- **THEN** the copilot binds `suggestedAmount` as a static slot so the amount is pre-filled at confirm time, and the amount is still confirmed by the founder rather than charged automatically

#### Scenario: Model cannot invent an automation

- **WHEN** the model attempts `createTask` with an `automationId` outside the catalog enum
- **THEN** the call fails validation and no task is created
