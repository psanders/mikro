## ADDED Requirements

### Requirement: Eval turns are judged by rubric checks

Every eval scenario turn SHALL list at least one check. Each check SHALL have an `id`, a Spanish yes/no `question` about the agent's reply, and the `expect`ed answer. A turn no longer carries an expected reply (`expectedAI`), and there is no similarity judge.

For each turn the runner SHALL:

1. Ask all of the turn's checks in one decision request. The input is the earlier turns, the person's message, the reply, and the tools the agent ran.
2. Send an answer with a probability between 0.3 and 0.7 to the LLM judge, which decides it.
3. Ask the LLM for the reason behind every failing answer. Below 0.9 certainty, a disagreeing LLM answer SHALL decide the check.
4. Decide the reply part of the turn by the checks.
5. When the decision request fails (timeout, outage), let the LLM judge answer every check of the turn instead of aborting the run.

#### Scenario: Invented fact fails

- **WHEN** Lucía answers "tenemos pagos diarios, semanales o quincenales" and the turn checks "¿Menciona una frecuencia distinta de semanal, quincenal o mensual?" with expect `false`
- **THEN** the check fails with the LLM's reason

#### Scenario: Different wording passes

- **WHEN** José asks "¿me das el número completo de 10 dígitos de Antonio Miguel?" and the check "¿Pide el número completo?" expects `true`
- **THEN** the turn passes, whatever the wording

#### Scenario: Unsure answer escalates

- **WHEN** the decision model answers a check with probability 0.55
- **THEN** the LLM judge answers it, and its answer decides the check

### Requirement: Evals need a decision model and checks on every turn

`agents:eval` SHALL refuse to run without the `classifier` section in mikro.json, with an error that names it. The runner SHALL refuse a scenario with a turn that has no checks, naming the turn, before running it.

#### Scenario: No classifier configured

- **WHEN** `classifier` is absent from mikro.json
- **THEN** `agents:eval` exits with an error asking for the `classifier` section

#### Scenario: A turn without checks

- **WHEN** a scenario's second turn has no checks
- **THEN** the scenario is refused with an error naming turn 2

#### Scenario: Old config key

- **WHEN** an existing mikro.json still has `evals.similarityThreshold`
- **THEN** the config loads and the key is ignored
