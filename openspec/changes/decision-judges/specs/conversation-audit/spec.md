## MODIFIED Requirements

### Requirement: A rules judge grades each conversation against the agent's policies

For each reviewed conversation, the audit SHALL grade the turns of every agent that wrote in the reviewed window against that agent's own `policies`. A conversation José started and Sofía continued is graded once for José's rules and once for Sofía's. The judge SHALL be told which agent's turns to grade; the other agents' turns are context. At most `maxConversations` conversations are judged per run, most recently active first. The audit SHALL store one finding with source `JUDGE` for each failed policy, attributed to the agent whose rules were graded; a verdict citing another agent's turn SHALL be dropped. The finding carries the policy's severity and rule text, the cited turn when the judge gives one, a quote, and the judge's reason.

Conversations beyond the cap, and conversations whose agents have no policies, SHALL get code checks only. A judge error on one conversation SHALL be counted in the run and SHALL NOT fail the run.

#### Scenario: Policy violation found

- **WHEN** the judge reports that Sofía's "no revelar puntaje ni motivos" policy failed on turn 812
- **THEN** a `JUDGE` finding with that policy's severity, rule text, turn 812 and the quoted text is stored

#### Scenario: Two agents in one conversation

- **WHEN** José repeats a question on turn 278, and Sofía answers later in the same conversation
- **THEN** turn 278 is graded against José's `envia_pronto`, not against Sofía's rules

#### Scenario: Judge cites another agent's turn

- **WHEN** the judge grading Sofía's rules cites a José turn
- **THEN** no finding is stored for that verdict

#### Scenario: Over the cap

- **WHEN** 250 conversations are in the window and `maxConversations` is 200
- **THEN** 200 are judged, all 250 get code checks, and the run records `judgeSkipped: 50`

#### Scenario: Judge failure

- **WHEN** the LLM call fails for one conversation
- **THEN** that conversation keeps its code-check findings, the run's `judgeErrors` increases, and the run completes
