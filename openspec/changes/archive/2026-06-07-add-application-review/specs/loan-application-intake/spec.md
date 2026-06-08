## MODIFIED Requirements

### Requirement: Internal procedures expose applications to authenticated staff

The system SHALL provide protected tRPC procedures `listApplications` (with status filter and pagination) and `getApplication` (by id or sessionId), restricted to callers whose roles include `ADMIN` or `REVIEWER`. Applications carry applicant PII (cédula, phone, address, references) and the score, so authenticated users without a review role MUST NOT read them.

#### Scenario: listApplications filters by status

- **WHEN** a reviewer (ADMIN or REVIEWER) requests applications filtered by status `RECEIVED`
- **THEN** only applications with status `RECEIVED` are returned

#### Scenario: getApplication returns one application

- **WHEN** a reviewer requests an application by id or sessionId
- **THEN** the matching application is returned with its stable fields and `rawData`

#### Scenario: Non-reviewer is forbidden

- **WHEN** an authenticated user without `ADMIN` or `REVIEWER` (e.g. only `COLLECTOR`) invokes `listApplications` or `getApplication`
- **THEN** the request is rejected as forbidden

#### Scenario: Unauthenticated is rejected

- **WHEN** an unauthenticated caller invokes `listApplications` or `getApplication`
- **THEN** the request is rejected as unauthorized
