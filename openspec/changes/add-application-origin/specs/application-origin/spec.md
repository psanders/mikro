## ADDED Requirements

### Requirement: Every application has a derived origin

The system SHALL derive one origin for each loan application from data already stored on it, with no new stored field:

- `source = FORM` and an `adId` is present → `ad`
- `source = FORM`, no `adId`, created at or after 2026-09-18T02:52:00Z (when ad attribution went live) → `organic`
- `source = FORM`, no `adId`, created before 2026-09-18T02:52:00Z → `unknown`
- `source = WHATSAPP` → `whatsapp`
- `source = MANUAL` → `manual`

The origin SHALL NOT expose which ad, ad set or campaign produced the application.

#### Scenario: Form application from an ad

- **WHEN** an application has `source = FORM` and an `adId`
- **THEN** its origin is `ad`

#### Scenario: Form application without an ad after tracking went live

- **WHEN** an application has `source = FORM`, no `adId`, and was created on 2026-10-01
- **THEN** its origin is `organic`

#### Scenario: Form application from before tracking

- **WHEN** an application has `source = FORM`, no `adId`, and was created on 2026-09-10
- **THEN** its origin is `unknown`

#### Scenario: WhatsApp and manual applications

- **WHEN** an application has `source = WHATSAPP` or `source = MANUAL`
- **THEN** its origin is `whatsapp` or `manual` respectively, whether or not an `adId` is present

### Requirement: The CLI lists and filters applications by origin

`applications:list` SHALL print an `ORIGIN` column with `Form (ad)`, `Form (organic)`, `Form (unknown)`, `WhatsApp` or `Manual`, and SHALL accept `--origin ad|organic|unknown|whatsapp|manual` to list only applications with that origin. The filter SHALL be applied by the server before pagination. `applications:get` SHALL print an `ORIGIN:` line with the same label.

#### Scenario: Listing shows the origin

- **WHEN** an operator runs `applications:list`
- **THEN** each row shows the application's origin label in the `ORIGIN` column

#### Scenario: Filtering by origin

- **WHEN** an operator runs `applications:list --origin ad`
- **THEN** only applications whose origin is `ad` are listed, and pagination counts only those

#### Scenario: Invalid origin filter

- **WHEN** the API receives an origin filter value outside `ad|organic|unknown|whatsapp|manual`
- **THEN** it rejects the request with a validation error and returns no applications

### Requirement: The application PDF shows the origin

The application summary PDF SHALL print the application's origin, in Spanish, in its header next to the date and status.

#### Scenario: Origin in the PDF header

- **WHEN** the PDF is generated for an application whose origin is `organic`
- **THEN** its header reads `<date> · <status> · Formulario (orgánico)`

### Requirement: The CLI shows a customer's origin

`customers:get` SHALL print an `ORIGIN:` line with the origin of the application that was converted into this customer (the most recent one if there are several). When no converted application links to the customer, it SHALL print `—`.

#### Scenario: Customer converted from an ad application

- **WHEN** an operator runs `customers:get` for a customer whose converted application's origin is `ad`
- **THEN** it prints `ORIGIN: Form (ad)`

#### Scenario: Customer without an application

- **WHEN** an operator runs `customers:get` for a customer created directly, with no converted application
- **THEN** it prints `ORIGIN: —`
