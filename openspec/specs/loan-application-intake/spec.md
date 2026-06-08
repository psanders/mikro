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
