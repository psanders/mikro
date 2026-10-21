## ADDED Requirements

### Requirement: Search for admins and reviewers

Admins and reviewers SHALL both see the Búsqueda tab and be able to search customers, loans, events and past loan applications with one query. Other tabs and the copilot dock keep their current admin-only visibility.

#### Scenario: Reviewer searches

- **WHEN** a reviewer opens Búsqueda and types a customer name
- **THEN** matching customers, loans and events are listed

### Requirement: Application matching

Search SHALL return loan applications matching the query by name (every typed word must match the first name, last name or business name, so a full or partial name works), by phone (digits-only comparison, ignoring separators), or by cédula (with or without dashes). Applications in status `DRAFT` or `ABANDONED` SHALL never be returned. Each result SHALL show the applicant, status, and creation date.

#### Scenario: Partial name

- **WHEN** a user searches "juan per"
- **THEN** an application for Juan Pérez is returned

#### Scenario: Cédula without dashes

- **WHEN** a user searches the 11 digits of a cédula stored with dashes
- **THEN** the application with that cédula is returned

#### Scenario: Draft and abandoned excluded

- **WHEN** a DRAFT or ABANDONED application matches the query exactly
- **THEN** it is not returned

#### Scenario: Open the application

- **WHEN** a user clicks an application result
- **THEN** the right-hand application panel opens on it, read-only for statuses with no review action
