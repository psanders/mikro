## ADDED Requirements

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

### Requirement: Inicio panel has a "Enviar Promoción" button that opens a phone-only modal

The Inicio (OverviewPage) SHALL render a "Enviar Promoción" button in the `PageHeader` action slot. Clicking it SHALL open `SendPromoModal`, a modal with a single phone-number input. The modal SHALL reuse the existing `applyFormat("phone", …)` and `formatError("phone", …)` utilities for formatting and inline validation. The send button SHALL be disabled until a valid phone is entered.

#### Scenario: Button visible in Inicio header

- **WHEN** an authenticated user navigates to the Inicio page
- **THEN** a "Enviar Promoción" button is visible in the top-right of the page header

#### Scenario: Modal opens on click

- **WHEN** the user clicks "Enviar Promoción"
- **THEN** `SendPromoModal` opens with a phone input field and a disabled send button

#### Scenario: Send button enables on valid phone

- **WHEN** the user enters a valid Dominican phone number
- **THEN** the send button becomes enabled

#### Scenario: Send button stays disabled on invalid phone

- **WHEN** the user enters a malformed phone (e.g., "123")
- **THEN** the send button remains disabled and a validation error is shown inline

### Requirement: Dashboard shows toast feedback after standalone promo send

After calling `sendPromo`, the dashboard SHALL surface the outcome as a toast notification. On success it SHALL show a confirmation message. On failure it SHALL show the error. The modal SHALL close immediately when the user submits (before the response settles).

#### Scenario: Success toast shown

- **WHEN** `sendPromo` resolves with `{ sent: true }`
- **THEN** a success toast appears with a confirmation message (e.g., "Promoción enviada")
- **AND** the modal is already closed

#### Scenario: Error toast shown

- **WHEN** `sendPromo` resolves with `{ sent: false, error }`
- **THEN** an error toast appears with the error message
- **AND** the modal is already closed

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
