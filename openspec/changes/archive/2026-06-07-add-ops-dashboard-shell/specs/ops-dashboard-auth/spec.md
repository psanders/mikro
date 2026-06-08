## ADDED Requirements

### Requirement: Operator login with phone and password

The dashboard SHALL allow an operator to log in with a phone number in E.164 format and a password, authenticating against the existing API auth procedure. On success it MUST obtain a JWT; on failure it MUST surface an error and remain unauthenticated.

#### Scenario: Successful login

- **WHEN** an operator submits a valid E.164 phone and correct password
- **THEN** the API returns a JWT, the dashboard stores it, and the operator enters the authenticated area

#### Scenario: Invalid credentials

- **WHEN** an operator submits credentials the API rejects
- **THEN** the dashboard shows an authentication error and the operator remains on the login view with no token stored

### Requirement: Token storage and session persistence

The dashboard SHALL persist the JWT so the operator's session survives an application restart, and MUST restore the authenticated session on launch when a valid stored token exists.

#### Scenario: Session restored on relaunch

- **WHEN** an operator with a previously stored, unexpired token reopens the dashboard
- **THEN** the dashboard restores the authenticated session without requiring re-login

### Requirement: Bearer token attached to API requests

The dashboard SHALL attach the stored JWT as an `Authorization: Bearer <token>` header on every tRPC request to `@mikro/apiserver`, reusing the established client pattern.

#### Scenario: Authenticated request carries the token

- **WHEN** the dashboard issues a tRPC request while authenticated
- **THEN** the request includes the `Authorization: Bearer <token>` header with the stored JWT

#### Scenario: No token when unauthenticated

- **WHEN** the dashboard issues a request while no token is stored
- **THEN** the request is sent without an `Authorization` header

### Requirement: Logout and token expiry handling

The dashboard SHALL provide a logout action that clears the stored token and returns the operator to the login view, and MUST treat a `401 Unauthorized` API response as an expired session by clearing the token and prompting re-login.

#### Scenario: Explicit logout

- **WHEN** an authenticated operator invokes logout
- **THEN** the stored token is cleared and the operator is returned to the login view

#### Scenario: Expired token triggers re-login

- **WHEN** an API request returns `401 Unauthorized`
- **THEN** the dashboard clears the stored token and returns the operator to the login view
