## ADDED Requirements

### Requirement: Application detail screen

The dashboard SHALL provide a `/solicitudes/:id` screen that loads an application via `getApplication` and shows the header (name + status badge + ISC/risk band), the request summary, and applicant/business info, with the full submission (`rawData`) available in a collapsible view. It SHALL provide a back link to the list.

#### Scenario: Detail loads

- **WHEN** a reviewer opens `/solicitudes/:id`
- **THEN** the application is fetched and its summary, applicant/business info, and status/score are rendered

#### Scenario: Full submission is viewable

- **WHEN** the reviewer expands the full-submission section
- **THEN** all `rawData` fields (spouse, reference, housing, business detail) are shown

### Requirement: Score breakdown is displayed

The detail SHALL render the score breakdown from `scoreData`: ISC, recommendation, the six category scores, hard flags, and the evaluator notes.

#### Scenario: Categories, flags, notes render

- **WHEN** the detail loads an application with a score
- **THEN** the six category scores show as labeled bars, hard flags show as badges, and the evaluator notes list is shown as the interview guide

### Requirement: Status-adaptive review actions

The detail SHALL offer only the actions valid for the current status and call the corresponding procedures, refreshing the view afterward.

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

The detail SHALL let the reviewer upload a signed PDF when the application is `APPROVED` and view/download the stored contract when present.

#### Scenario: Upload signed contract

- **WHEN** the reviewer uploads a PDF for an `APPROVED` application
- **THEN** `uploadSignedContract` is called, the application becomes `SIGNED`, and the screen refreshes

#### Scenario: View stored contract

- **WHEN** a contract is on file
- **THEN** the reviewer can open/download it (via `getApplicationContract`)

### Requirement: Convert a signed application

The detail SHALL provide a loan-terms form when the application is `SIGNED` and, on submit, convert it; once converted, the linked customer/loan SHALL be shown.

#### Scenario: Convert with loan terms

- **WHEN** the reviewer submits the loan-terms form for a `SIGNED` application
- **THEN** `convertApplication` is called, the application becomes `CONVERTED`, and the linked `customerId`/`loanId` are shown

#### Scenario: Terms prefilled from the request

- **WHEN** the convert form opens
- **THEN** principal and term are prefilled from `requestedAmount`/`requestedTermWeeks` (editable)
