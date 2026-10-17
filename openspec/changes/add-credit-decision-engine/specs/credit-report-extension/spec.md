## ADDED Requirements

### Requirement: One extension covers Equifax and PrestamosCloud

The Mikro browser extension (`mods/creditscore`) SHALL run on `interactivereports.equifax.com` and `portal.prestamoscloud.com`. It SHALL detect a completed lookup by hooking the portal's own responses, extract the facts with that source's adapter, and validate them with `creditReportPushSchema`. It SHALL NOT call portal endpoints itself.

#### Scenario: Equifax report detected

- **WHEN** an evaluator opens an Equifax interactive report
- **THEN** the panel shows the extracted facts, including identity and Equifax's own score

#### Scenario: PrestamosCloud lookup detected

- **WHEN** an evaluator searches a cédula in Datapréstamos
- **THEN** the panel shows the cédula, name, score, delinquent flag and lender count

### Requirement: All PrestamosCloud lenders are loaded before pushing

PrestamosCloud loads each lender's loans only when that lender is expanded. After a lookup, the extension SHALL expand every lender itself so that the portal fetches each lender's loans, showing progress ("4 de 11 empresas"). It SHALL NOT push until the loans of every listed lender are loaded.

#### Scenario: Lenders still loading

- **WHEN** 11 lenders are listed and 4 have loaded
- **THEN** the panel shows "4 de 11 empresas", and nothing has been sent

### Requirement: Facts are saved to Mikro automatically

When the facts are complete and valid and the evaluator is logged in, the extension SHALL push them with `creditReports.ingest` without a click:

- **The cédula has an application in process** (`RECEIVED`, `IN_REVIEW` or `PENDING_DECISION`): the push attaches to it. A person can have only one application in process (`one-application-per-person`), so there is nothing to choose.
- **No application in process:** the push is stored with the cédula only, and the panel says so.

The panel SHALL then show the application's current Mikro Score, its score before this push, the per-source components, the outcome, the reasons and the next steps. When validation fails, the panel SHALL show "Formato desconocido" and send nothing. The extension SHALL send only facts and the SHA-256 of the raw responses, never the raw responses or the photo.

#### Scenario: Application in process

- **WHEN** a PrestamosCloud lookup for cédula X finishes loading every lender, and X's application in process is 1042
- **THEN** the facts are saved against 1042 with no click, and the panel shows "Guardado en Mikro · automático" plus 1042's new score (e.g. 61 → 34, `REJECT`)

#### Scenario: No open application

- **WHEN** cédula X has no open application
- **THEN** the facts are stored with the cédula, and the panel says that they will be used when this person applies

### Requirement: The evaluator acts from the panel under today's rules

The extension is the evaluator's tool. It SHALL offer only the evaluator's existing review actions, calling the same `reviewApplication` actions and guards as the Ops app. It SHALL NOT add, relax or bypass any rule.

- **Take the application:** when the attached application is `RECEIVED` and the evaluator is a REVIEWER, the panel offers "Tomar solicitud" (the existing self-assign).
- **Reject:** for the assigned evaluator on an `IN_REVIEW` application, with a reason from the fixed list and a note only for `OTHER`. When the decision is `REJECT` from a policy rule, the reason comes preselected as `CREDIT_POLICY` and the panel shows the rule reasons, so no comment is needed.
- **Recommend approval:** for the assigned evaluator on an `IN_REVIEW` application. The panel writes `reviewerRecommendation` and sends the application to decision (`sendToDecision`). Complete evidence and a recommendation are still required, and the panel names whatever is missing.
- **No approve:** approving stays with an ADMIN in Ops.

When the actor isn't allowed (for example, someone else is assigned), the panel shows the score and outcome without actions, and names who has the application. Review events from the panel SHALL carry `via: "extension"`.

#### Scenario: Hard NO rejected from PrestamosCloud

- **WHEN** the assigned evaluator clicks "Rechazar solicitud" on an `IN_REVIEW` application whose decision is `REJECT` with reason `PCLOUD_DELINQUENT`
- **THEN** the application becomes `REJECTED` with reason `CREDIT_POLICY` and the policy reason codes, with no note, and the panel shows "Solicitud #1042 rechazada"

#### Scenario: Evaluator recommends approval from Equifax

- **WHEN** the assigned evaluator writes "Aprobar RD$15,000 a 12 semanas…" and clicks "Enviar a decisión", with complete evidence
- **THEN** the application becomes `PENDING_DECISION` with that recommendation, and an admin decides it in Ops

#### Scenario: Missing evidence blocks sending

- **WHEN** the application has 1 of 3 business photos
- **THEN** "Enviar a decisión" is disabled and reads "faltan 2 fotos", and the next steps list the photos (required today) apart from the optional bureau lookups

#### Scenario: Not the assignee

- **WHEN** an application assigned to Ana is open in Luis's panel
- **THEN** Luis sees the Mikro Score and outcome with no reject or send action, and the panel shows "Asignada a Ana R."

#### Scenario: Not logged in

- **WHEN** the extension has no Mikro token
- **THEN** the panel asks the evaluator to log in from the extension options, and nothing is sent
