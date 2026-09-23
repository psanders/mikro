## 0. Design (Pencil, section 08 of EzobQ)

- [ ] 0.1 Wording → final ("diseño final"); notes → Decisiones / Contrato de backend / Fases futuras (capture link + GPS)
- [ ] 0.2 Admin "Asignar a…" panel view; reviewer feed shows shared queue
- [ ] 0.3 Disbursement panel: add "Cobrador asignado" (conversion requires a collector)
- [ ] 0.4 Section 07 "Nueva tarea" as side panel
- [ ] 0.5 Export final screens to HTML under this change's `pencil/` folder

## 1. Shared contracts (@mikro/common)

- [ ] 1.1 `ApplicationStatus`: add PENDING_DECISION, remove SIGNED; `ApplicationRejectionReason` enum; `ApplicationDocumentKind`
- [ ] 1.2 Transition table + `evaluateTransition` + `TransitionBlock` + Spanish labels; delete `resolveReviewTransition`
- [ ] 1.3 Input schemas: assign, sendToDecision, returnToReviewer, approve (+terms), reject (+reason), withdraw, convert (+accountId), document upload/delete, recommendation; remove claim/reopen
- [ ] 1.4 Config `applications.minBusinessPhotos` (optional, default 3); `mikro.json.example`
- [ ] 1.5 `evidenceStatus(app, docs, min)` helper
- [ ] 1.6 Exhaustive table-driven tests; barrel exports (schemas/index.ts + root index.ts)

## 2. Database

- [ ] 2.1 Prisma schema: new columns, `ApplicationDocument`, enum changes, `CustomerDocumentType` += BUSINESS_PHOTO/OTHER, drop review audit columns
- [ ] 2.2 Migration with data moves (design D3); rehearse on a prod snapshot
- [ ] 2.3 Integration `SCHEMA_SQL` in sync

## 3. Apiserver

- [ ] 3.1 `reviewApplication.ts` → `evaluateTransition`; procedures assign/sendToDecision/returnToReviewer/approve/reject/withdraw
- [ ] 3.2 Evidence functions + procedures (upload/replace ID side, add/delete document, set recommendation, get evidence status)
- [ ] 3.3 `updateApplication` + ID image endpoints gated to assignee + IN_REVIEW
- [ ] 3.4 `uploadSignedContract` no longer flips status; `convertApplication` from APPROVED + contract, principal = approvedAmount, `accountId`, copy business/other docs
- [ ] 3.5 Out-of-area intake writes `rejectionReason`; `application.received` from intake/promote/Flow; mappers for new events; drop `application.signed` producer
- [ ] 3.6 Role-scoped feed (`scope: "mine"`), current application status joined onto application events
- [ ] 3.7 AI summary (`summarizeApplication`, optional model), triggered on received + edit
- [ ] 3.8 Abandon job guard (DRAFT only)
- [ ] 3.9 ctl commands + ad-quality status sets
- [ ] 3.10 Unit tests per function; integration `applicationLifecycle.test.ts` (happy path, send-back, rejects, withdraw, forbidden roles, locking, abandon guard, events, ledger, documents)

## 4. Founder app UI

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
