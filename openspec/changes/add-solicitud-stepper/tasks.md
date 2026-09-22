## 1. Shared contracts (@mikro/common)

- [x] 1.1 Move the province list to `applicationForm.ts` (`PROVINCES`, `PROVINCE_VALUES`) + `normalizeProvinceKey` + `isOutOfCoverageArea`; derive `PROVINCE_LABELS` from it
- [x] 1.2 Add required `applications.coveredProvinces` to `mikroConfigSchema`; update `mikro.json.example`, test fixtures, test configs
- [x] 1.3 Config tests: missing section / empty list / unknown province rejected; valid accepted
- [x] 1.4 Accept `null` tracking cookies (`fbp`/`fbc`) in the intake payload schema (pre-existing bug found during verification)

## 2. Apiserver

- [x] 2.1 `createUpsertApplication`: optional `coveredProvinces` dep → REJECTED + `OUT_OF_COVERAGE_AREA` on final out-of-area submit, no follow-up
- [x] 2.2 Extract endpoint body to `createApplicationIntakeHandler`; skip CAPI and return `outcome: "out_of_area"` on rejection
- [x] 2.3 Wire a coverage-enforcing upsert instance for the website intake only
- [x] 2.4 Unit tests for 2.1 and 2.2

## 3. Site

- [x] 3.1 Extract shared module `site/src/solicitud/` (form config, section fields, `useSolicitud` hook, result screens + consent block)
- [x] 3.2 Move accordion to `SolicitudV0Page.tsx` at `/solicitud-v0` on the shared module
- [x] 3.3 New stepper `SolicitudPage.tsx` at `/solicitud`
- [x] 3.4 Out-of-area screen; no `trackLead` on out-of-area
- [x] 3.5 "Monto solicitado" becomes a select: RD$5,000–RD$30,000 in RD$5,000 steps (both routes)

## 4. Verify

- [x] 4.1 lint, typecheck, tests, site build, check-links
- [x] 4.2 Local walk-through on both routes (Santiago → warning/REJECTED/no Lead; Puerto Plata → success/RECEIVED/Lead)

## 5. Design

- [x] 5.1 Pencil screens for the stepper (Paso 1, Paso 5) + out-of-area state, mobile and desktop (in the main checkout's pencil.pen)
- [ ] 5.2 User sign-off on the design
