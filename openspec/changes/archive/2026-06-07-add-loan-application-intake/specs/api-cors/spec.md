## ADDED Requirements

### Requirement: Public site origin is allowed for application intake

The CORS configuration SHALL permit the public website origin so the loan application form can post to the intake endpoint from the browser. The origin MUST come from `corsAllowedOrigins` configuration, consistent with existing browser clients.

#### Scenario: Form posts from the public site origin

- **WHEN** the website form issues a `POST /v1/applications` with the public site `Origin` listed in `corsAllowedOrigins`
- **THEN** the response includes `Access-Control-Allow-Origin` echoing that origin, so the browser does not block the submission

#### Scenario: Preflight from the public site origin

- **WHEN** the browser sends an `OPTIONS` preflight to `/v1/applications` with the public site `Origin`
- **THEN** the server responds with a success status and the appropriate `Access-Control-Allow-*` headers
