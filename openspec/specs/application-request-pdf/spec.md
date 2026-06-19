# application-request-pdf Specification

## Purpose

TBD - created by archiving change refine-solicitud-list-detail. Update Purpose after archive.

## Requirements

### Requirement: Render a loan application as a PDF

The API server SHALL provide an authenticated, reviewer-gated procedure that renders a single loan application as a PDF document, identified by application id. The PDF SHALL summarize the request: applicant identity, business, credit request, references, housing, and the Mikro Score summary (ISC, risk band, recommendation). The renderer SHALL reuse the existing `@mikro/common` PDF/receipt rendering stack rather than introducing a new PDF dependency.

#### Scenario: Generate a request PDF

- **WHEN** a reviewer requests the PDF for an existing application id
- **THEN** the server returns the rendered PDF bytes (e.g. base64) that summarize the application

#### Scenario: Reviewer-gated

- **WHEN** a non-reviewer (no ADMIN/REVIEWER role) requests an application PDF
- **THEN** the request is rejected with a forbidden error and no PDF is produced

#### Scenario: Unknown application

- **WHEN** the requested application id does not exist
- **THEN** the server returns a not-found error

### Requirement: Field-verification oriented content

The rendered request PDF SHALL be suitable for offline use by a field agent verifying the business: it MUST present the applicant and business details in a readable, printable layout, and MUST NOT include sensitive system internals (raw scoring weights are optional; the contract file is not embedded).

#### Scenario: Readable printable layout

- **WHEN** the request PDF is generated
- **THEN** it contains the applicant, business, credit, references, and housing fields in a clearly labeled, printable layout
