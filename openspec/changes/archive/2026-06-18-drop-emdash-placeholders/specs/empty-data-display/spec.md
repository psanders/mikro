## ADDED Requirements

### Requirement: Absent values render empty

The dashboard SHALL render an empty value when data is missing, null, or invalid. It SHALL NOT substitute an em-dash (`"—"`) or any other placeholder glyph for absent data in formatters, key-value rows, detail fields, or list tables.

#### Scenario: Missing field in a detail view

- **WHEN** a key-value field has no value (null/undefined/empty)
- **THEN** the value area is blank, with no em-dash

#### Scenario: Formatter receives empty input

- **WHEN** a shared display formatter (amount, date, label) receives a missing or invalid value
- **THEN** it returns an empty string rather than `"—"`

#### Scenario: Missing cell in a list table

- **WHEN** a table cell (e.g. score, business name) has no value
- **THEN** the cell renders empty, with no em-dash

#### Scenario: No placeholder glyphs remain

- **WHEN** the dashboard source is searched for `"—"` used as a missing-data placeholder
- **THEN** none are found (legitimate prose/labels and interactive select prompts excepted)

### Requirement: Layout is preserved when values are empty

Removing the placeholder SHALL NOT collapse row height or break alignment. Stacked key-value components SHALL reserve their value line height so an empty value keeps the row's size and alignment consistent with populated rows.

#### Scenario: Stacked key-value row with empty value

- **WHEN** a stacked label-over-value field renders an empty value
- **THEN** the row keeps the same height and alignment as a populated row

### Requirement: Prose, labels, and input prompts are unaffected

Em-dashes that are part of human-readable prose, enum labels, or interactive select-prompt options SHALL remain. These are not missing-data placeholders.

#### Scenario: Enum label keeps its dash

- **WHEN** a label such as "Rechazar — fuera de zona" is displayed
- **THEN** its em-dash is preserved

#### Scenario: Select prompt keeps its dash

- **WHEN** a dropdown shows a prompt option such as "— Seleccionar —"
- **THEN** the prompt is preserved
