## MODIFIED Requirements

### Requirement: Application detail screen

The dashboard SHALL provide a `/solicitudes/:id` screen that loads an application via `getApplication` and presents it as a two-column layout per Pencil v2 frame `VNNl1`: a flat content card with labeled sections (Solicitante, Negocio, Crédito, Referencias, Vivienda, Contrato, Preguntas sugeridas, Actividad) and a 360px action rail (Mikro Score card, progress stepper, review/decision card). Status reads as the rail stepper rather than a colored badge; accordions are not used. Navigation back to the list SHALL be via the existing chrome (the sidebar "Solicitudes" nav item and the page-header context line); the screen SHALL NOT render a separate "Volver a …" back breadcrumb.

#### Scenario: Detail loads

- **WHEN** a reviewer opens `/solicitudes/:id`
- **THEN** the application is fetched and its content sections plus the rail (score, stepper, review) are rendered

#### Scenario: No back breadcrumb

- **WHEN** the detail renders
- **THEN** no per-screen "Volver a solicitudes" breadcrumb is shown, and the reviewer returns to the list via the sidebar nav

#### Scenario: Status reads as a stepper

- **WHEN** the detail renders
- **THEN** the rail shows the pipeline (Nueva → En evaluación → Aprobada → Firmada → Convertida) with the current step marked, and terminal REJECTED/ABANDONED shown as a terminal state

### Requirement: Sign and view the contract

The detail SHALL let the reviewer upload a signed PDF when the application is `APPROVED`, and SHALL surface the stored contract for download as a link on the document name within the Contrato section once a contract exists (`SIGNED` onward). There is no separate "Ver PDF" control for the stored contract.

#### Scenario: Upload signed contract

- **WHEN** the reviewer uploads a PDF for an `APPROVED` application
- **THEN** `uploadSignedContract` is called, the application becomes `SIGNED`, and the screen refreshes

#### Scenario: Download stored contract from the document name

- **WHEN** a contract is on file (status `SIGNED`/`CONVERTED`)
- **THEN** the Contrato section shows the document name as a link that downloads the stored contract (via `getApplicationContract`)

#### Scenario: No contract yet

- **WHEN** the application has no stored contract (before `SIGNED`)
- **THEN** the Contrato section explains the contract is generated/uploaded at signing and shows no download link

## ADDED Requirements

### Requirement: Generate a request PDF from the detail

The detail header SHALL provide a "Generar PDF" action that downloads a PDF summary of the application (request) — applicant, business, credit, references, housing, and the Mikro Score summary — so a reviewer can hand it to the field agent who verifies the business. It SHALL be available for any submitted application and replaces the former header "Ver PDF" action.

#### Scenario: Generate the request PDF

- **WHEN** the reviewer clicks "Generar PDF" on a submitted application
- **THEN** the server renders a PDF of the application via the request-PDF capability and the browser downloads it

#### Scenario: Header has no "Ver PDF"

- **WHEN** the detail header renders
- **THEN** it shows "Generar PDF" (and the status-appropriate actions) and does not show a "Ver PDF" button
