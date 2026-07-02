# promo-send-shortcut Specification

## Purpose

TBD - created by archiving change send-promo-shortcut. Update Purpose after archive.

## Requirements

### Requirement: Any authenticated user can send a promo with only a phone number

The system SHALL expose a `sendPromo` tRPC procedure that accepts a phone number and sends the configured `loan_application` WhatsApp template without creating a loan application. The procedure SHALL be available to any authenticated session (not restricted to reviewer role). On success it SHALL return `{ sent: true, messageId }`. On failure it SHALL return `{ sent: false, error }` without throwing.

#### Scenario: Successful standalone promo send

- **WHEN** an authenticated user calls `sendPromo` with a valid phone number
- **THEN** the `loan_application` template is sent to that phone via WhatsApp
- **AND** the response returns `{ sent: true, messageId: <id> }`
- **AND** no loan application is created

#### Scenario: Invalid or missing phone

- **WHEN** `sendPromo` is called with an empty or unparseable phone
- **THEN** the response returns `{ sent: false, error: "La solicitud no tiene teléfono." }`
- **AND** no WhatsApp message is sent

#### Scenario: WhatsApp API error

- **WHEN** the WhatsApp API returns an error during the send
- **THEN** the response returns `{ sent: false, error: <message> }`
- **AND** no application is created or modified

#### Scenario: Unauthenticated call is rejected

- **WHEN** `sendPromo` is called without a valid session
- **THEN** the server returns an UNAUTHORIZED error
- **AND** no message is sent

### Requirement: Flow completion after standalone promo creates a normal application

When a customer completes the WhatsApp Flow form after receiving a standalone promo, the system SHALL create a new loan application via the existing phone-correlation logic in `createSubmitApplicationFromFlow`. If no application exists for that phone, a new one is created. If one already exists, the submission folds into it. This behavior is identical to today and requires no code change.

#### Scenario: No prior application — new one created

- **WHEN** a standalone promo was sent to a phone with no existing application, and the customer completes the Flow
- **THEN** a new loan application is created with the submitted data
- **AND** it appears in the dashboard as a normal application

#### Scenario: Prior application exists — submission folds in

- **WHEN** a prior application exists for the phone, and the customer completes the Flow after a standalone promo
- **THEN** the submission updates the existing application
- **AND** no duplicate application is created
