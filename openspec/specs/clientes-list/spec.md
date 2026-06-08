# clientes-list Specification

## Purpose

TBD - created by archiving change add-clientes-dashboard. Update Purpose after archive.

## Requirements

### Requirement: Customers list screen

The dashboard SHALL provide a `/clientes` screen that lists customers from `listCustomers`, rendering columns drawn from the fields the procedure actually returns on the `Customer` model: name (with nickname), phone, cédula (`idNumber`), home address, and active state. The screen MUST NOT render columns for data the procedure does not return (e.g. collector/referrer names, since only their IDs are available).

#### Scenario: List loads and renders

- **WHEN** an authenticated operator navigates to `/clientes`
- **THEN** customers are fetched via `listCustomers` and rendered one row each with the documented columns

#### Scenario: Loading, error, empty states

- **WHEN** the query is loading, fails, or returns no rows
- **THEN** the screen shows a loading indicator, an error message, or an empty-state respectively

#### Scenario: Row opens the detail

- **WHEN** the operator clicks a customer row
- **THEN** the app navigates to `/clientes/:id` for that customer

### Requirement: Active/inactive segmentation

The list SHALL provide segment tabs (Todos / Activos / Inactivos) backed by the `showInactive` parameter. By default `listCustomers` returns only active customers, so the default tab MUST reflect that behavior.

#### Scenario: Default shows active customers

- **WHEN** the operator opens `/clientes` without changing the segment
- **THEN** the query runs without `showInactive` and only active customers are shown

#### Scenario: Inactive segment includes inactive customers

- **WHEN** the operator selects a segment that includes inactive customers
- **THEN** the query is issued with `showInactive: true` and inactive customers appear

### Requirement: Server-side search

The list SHALL provide a search input that drives the `listCustomers` `search` parameter (server-side match over name, nickname, and phone). Because the procedure requires at least 2 characters, the screen MUST only issue a search once the input has 2 or more characters.

#### Scenario: Search narrows results

- **WHEN** the operator types 2 or more characters
- **THEN** the query is re-issued with the `search` param and the list shows the server-filtered matches

#### Scenario: Short input does not search

- **WHEN** the operator's search input has fewer than 2 characters
- **THEN** no `search` param is sent and the unfiltered list (for the current segment) is shown

### Requirement: Pagination

The list SHALL support loading additional pages via a "Cargar más" control using the `limit`/`offset` parameters, appending the next page to the existing rows.

#### Scenario: Load more appends

- **WHEN** a full page was returned and the operator clicks "Cargar más"
- **THEN** the next page is fetched with an increased `offset` and appended to the list
