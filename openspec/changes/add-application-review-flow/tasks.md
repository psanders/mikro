## 0. Design (Pencil, section 08 of EzobQ)

- [x] 0.1 Wording → final ("diseño final"); notes → Decisiones / Contrato de backend / Fases futuras (capture link + GPS)
- [x] 0.2 Admin "Asignar a…" panel view; reviewer feed shows shared queue
- [x] 0.3 Disbursement panel: add "Cobrador asignado" (conversion requires a collector)
- [x] 0.4 Section 07 "Nueva tarea" as side panel
- [x] 0.5 Export final screens to HTML under this change's `pencil/` folder

## 1. Shared contracts (@mikro/common)

- [x] 1.1 `ApplicationStatus`: add PENDING_DECISION, remove SIGNED; `ApplicationRejectionReason` enum; `ApplicationDocumentKind`
- [x] 1.2 Transition table + `evaluateTransition` + `TransitionBlock` + Spanish labels; delete `resolveReviewTransition`
- [x] 1.3 Input schemas: assign, sendToDecision, returnToReviewer, approve (+terms), reject (+reason), withdraw, convert (+accountId), document upload/delete, recommendation; remove claim/reopen
- [x] 1.4 Config `applications.minBusinessPhotos` (optional, default 3); `mikro.json.example`
- [x] 1.5 `evidenceStatus(app, docs, min)` helper
- [x] 1.6 Exhaustive table-driven tests; barrel exports (schemas/index.ts + root index.ts)

## 2. Database

- [x] 2.1 Prisma schema: new columns, `ApplicationDocument`, enum changes, `CustomerDocumentType` += BUSINESS_PHOTO/OTHER, drop review audit columns
- [x] 2.2 Migration with data moves (design D3) — verified on a scratch DB with every legacy case
- [ ] 2.2b Rehearse the migration on a prod snapshot before release
- [x] 2.3 Integration `SCHEMA_SQL` in sync

## 3. Apiserver

- [x] 3.0 Intake status protection: late autosaves/Flow submissions never walk back or overwrite an application under review; closed ones start a new application (found while wiring `application.received`)

- [x] 3.1 `reviewApplication.ts` → `evaluateTransition`; procedures assign/sendToDecision/returnToReviewer/approve/reject/withdraw
- [x] 3.2 Evidence functions + procedures (upload/replace ID side, add/delete document, set recommendation, get evidence status)
- [x] 3.3 `updateApplication` + ID image endpoints gated to assignee + IN_REVIEW
- [x] 3.4 `uploadSignedContract` no longer flips status; `convertApplication` from APPROVED + contract, principal = approvedAmount, `accountId`, copy business/other docs
- [x] 3.5 Out-of-area intake writes `rejectionReason`; `application.received` from intake/promote/Flow; mappers for new events; drop `application.signed` producer
- [x] 3.6 Role-scoped feed (`scope: "mine"`), current application status joined onto application events
- [x] 3.7 AI summary (`summarizeApplication`, optional model), triggered on received + edit
- [x] 3.8 Abandon job guard (DRAFT only)
- [x] 3.9 ctl commands + ad-quality status sets
- [x] 3.12 Contract prints `approvedAmount` (was requestedAmount — bug) and stores `contractTerms`; conversion refuses terms that differ from the signed contract
- [x] 3.11 `accounting.disbursementAccounts` (id + name, optional; default must be listed) + `listDisbursementAccounts` query with live balances; conversion refuses other accounts
- [x] 3.10 Unit tests per function; integration `applicationLifecycle.test.ts` (happy path, send-back, rejects, withdraw, forbidden roles, locking, abandon guard, events, ledger, documents)

## 4. Ops app UI

- [ ] 4.1 Access: ADMIN full shell, REVIEWER scoped shell
- [ ] 4.2 `SidePanel` primitive; migrate `TaskFormModal`
- [ ] 4.3 Application cards per status/role, violet tokens, disabled reasons, "Cerradas" day grouping
- [ ] 4.4 `ApplicationPanel` views: detail, edit, evidence, disbursement, assign
- [ ] 4.5 Inline admin decision block
- [ ] 4.6 Storybook stories for every component state; `data-testid`s

## 5. End-to-end

- [ ] 5.1 `scripts/seed-e2e.mjs` (deterministic users, accounts, apps in every status)
- [ ] 5.2 Playwright config + specs (reviewer, admin, conversion→Cerradas, scoping, Tareas panel)
- [ ] 5.3 `test:e2e:dashboard` root script; `e2e-dashboard.yaml` workflow; lockfile platform check

## 6. Cutover

- [ ] 6.1 Remove mobile evaluator code, navigation, e2e mocks, Maestro flows; collector app unaffected
- [ ] 6.2 Remove superseded dashboard `lib/applications.ts` helpers
- [ ] 6.3 Mark Pencil Evaluator App board `gzBYk` superseded
- [ ] 6.4 Release notes: deploy order, backup + `migrate deploy`, old mobile builds unsupported

## 7. Verify

- [ ] 7.1 lint, typecheck, all unit + integration + e2e green
- [ ] 7.2 Local walk-through as reviewer and admin against the Pencil export
