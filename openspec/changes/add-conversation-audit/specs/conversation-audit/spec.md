## ADDED Requirements

### Requirement: Audit is enabled and scheduled from config

The apiserver SHALL read a `conversationAudit` section from `mikro.json`:

- `enabled`: default `false`.
- `schedule`: a 5-field cron expression evaluated in `timezone`, default `0 7 * * *`.
- `maxConversations`: a positive integer, default 200.

When `enabled` is true, the apiserver SHALL run the audit on `schedule`. When `enabled` is false, no scheduled run SHALL happen. The section SHALL be optional. Unknown keys inside it SHALL be rejected, like the rest of the strict config.

#### Scenario: Scheduled run when enabled

- **WHEN** `conversationAudit.enabled` is true and the cron fires
- **THEN** an audit run with trigger `SCHEDULED` executes and posts a `conversation.audited` feed event

#### Scenario: Disabled by default

- **WHEN** `mikro.json` has no `conversationAudit` section
- **THEN** the config resolves to `enabled: false, schedule: "0 7 * * *", maxConversations: 200` and no scheduled run happens

### Requirement: Each run reviews conversations with new turns since the last completed run

A run SHALL review conversation turns whose id is greater than the `lastTurnId` of the latest `DONE` run. When no `DONE` run exists, it SHALL review turns created in the last 24 hours. Turns SHALL be grouped into conversations by phone. A run with no new turns SHALL still complete and post a card reporting zero conversations.

#### Scenario: No turn reviewed twice

- **WHEN** a run completes after reviewing turns up to id 500, and a later run starts
- **THEN** the later run reviews only turns with id greater than 500

#### Scenario: First run

- **WHEN** no completed run exists
- **THEN** the run reviews the turns from the last 24 hours

### Requirement: Code checks flag deterministic problems

Every reviewed conversation SHALL pass through the code-check registry. Each hit SHALL be stored as a finding with source `CODE`, the check's severity, the turn id, and the turn text as evidence. The v1 checks are:

- `failed_send` (warning): an AGENT or SYSTEM turn whose send failed.
- `error_reply` (warning): the generic processing-error reply was sent.
- `handoff_ignored` (warning): an explicit request for a person, detected with the same matcher the handler uses, with no hand-off opened for that phone between 1 minute before and 10 minutes after the request.
- `jose_turn_cap` (warning): more delivered José turns for one application than the handler's turn cap allows.
- `sensitive_score` (critical): an agent reply to a non-staff person that states a score or band with a number.

#### Scenario: Failed send becomes a finding

- **WHEN** a reviewed conversation has an AGENT turn with `failed = true`
- **THEN** a `failed_send` warning finding cites that turn

#### Scenario: Hand-off request honored

- **WHEN** a person writes "quiero hablar con una persona" and a hand-off was opened for that phone within the next 10 minutes
- **THEN** no `handoff_ignored` finding is created

#### Scenario: Score leaked

- **WHEN** an agent reply to an APPLICANT says "Tu puntaje Mikro es 74"
- **THEN** a `sensitive_score` critical finding cites that turn

### Requirement: A rules judge grades each conversation against the agent's policies

For each reviewed conversation, the audit SHALL ask the evals LLM to grade the transcript against the `policies` of the agent that served it. At most `maxConversations` conversations are judged per run, most recently active first. The audit SHALL store one finding with source `JUDGE` for each failed policy. The finding carries the policy's severity and rule text, the cited turn when the judge gives one, a quote, and the judge's reason.

Conversations beyond the cap, and conversations whose agent has no policies, SHALL get code checks only. A judge error on one conversation SHALL be counted in the run and SHALL NOT fail the run.

#### Scenario: Policy violation found

- **WHEN** the judge reports that Sofía's "no revelar puntaje ni motivos" policy failed on turn 812
- **THEN** a `JUDGE` finding with that policy's severity, rule text, turn 812 and the quoted text is stored

#### Scenario: Over the cap

- **WHEN** 250 conversations are in the window and `maxConversations` is 200
- **THEN** 200 are judged, all 250 get code checks, and the run records `judgeSkipped: 50`

#### Scenario: Judge failure

- **WHEN** the LLM call fails for one conversation
- **THEN** that conversation keeps its code-check findings, the run's `judgeErrors` increases, and the run completes

### Requirement: Runs and findings are stored with agent versions

Each run SHALL be stored with:

- its trigger, actor, status and window;
- its counts: conversations, turns, hand-offs opened in the window, failed sends, critical, warning, judged, judge-skipped, and judge errors;
- a per-agent breakdown: agent name, profile, `agent_version`, conversations, critical, and warning.

Each finding SHALL keep the phone, the application and customer ids when known, the profile, the agent name, and the `agent_version`.

#### Scenario: Drift visible by version

- **WHEN** Sofía's prompt changed between two runs
- **THEN** each run's per-agent breakdown shows Sofía's `agent_version` for that run, so the two runs can be compared

### Requirement: Only one run at a time

A run SHALL NOT start while another run is `RUNNING` and started less than 30 minutes ago; the start SHALL fail with a structured error instead. A `RUNNING` run that started more than 30 minutes ago SHALL be marked `FAILED`, and the new run SHALL proceed.

#### Scenario: Concurrent start rejected

- **WHEN** the copilot asks for a run while the scheduled run is still in progress
- **THEN** the request returns "Ya hay una auditoría en curso" and no second run is created
