## 1. Role decoding & navigation gating

- [x] 1.1 Add JWT payload decode helper (no signature verification) to `mods/mobile/lib/auth.ts`, extracting the `roles` claim
- [x] 1.2 Persist decoded roles alongside the token in secure storage; expose via existing auth context/hook
- [x] 1.3 Rehydrate decoded roles on PIN unlock / app resume without re-login
- [x] 1.4 Add root layout logic that mounts the evaluator tab group when roles include `REVIEWER` or `ADMIN`, else the existing collector tab group (dual-role defaults to evaluator, per design.md)
- [x] 1.5 Scaffold `(evaluator)` route group with tab layout: Inicio, Cola, Historial, Buscar
- [x] 1.6 Add a manual collector/evaluator switcher to Perfil for dual-role (COLLECTOR + REVIEWER/ADMIN) users only

## 2. Shared evaluator components (Storybook-first)

- [x] 2.1 Add `m/solicitud-row`, `m/btn-outline`, `m/doc-row`, `m/breakdown-bar`, `m/action-card`, `m/select-field`, `m/score-summary` to the mobile component library ("EVALUATOR APP" section) with RN Storybook stories, per Pencil node `Mcwic`
- [x] 2.2 Verify each component against its Pencil design (screenshot compare) before wiring into screens

## 3. Queue, search, history screens

- [x] 3.0 Port `STATUS_META`/`RISK_BAND_META`/`RECOMMENDATION_META`/`CONFIDENCE_META` + `statusMeta()`/`allowedActions()` from `mods/dashboard/src/lib/applications.ts` into a new `mods/mobile/lib/applications.ts` (Spanish copy already matches Pencil) — shared by all screens in groups 3-8
- [x] 3.1 Build Inicio(Hoy) screen — urgent/near-SLA applications
- [x] 3.2 Build Cola screen — `RECEIVED`/`IN_REVIEW` queue. Backend `listApplications` only accepts a single `status` filter (`mods/apiserver/src/trpc/routers/protected.ts:477`) — issue two parallel queries (RECEIVED, IN_REVIEW) and merge client-side, matching desktop's per-status querying pattern
- [x] 3.3 Build Buscar screen — application search by applicant. No server-side search endpoint exists; do client-side substring filtering over a fetched list, mirroring `mods/dashboard/src/pages/SolicitudesPage.tsx:57-68`. Reuse the recent-searches pattern from `mods/mobile/app/(tabs)/buscar.tsx` (`AsyncStorage` key convention, `testID`s)
- [x] 3.4 Build Historial screen — `REJECTED`/`CONVERTED` applications, same multi-status merge approach as 3.2

## 4. Application detail & scoring

- [x] 4.1 Build 04 Detail/En-evaluación screen — Mikro Score, risk band, category breakdown, confidence, recommendation, suggested questions, "Ver datos de la solicitud" link
- [x] 4.2 Build 04a Datos de la solicitud screen — full applicant/business/loan/housing/reference data + documents + activity
- [x] 4.3 Wire claim action (`claimApplication`) from queue/detail

## 5. Edit & re-score

- [x] 5.1 Build 04c Editar·Negocio screen — tap-a-section-to-edit
- [x] 5.2 Wire edit save to trigger re-score and refresh the detail screen's score display

## 6. Approve / reject

- [x] 6.1 Build 04b Rechazar screen, wire `rejectApplication`
- [x] 6.2 Wire Approve action from detail screen, `approveApplication`
- [x] 6.3 Build 04d Aprobada screen (post-approval state)

## 7. Contract generate & sign

- [x] 7.1 Build 04e Generar contrato screen, wire `generateApplicationContract`
- [x] 7.2 Build 04f Firmada screen — camera capture (`expo-image-picker`) of signed contract, upload via `uploadSignedContract`, collapsed "Convertir" button per design.md

## 8. Convert to loan

- [x] 8.1 Build 04h Convertir a préstamo screen — dedicated loan-terms form, wire `convertApplication`
- [x] 8.2 Build 04g Convertida screen (post-conversion state)

## 9. Tests

- [x] 9.0 `mods/mobile` has no unit test framework configured (no jest/mocha, no `test` script) — pick one consistent with the rest of the monorepo (repo default is mocha/sinon per `openspec/project.md`/bootstrap conventions; confirm it works cleanly with Expo/RN before committing to it, jest is the more common RN choice if mocha proves awkward) and wire up the `test` script before 9.1/9.2
- [x] 9.1 Unit tests for the JWT role-decode helper, including a malformed/missing-roles-claim failure case
- [x] 9.2 Unit tests for navigation gating logic (collector-only, reviewer, admin, dual-role)
- [x] 9.3 E2E: golden path — reviewer logs in, claims a RECEIVED application, approves it, generates + uploads contract, converts to loan
- [x] 9.4 E2E: reject path — reviewer logs in, claims, rejects with a note
- [x] 9.5 Run lint, typecheck, and full test suite; fix until green

## 10. Spec sync & archive

- [x] 10.1 Confirm dual-role default and switcher, and contract-upload mechanism, with user — resolved 2026-07-01 (evaluator-first + manual switcher; camera capture)
- [x] 10.2 Sync delta specs (`mobile-evaluator-access`, `mobile-evaluator-review-flow`) into `openspec/specs/`
- [x] 10.3 Archive `add-evaluator-mobile-role`
