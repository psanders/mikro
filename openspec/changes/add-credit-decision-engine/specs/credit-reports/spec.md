## ADDED Requirements

### Requirement: One shared schema validates pushed credit facts

`@mikro/common` SHALL export `creditReportPushSchema`, a discriminated union on `source` (`EQUIFAX`, `PRESTAMOSCLOUD`) used by both the extension and the apiserver. Every push SHALL carry `cedula` (format `###-#######-#`), `capturedAt`, `portalOrigin`, `adapterVersion`, `rawSha256`, optional `applicationId`, and source-specific `facts`.

- **Equifax facts** SHALL include:
  - `identity` (full name, birth date);
  - `bureauScore` (value and label, or null);
  - `inquiries`;
  - `summary`;
  - `accounts` (the shape of `BureauReport` in `mods/creditscore`).
- **PrestamosCloud facts** SHALL include:
  - `identity` (full name, birth date, gender; never the photo);
  - `kpis`:
    - score 300–850 and its label;
    - percent paid on time, with the counts behind it;
    - percent completed;
    - risk factors with their count, maximum and label;
    - `isDelinquent`;
    - active and closed loans;
    - `lenderCount`;
    - `totalLent`, `totalOwed`, `coSignerTotal`;
  - `lenders[]`, each with name, loan count, total lent, total owed and `loans[]`. Each loan has amount, `status`, `uncollectible`, `finalCondition`, `daysLate`, `startDate`, `rating` and `principalOwed`;
  - `inquiries[]`;
  - `comments[]`.

#### Scenario: Valid PrestamosCloud push

- **WHEN** a push has source `PRESTAMOSCLOUD`, cédula `037-0022078-7`, score null ("NO DATOS") and empty lenders
- **THEN** it validates

#### Scenario: Bad cédula

- **WHEN** a push has cédula `03700220787`
- **THEN** validation fails

#### Scenario: Unknown loan status is kept

- **WHEN** a PrestamosCloud loan has a status outside the known enum
- **THEN** it validates with `status` `OTHER` and the original text in `statusRaw`

### Requirement: Reviewers ingest credit reports by cédula

The tRPC procedure `creditReports.ingest` SHALL accept a `creditReportPushSchema` payload from a REVIEWER or ADMIN and store an append-only `CreditReport` with the facts, `rawSha256`, `adapterVersion`, `capturedAt` and `capturedById`. When `applicationId` is given, the application's `idNumber` MUST equal the cédula. Raw portal responses SHALL NOT be stored.

#### Scenario: Reviewer pushes a report

- **WHEN** a reviewer pushes a valid Equifax report for cédula X
- **THEN** a `CreditReport` with source `EQUIFAX` and cédula X is stored with the reviewer as `capturedById`

#### Scenario: Collector cannot ingest

- **WHEN** a user without REVIEWER or ADMIN pushes a report
- **THEN** the request is rejected as forbidden

#### Scenario: Application cédula mismatch

- **WHEN** a push names an application whose `idNumber` differs from the pushed cédula
- **THEN** the request fails with `CEDULA_MISMATCH` and nothing is stored

### Requirement: Reports stay with the person

The current report for a (cédula, source) pair SHALL be the most recent `CreditReport` by `capturedAt`. Any application or customer with that cédula SHALL see it, whether or not the report was pushed against a specific application. `creditReports.listByCedula` SHALL return the report history for a cédula to REVIEWER and ADMIN users.

#### Scenario: Report reused by a later application

- **WHEN** a PrestamosCloud report for cédula X was pushed in September and a new application with `idNumber` X arrives in October
- **THEN** the October application's credit decision uses that report, subject to the policy's `maxAgeDays`
