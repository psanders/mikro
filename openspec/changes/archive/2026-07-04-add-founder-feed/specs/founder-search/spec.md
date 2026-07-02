# founder-search — delta

## ADDED Requirements

### Requirement: Universal search across clients, loans, and events

The apiserver SHALL expose an admin-only search query that takes a free-text term and returns grouped results: matching customers (by name, phone, or id number), matching loans (by human loan id or customer), and matching feed events (by summary text and denormalized names). Result groups SHALL be capped per group (offset/limit convention) and returned together in one response.

#### Scenario: Search by client name returns grouped results

- **WHEN** an admin searches a client's first name
- **THEN** the response contains the matching clients, their loans, and recent events referencing them, in separate groups

#### Scenario: Non-admin search is rejected

- **WHEN** an authenticated user without the ADMIN role calls the search query
- **THEN** the request is rejected with an authorization error

### Requirement: Search screen with grouped results and inline navigation

The founder app SHALL provide a search view at `/founder/buscar`, available to ADMIN users, rendered in the founder shell and visually matching the Pencil search screen, with a single input that queries the universal search and renders the grouped results (CLIENTES, PRÉSTAMOS, EN EL FEED). Each result row SHALL link to its entity: client rows to the client detail, loan rows to the loan's context, event rows expandable in place or linking to their subject. Searching SHALL not require picking an entity type first.

#### Scenario: One input, grouped output

- **WHEN** an admin types a term in the search input
- **THEN** results render grouped under CLIENTES, PRÉSTAMOS, and EN EL FEED headings, each row navigable to its entity

#### Scenario: No results

- **WHEN** a search term matches nothing
- **THEN** an empty state is shown for the query rather than blank groups
