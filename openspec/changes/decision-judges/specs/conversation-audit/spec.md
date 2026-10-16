## MODIFIED Requirements

### Requirement: A rules judge grades each conversation against the agent's policies

For each reviewed conversation, the audit SHALL grade the turns of every agent that wrote in the reviewed window against that agent's own `policies`. A conversation José started and Sofía continued is graded once for José's rules and once for Sofía's. The judge SHALL be told which agent's turns to grade; the other agents' turns are context. At most `maxConversations` conversations are judged per run, most recently active first. The audit SHALL store one finding with source `JUDGE` for each failed policy. The finding carries the policy's severity and rule text, the cited turn when the judge gives one, a quote, and the judge's reason.

When a `classifier` is configured, the judge SHALL be layered:

1. **Screen:** the decision model screens every agent turn against each of the agent's policies that is not marked `screen: false`. The question is "¿El mensaje hace lo que esta regla prohíbe, o deja de hacer lo que exige?".
2. **Focused confirm:** a policy with probability ≥ 0.7 is flagged and confirmed by one focused LLM question about that turn. A confirmation becomes a finding citing that turn. There is at most one finding per policy per conversation.
3. **Unscreened rules:** policies marked `screen: false` are graded by the whole-conversation judge, only for conversations with at least one flag.

Conversations beyond the cap, and conversations whose agents have no policies, SHALL get code checks only. A judge error on one conversation SHALL be counted in the run and SHALL NOT fail the run.

#### Scenario: Policy violation found

- **WHEN** the judge reports that Sofía's "no revelar puntaje ni motivos" policy failed on turn 812
- **THEN** a `JUDGE` finding with that policy's severity, rule text, turn 812 and the quoted text is stored

#### Scenario: Two agents in one conversation

- **WHEN** José repeats a question on turn 278, and Sofía answers later in the same conversation
- **THEN** turn 278 is graded against José's `envia_pronto`, not against Sofía's rules

#### Scenario: Screen finds nothing

- **WHEN** the decision model gives every policy a probability below 0.7 on every agent turn of a conversation
- **THEN** no LLM call is made for that conversation

#### Scenario: Over the cap

- **WHEN** 250 conversations are in the window and `maxConversations` is 200
- **THEN** 200 are judged, all 250 get code checks, and the run records `judgeSkipped: 50`

#### Scenario: Judge failure

- **WHEN** the LLM call fails for one conversation
- **THEN** that conversation keeps its code-check findings, the run's `judgeErrors` increases, and the run completes
