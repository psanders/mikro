## ADDED Requirements

### Requirement: The panel follows the system theme

The Mikro Decisión panel and its options page SHALL follow the OS light/dark setting (`prefers-color-scheme`), with no theme switch of their own. The dark colors SHALL match the dashboard's dark tokens, and the danger button SHALL keep a solid red fill.

#### Scenario: OS in dark mode

- **WHEN** the OS is in dark mode and an evaluator does a lookup
- **THEN** the panel renders with the dark palette
