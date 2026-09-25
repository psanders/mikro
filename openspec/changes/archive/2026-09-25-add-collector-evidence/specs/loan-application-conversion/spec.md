## ADDED Requirements

### Requirement: Conversion copies the map link to the customer

Converting an application SHALL copy its `mapUrl` to the customer, on the same transaction. Customers gain an optional `mapUrl` column. A reused customer's link SHALL be replaced only when the application has one.

#### Scenario: New customer gets the link

- **WHEN** an application with a map link is converted into a new customer
- **THEN** the customer's `mapUrl` equals the application's

#### Scenario: Existing link kept when the application has none

- **WHEN** a returning customer with a map link converts an application without one
- **THEN** the customer's `mapUrl` is unchanged
