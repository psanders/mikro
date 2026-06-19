# solicitud-review-ui Specification

## Purpose

TBD - created by archiving change add-solicitudes-dashboard. Update Purpose after archive.

## Requirements

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

### Requirement: Score breakdown is displayed

The detail SHALL render the Mikro Score from `scoreData` in the rail score card: the score / 100, the risk band (color-accented), and the recommendation. The six category scores SHALL be available via a "Ver desglose e indicadores" toggle, and the evaluator notes SHALL render in the content "Preguntas sugeridas" section.

#### Scenario: Score card and breakdown render

- **WHEN** the detail loads an application with a score
- **THEN** the rail shows score/band/recommendation, and toggling the breakdown reveals the six category scores as labeled bars; evaluator notes render as the interview guide in the content area

### Requirement: Status-adaptive review actions

The detail SHALL offer only the actions valid for the current status and call the corresponding procedures, refreshing the view afterward. Approve/reject/claim live in the rail review card, which includes a review-note field; the note is passed to `approveApplication` on approve.

#### Scenario: Claim/approve/reject from RECEIVED

- **WHEN** the application is `RECEIVED`
- **THEN** claim, approve, and reject actions are available; using one transitions the application and the screen refreshes

#### Scenario: Reject requires a reason

- **WHEN** the reviewer rejects
- **THEN** a reason is required and stored; the application becomes `REJECTED`

#### Scenario: Reopen a decided application

- **WHEN** the application is `APPROVED` or `REJECTED`
- **THEN** a reopen action returns it to `IN_REVIEW`

#### Scenario: Invalid actions are not offered

- **WHEN** the application is in a status where an action is not allowed (e.g. converting a `DRAFT`)
- **THEN** that action is not presented

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

### Requirement: Convert a signed application

The detail SHALL provide a loan-terms form when the application is `SIGNED` and, on submit, convert it; once converted, the linked customer/loan SHALL be shown.

#### Scenario: Convert with loan terms

- **WHEN** the reviewer submits the loan-terms form for a `SIGNED` application
- **THEN** `convertApplication` is called, the application becomes `CONVERTED`, and the linked `customerId`/`loanId` are shown

#### Scenario: Terms prefilled from the request

- **WHEN** the convert form opens
- **THEN** principal and term are prefilled from `requestedAmount`/`requestedTermWeeks` (editable)

### Requirement: Edit a solicitud from the detail

The detail screen SHALL provide an "Editar" action (hidden once `CONVERTED`) that opens a modal with the application's fields grouped by section (Personal / Negocio / Crédito / Referencias / Vivienda), prefilled and editable. Saving calls `updateApplication`, then refreshes the detail and list.

#### Scenario: Open and save edits

- **WHEN** a reviewer clicks "Editar", changes fields, and saves
- **THEN** `updateApplication` is called with the changed fields and the detail refreshes showing the updated data and recomputed score

#### Scenario: Enumerated fields use the form vocabulary

- **WHEN** the edit modal renders enumerated fields (estado civil, tipo de negocio, ventas mensuales, etc.)
- **THEN** they are selects using the same option values as the public form, so the score keeps matching

#### Scenario: Edit hidden after conversion

- **WHEN** the application is `CONVERTED`
- **THEN** the "Editar" action is not shown

### Requirement: Generate a request PDF from the detail

The detail header SHALL provide a "Generar PDF" action that downloads a PDF summary of the application (request) — applicant, business, credit, references, housing, and the Mikro Score summary — so a reviewer can hand it to the field agent who verifies the business. It SHALL be available for any submitted application and replaces the former header "Ver PDF" action.

#### Scenario: Generate the request PDF

- **WHEN** the reviewer clicks "Generar PDF" on a submitted application
- **THEN** the server renders a PDF of the application via the request-PDF capability and the browser downloads it

#### Scenario: Header has no "Ver PDF"

- **WHEN** the detail header renders
- **THEN** it shows "Generar PDF" (and the status-appropriate actions) and does not show a "Ver PDF" button
