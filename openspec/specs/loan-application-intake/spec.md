# loan-application-intake Specification

## Purpose

TBD - created by archiving change add-loan-application-intake. Update Purpose after archive.

## Requirements

### Requirement: Public endpoint accepts form submissions

The system SHALL expose a public, unauthenticated `POST /v1/applications` endpoint that accepts the website form's JSON payload, normalizes it, and persists a `LoanApplication`.

#### Scenario: Complete submission is stored as RECEIVED

- **WHEN** a payload with `partial: false` and a `sessionId` is posted
- **THEN** a `LoanApplication` for that `sessionId` is created or updated with status `RECEIVED`
- **AND** the response body is `{ "result": "ok" }`

#### Scenario: Partial submission is stored as DRAFT

- **WHEN** a payload with `partial: true`, a `sessionId`, and a `lastSection` is posted
- **THEN** the `LoanApplication` for that `sessionId` has status `DRAFT` and records `lastSection`
- **AND** the response body is `{ "result": "ok" }`

#### Scenario: No authentication required

- **WHEN** the endpoint is called without an Authorization header
- **THEN** the request is accepted

### Requirement: Submissions upsert by sessionId

The endpoint SHALL coalesce all posts sharing a `sessionId` into a single `LoanApplication`, updating it on each post rather than creating duplicates.

#### Scenario: Repeated posts update one row

- **WHEN** two payloads with the same `sessionId` are posted in sequence
- **THEN** exactly one `LoanApplication` exists for that `sessionId`
- **AND** it reflects the data from the most recent post

#### Scenario: Partial then complete promotes status

- **WHEN** a `partial: true` post is followed by a `partial: false` post for the same `sessionId`
- **THEN** the single row transitions from `DRAFT` to `RECEIVED`

### Requirement: Intake applies safeguards

The endpoint SHALL cap request body size, rate-limit by client IP, and never leak schema details in responses.

#### Scenario: Oversized body is rejected

- **WHEN** a request body exceeds the configured size cap
- **THEN** the request is rejected before persistence

#### Scenario: Validation failure does not leak details

- **WHEN** a payload fails normalization or validation
- **THEN** the failure is logged server-side with the `sessionId`
- **AND** the response does not expose internal schema or error details

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

### Requirement: Final website submissions outside the covered area are auto-rejected

The apiserver SHALL read a required `applications.coveredProvinces` list (province enum values) from `mikro.json` and refuse to boot without it. When `POST /v1/applications` receives a final submission (`partial: false`) whose `province` is set and not in that list, the system SHALL persist the application with status `REJECTED` and `reviewNote` `OUT_OF_COVERAGE_AREA`, SHALL NOT schedule follow-up jobs, SHALL NOT send the Meta Conversions API `Lead` event, and SHALL respond `{ "result": "ok", "outcome": "out_of_area" }`.

#### Scenario: Out-of-area final submission is rejected

- **WHEN** a payload with `partial: false` and `province: "SANTIAGO"` is posted and `coveredProvinces` is `["PUERTO_PLATA"]`
- **THEN** the `LoanApplication` for that `sessionId` has status `REJECTED` and `reviewNote` `OUT_OF_COVERAGE_AREA`
- **AND** no follow-up job is scheduled
- **AND** no Meta CAPI Lead is sent
- **AND** the response body is `{ "result": "ok", "outcome": "out_of_area" }`

#### Scenario: In-area final submission is unchanged

- **WHEN** a payload with `partial: false` and `province: "PUERTO_PLATA"` is posted
- **THEN** the application is stored as `RECEIVED`, a follow-up job is scheduled, a CAPI Lead is sent
- **AND** the response body is `{ "result": "ok" }`

#### Scenario: Partial autosaves never reject

- **WHEN** a payload with `partial: true` and an out-of-area province is posted
- **THEN** the application is stored as `DRAFT`

#### Scenario: Missing config fails boot

- **WHEN** `mikro.json` has no `applications.coveredProvinces`
- **THEN** config validation fails and the apiserver does not start

#### Scenario: WhatsApp intake is unaffected

- **WHEN** an application arrives through the WhatsApp agent or WhatsApp Flow
- **THEN** coverage is not enforced by this requirement
