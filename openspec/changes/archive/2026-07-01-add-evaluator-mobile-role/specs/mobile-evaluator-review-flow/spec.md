## ADDED Requirements

### Requirement: Evaluator views a queue of applications

The evaluator's "Cola" screen SHALL list applications in `RECEIVED` or `IN_REVIEW` status, and the "Inicio" screen SHALL surface applications needing urgent attention (approaching the 48h evaluation window).

#### Scenario: Reviewer opens Cola

- **WHEN** a reviewer opens the Cola screen
- **THEN** applications with status `RECEIVED` or `IN_REVIEW` are listed

### Requirement: Evaluator searches applications

The evaluator's "Buscar" screen SHALL let the reviewer find an application by applicant name or identifying detail, regardless of status.

#### Scenario: Reviewer searches by applicant name

- **WHEN** a reviewer enters an applicant's name in Buscar
- **THEN** matching applications across statuses are returned

### Requirement: Evaluator views an application's score and decision summary

Opening an application from the queue, search, or history SHALL show its Mikro Score (0–100), risk band, six-category breakdown, confidence, recommendation, and suggested questions, per `loan-application-scoring`.

#### Scenario: Reviewer opens a scored application

- **WHEN** a reviewer opens an application that has been scored
- **THEN** the screen shows the Mikro Score, risk band, category breakdown, confidence, recommendation, and suggested questions

### Requirement: Evaluator views full application data on a separate screen

The full applicant/business/loan/housing/reference data and documents SHALL be reachable from the score/decision screen via a "Ver datos de la solicitud" link, not shown inline on the decision screen.

#### Scenario: Reviewer opens request data

- **WHEN** a reviewer taps "Ver datos de la solicitud" from the decision screen
- **THEN** the full applicant, business, loan, housing, reference, and document data is shown on a dedicated screen

### Requirement: Evaluator claims a RECEIVED application

The evaluator app SHALL let a reviewer claim a `RECEIVED` application, calling the existing `claimApplication` mutation, per `loan-application-review`.

#### Scenario: Reviewer claims an application

- **WHEN** a reviewer taps Claim on a `RECEIVED` application
- **THEN** the app calls `claimApplication` and the application moves to `IN_REVIEW`

### Requirement: Evaluator edits business info with re-score on save

The "Editar·Negocio" screen SHALL let a reviewer edit a section of business data and re-score the application on save (tap-a-section-to-edit).

#### Scenario: Reviewer edits and saves a section

- **WHEN** a reviewer edits a business data section and saves
- **THEN** the application is re-scored and the updated score is reflected on the decision screen

### Requirement: Evaluator approves or rejects an application

The evaluator app SHALL let a reviewer approve or reject an application with an optional note, calling the existing `approveApplication`/`rejectApplication` mutations, per `loan-application-review`.

#### Scenario: Reviewer approves an application

- **WHEN** a reviewer approves a `RECEIVED` or `IN_REVIEW` application, optionally with a note
- **THEN** the app calls `approveApplication` and the application moves to `APPROVED`

#### Scenario: Reviewer rejects an application

- **WHEN** a reviewer rejects an application via the Rechazar screen, optionally with a note
- **THEN** the app calls `rejectApplication` and the application moves to `REJECTED`

### Requirement: Evaluator generates and uploads a signed contract

The evaluator app SHALL let a reviewer generate an application's contract and separately upload the signed version, calling the existing `generateApplicationContract`/`uploadSignedContract` mutations, per `loan-application-signing`. Generar contrato and the signed upload SHALL be presented as separate flows behind dedicated screens/buttons, not inline forms. The signed contract SHALL be captured via the device camera (photo of the physical signed document).

#### Scenario: Reviewer generates a contract

- **WHEN** a reviewer taps "Generar contrato" on an `APPROVED` application
- **THEN** the app calls `generateApplicationContract` and the contract becomes available

#### Scenario: Reviewer uploads a signed contract via camera

- **WHEN** a reviewer photographs the signed contract using the device camera for an `APPROVED` application
- **THEN** the app calls `uploadSignedContract` with the captured photo and the application moves to `SIGNED`

### Requirement: Evaluator converts a signed application into a customer and loan

The "Convertir a préstamo" screen SHALL let a reviewer convert a `SIGNED` application into a Customer + Loan using operator-supplied loan terms, calling the existing `convertApplication` mutation, per `loan-application-conversion`. Convertir SHALL be a dedicated screen reached via a button, kept separate from the contract flow.

#### Scenario: Reviewer converts a signed application

- **WHEN** a reviewer submits loan terms on the Convertir a préstamo screen for a `SIGNED` application
- **THEN** the app calls `convertApplication` and the application moves to `CONVERTED`

### Requirement: Evaluator views completed applications in Historial

The "Historial" screen SHALL list applications in terminal states (`REJECTED`, `CONVERTED`) that the reviewer has handled.

#### Scenario: Reviewer opens Historial

- **WHEN** a reviewer opens the Historial screen
- **THEN** applications in `REJECTED` or `CONVERTED` status are listed
