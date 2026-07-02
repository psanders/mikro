# copilot-watch-rules Specification

## Purpose

Watch rules created conversationally (Vigilar): threshold rules over a fixed metric set, evaluated periodically, publishing rule.alert feed events on state changes.

## Requirements

### Requirement: Copilot creates watch rules directly

The copilot SHALL support creating watch rules conversationally ("Avísame si la mora de una ruta pasa de 9%") via a `createWatchRule` tool that executes directly (no confirmation step — rules are low-risk and reversible). A rule has a name, a metric from the v1 enum (`mora_pct_portfolio`, `mora_pct_collector`, `cobranza_diaria`), a comparator, a threshold, and an optional collector scope. On creation the dock SHALL render the rule card per the Pencil design ("Regla activa" header, rule description, Editar regla / Desactivar controls). Rule listing and disabling SHALL be available both as copilot tools and as admin tRPC procedures; "Editar regla" prefills the chat rather than opening a form.

#### Scenario: Rule created from chat

- **WHEN** an admin asks the copilot to alert when a metric crosses a threshold
- **THEN** a watch rule is created and the dock shows the active-rule card with its parameters

#### Scenario: Rule disabled from the card

- **WHEN** an admin clicks Desactivar on a rule card
- **THEN** the rule is disabled and no further alerts are produced by it

#### Scenario: Invalid rule parameters are refused

- **WHEN** the model calls `createWatchRule` with a metric outside the v1 enum or a non-numeric threshold
- **THEN** the tool returns a structured validation error and no rule is created

### Requirement: Rules are evaluated periodically and alert on state change

The apiserver SHALL evaluate enabled watch rules on a periodic interval, computing each rule's metric from current business data. A `rule.alert` business event SHALL be recorded only when a rule transitions from not-breached to breached (state change), carrying rule name, metric, observed value, and threshold — surfacing as a feed card. Repeated evaluations of an already-breached rule SHALL NOT produce additional events; a rule that recovers and breaches again SHALL alert again.

#### Scenario: Threshold crossing publishes one alert

- **WHEN** an enabled rule's metric crosses its threshold and the evaluator runs twice while it stays breached
- **THEN** exactly one `rule.alert` event is recorded, visible as a feed card

#### Scenario: Disabled rules are skipped

- **WHEN** the evaluator runs while a rule is disabled
- **THEN** that rule's metric is not evaluated and no event is produced
