# loan-application-promo-send Specification

## Purpose

TBD - created by archiving change send-intake-flow-outbound. Update Purpose after archive.

## Requirements

### Requirement: Promo is sent on manual creation when opted in

The Nueva Solicitud modal SHALL offer a "Enviar promoción por WhatsApp" option, unchecked by default. When a reviewer saves the application with the option checked and the application has a phone, the system SHALL send the approved `loan_application` WhatsApp template (the promotion, whose call-to-action opens the intake Flow) to that phone via the existing `sendTemplateMessage`, using the configured template name and language code. The send SHALL occur once, after the application is created.

#### Scenario: Opted in with a phone

- **WHEN** a reviewer saves a new application with the promo option checked and a phone present
- **THEN** the application is created
- **AND** the configured template is sent once to that phone
- **AND** the response reports the promo was sent (with the WhatsApp message id)

#### Scenario: Not opted in

- **WHEN** a reviewer saves a new application with the promo option unchecked
- **THEN** the application is created and no WhatsApp message is sent

#### Scenario: Opted in without a phone

- **WHEN** the promo option is checked but the application has no phone
- **THEN** the option cannot be submitted as checked (disabled in the UI)
- **AND** if invoked directly, the application is still created but no message is sent and the response reports the promo was not sent

#### Scenario: WhatsApp send fails

- **WHEN** the WhatsApp API returns an error during the send
- **THEN** the application is still created
- **AND** the response reports a promo send error (the application is not left in a partial state)

### Requirement: Promo send matches the approved template's format

The promo send SHALL match the `loan_application` template's defined format, or WhatsApp rejects it (error 132012). That template has an **image header** and a **Flow CTA button**, so each send SHALL include: the configured language (`en`), a header **image parameter** (a publicly reachable banner URL — WhatsApp does not reuse the template's sample image), and a **Flow button component** carrying a `flow_token`. The banner SHALL be served by the API server from a bundled asset (no external host); its URL defaults to `publicUrl` + the asset route and MAY be overridden in config.

#### Scenario: Send includes image header and Flow button

- **WHEN** the promo is sent for an application with a phone
- **THEN** the template message includes a header image parameter and a Flow button component with a flow token
- **AND** WhatsApp accepts it (no 132012 format error)

#### Scenario: Banner is served by the API server

- **WHEN** the configured promo image URL is empty
- **THEN** the send uses `publicUrl` + the promo asset route
- **AND** the API server serves the bundled banner at that route

#### Scenario: Missing banner is reported, not sent blindly

- **WHEN** no banner image is configured or resolvable
- **THEN** the dashboard surfaces a clear "configure the promo image" error and no malformed send is attempted

### Requirement: Promo send is reviewer-gated

The creation path that triggers a promo send SHALL require reviewer-level authentication. Unauthenticated or non-reviewer callers SHALL receive an authorization error and SHALL NOT trigger a send.

#### Scenario: Unauthenticated call is rejected

- **WHEN** the create-with-promo call is made without a valid reviewer session
- **THEN** the call is rejected with an authorization error
- **AND** no WhatsApp message is sent

### Requirement: Dashboard confirms the send outcome

After saving a new application with the promo option checked, the dashboard SHALL surface the outcome: a confirmation when WhatsApp accepted the message, or a clear error when it did not. The promo option SHALL be disabled when the application has no phone.

#### Scenario: Success confirmation shown

- **WHEN** the create-with-promo call resolves reporting the promo was sent
- **THEN** the dashboard shows a confirmation that the promotion was sent

#### Scenario: Error surfaced

- **WHEN** the create-with-promo call resolves reporting a send error
- **THEN** the dashboard shows a clear error while still reflecting that the application was created

### Requirement: Phone is canonicalized to E.164 for correlation

The system SHALL normalize every loan-application phone to a canonical E.164 string before persistence, so manual, website, and WhatsApp-`from` numbers for the same applicant produce an identical value. This canonical phone SHALL be the key used for promo correlation.

#### Scenario: Equivalent inputs canonicalize identically

- **WHEN** the same Dominican number is entered as "(829) 871-7987" on the dashboard and arrives as "18298717987" from WhatsApp
- **THEN** both normalize to the same E.164 value (e.g. `+18298717987`)

#### Scenario: Unparseable phone yields null

- **WHEN** a phone value cannot be parsed to a valid E.164 number
- **THEN** the stored phone is null and the application is not eligible for promo send

### Requirement: A WhatsApp Flow completion merges into the matching application

When a loan-application Flow is submitted over WhatsApp, the system SHALL look up an existing loan application by the sender's canonical E.164 phone. If one exists, the submission SHALL update that application; otherwise it SHALL create a new application as today.

#### Scenario: Completion updates the originating application

- **WHEN** a reviewer created an application with the promo sent to a phone, and that prospect later completes the Flow
- **THEN** the existing application is updated with the submitted answers
- **AND** no duplicate application is created for that phone

#### Scenario: No prior application creates a new one

- **WHEN** a Flow is completed from a phone that has no existing application
- **THEN** a new application is created, preserving today's behavior

#### Scenario: Multiple matches pick the most recent

- **WHEN** more than one application exists for the sender's phone
- **THEN** the most recently created application is the one updated

### Requirement: Website submissions are unaffected by phone correlation

The public `POST /v1/applications` endpoint SHALL continue to upsert strictly by `sessionId`. Phone-based correlation SHALL apply only to WhatsApp Flow submissions and SHALL NOT cause website submissions sharing a phone to merge.

#### Scenario: Two website submissions with the same phone stay separate

- **WHEN** two website submissions with different `sessionId`s but the same phone are posted
- **THEN** they remain two distinct applications, exactly as today

#### Scenario: Website submission does not merge into a WhatsApp-originated row

- **WHEN** a website submission is posted for a phone that already has an application
- **THEN** the website submission is keyed by its own `sessionId` and does not merge by phone
