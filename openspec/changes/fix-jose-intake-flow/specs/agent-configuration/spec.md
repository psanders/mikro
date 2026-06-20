## ADDED Requirements

### Requirement: Agent reply mode selects pre- or post-tool text

When an agent emits text both alongside a tool call and after the tool result, the system SHALL choose which becomes the user-facing reply based on the agent's `replyMode` field in its config entry. `replyMode` is `"final"` or `"pre-tool"` and defaults to `"final"`. In `"final"` mode the post-tool (final) text is used, falling back to the alongside-tool text when the final text is empty. In `"pre-tool"` mode the alongside-tool text is preferred, falling back to the final text. The application SHALL NOT discard a substantive post-tool reply for a `"final"` agent.

#### Scenario: Final mode surfaces the post-tool reply

- **WHEN** a `replyMode: final` agent emits a lead-in alongside a tool call and then generates its real answer from the tool result
- **THEN** the user receives the post-tool answer, not the lead-in

#### Scenario: Pre-tool mode keeps the alongside-tool reply

- **WHEN** a `replyMode: pre-tool` agent emits its reply alongside the tool call and the post-tool turn is empty or a bare acknowledgment
- **THEN** the user receives the alongside-tool reply

#### Scenario: Default mode

- **WHEN** an agent entry omits `replyMode`
- **THEN** it behaves as `"final"`
