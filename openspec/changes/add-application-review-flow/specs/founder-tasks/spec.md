## MODIFIED Requirements

### Requirement: Tasks tab lists definitions and creates them with a schema-driven form

The founder app SHALL include a Tasks tab listing task definitions (name, automation, schedule, next firing, enabled state) with create, edit, cancel, and a per-row pause/resume toggle (the `enabled` flag: a paused task fires nothing until resumed, and resuming recomputes `nextFireAt` forward — paused periods are not fired retroactively). The create/edit form SHALL open in the founder app's right side panel (the same panel used by applications; no modal dialog) and SHALL be generated from the selected automation's param spec: `static` slots render as inputs (selects for catalog-backed values, starting with the automation itself) validated against the schema, `ask` slots are displayed as to-be-asked-at-confirmation, and the gate control is clamped to the automation's floor. Manual creation SHALL have full parity with copilot creation and require no LLM.

Static slot inputs SHALL be dispatched on the slot's declared `kind`, not on its name, so every automation with a slot of a given kind renders consistently. A slot of kind `amount` SHALL render as a numeric money input — numeric entry affordance and a currency-formatted placeholder — rather than a free-text box; the currency itself is named in the slot's label. A slot the automation declares optional SHALL be submittable empty, and an empty money input SHALL be submitted as unset rather than as zero.

#### Scenario: Manual creation via generated form

- **WHEN** a founder selects `payment` in the Tasks tab create form
- **THEN** the form shows inputs for the employee and accounts, indicates the amount will be asked at confirmation, and creates the same Task a copilot `createTask` call would

#### Scenario: Money slot renders as a currency input

- **WHEN** the create form renders an automation's static slot of kind `amount`, such as `payment`'s `suggestedAmount`
- **THEN** the field offers numeric entry with a currency-formatted placeholder, and leaving it blank creates the task with that slot unset

#### Scenario: Cancel stops future firings

- **WHEN** a founder cancels a task from the Tasks tab
- **THEN** the task stops firing, and any still-open firing of it can still be confirmed or skipped

#### Scenario: Pause and resume skip the paused periods

- **WHEN** a founder pauses a weekly task for three weeks and then resumes it
- **THEN** no firings are created for the paused weeks and `nextFireAt` is the next occurrence after the resume

#### Scenario: Form opens in the side panel

- **WHEN** a founder starts creating or editing a task
- **THEN** the form opens in the right side panel with the Tasks list still visible behind it, and no modal dialog is used
