## ADDED Requirements

### Requirement: Eval turns can be judged by rubric checks

An eval scenario turn MAY list `checks`. Each check SHALL have an `id`, a Spanish yes/no `question` about the agent's reply, and the `expect`ed answer.

When a turn has checks and a decision model is configured, the runner SHALL:

1. Ask all of the turn's checks in one decision request. The input is the earlier turns, the person's message, the reply, and the tools the agent ran.
2. Send an answer with a probability between 0.3 and 0.7 to the LLM judge, which decides it.
3. Ask the LLM for the reason behind every failing answer. Below 0.9 certainty, a disagreeing LLM answer SHALL decide the check.
4. Decide the reply part of the turn by the checks, instead of the similarity check.

#### Scenario: Invented fact fails

- **WHEN** Lucía answers "tenemos pagos diarios, semanales o quincenales" and the turn checks "¿Menciona una frecuencia distinta de semanal, quincenal o mensual?" with expect `false`
- **THEN** the check fails with the LLM's reason, even though the reply is similar to the expected one

#### Scenario: Different wording passes

- **WHEN** José asks "¿me das el número completo de 10 dígitos de Antonio Miguel?" and the check "¿Pide el número completo?" expects `true`
- **THEN** the turn passes, while the similarity check would have failed it

#### Scenario: Unsure answer escalates

- **WHEN** the decision model answers a check with probability 0.55
- **THEN** the LLM judge answers it, and its answer decides the check

### Requirement: The eval CLI can compare judges

`agents:eval` SHALL accept `--judge`:

- `auto` (the default) uses checks when present and configured, else similarity;
- `similarity` uses similarity only;
- `checks` uses the checks;
- `both` computes both and decides by the checks.

#### Scenario: No classifier configured

- **WHEN** `classifier` is absent from mikro.json
- **THEN** every turn is judged by similarity, as before
