## Why

Reviewers (loan officers who claim, score-review, approve/reject, sign, and convert loan applications) currently only have a desktop flow (`mods/dashboard`). Collectors do this work from the road on the mobile app already. The backend fully supports it — `REVIEWER`/`ADMIN` roles, `reviewerProcedure`-gated tRPC mutations, and the scoring/review/conversion/signing capabilities are all implemented and spec'd. The mobile app just never surfaces any of it: it doesn't decode JWT roles and has no evaluator screens. Reviewers who are out collecting have to switch to a laptop to work their queue, which slows down the 48h-evaluation turnaround the business promises applicants.

## What Changes

- Mobile app decodes `roles` from the JWT after login (`mods/mobile/lib/auth.ts`) and exposes the current user's roles to the navigation layer.
- When the logged-in user's roles include `REVIEWER` or `ADMIN`, the app shows an evaluator tab bar (Inicio/Cola/Historial/Buscar) and evaluator screens instead of (or alongside, for dual-role users) the collector tab bar — same app binary and login/PIN-unlock flow, no separate app.
- New evaluator screens ported from the desktop `SolicitudDetailPage.tsx` flow onto mobile, per the already-locked Pencil designs (flow board `gzBYk`): Inicio(Hoy)/Cola/Buscar queues, application detail with Mikro Score + category breakdown + suggested questions (`04 Detail/En-evaluación`), full request data on a separate screen reached via link (`04a Datos de la solicitud`), Rechazar, Editar·Negocio (tap-a-section-to-edit, re-scores on save), Aprobada, Generar contrato, Firmada, Convertir a préstamo (dedicated form, separate flow from Generar contrato), Convertida, and Historial.
- Evaluator screens call the existing tRPC mutations (`claimApplication`, `approveApplication`, `rejectApplication`, `reopenApplication`, `uploadSignedContract`, `convertApplication`, `generateApplicationContract`) — no new backend endpoints.
- Shared screens (auth, PIN unlock, profile) are not duplicated; evaluator mode reuses them.

## Capabilities

### New Capabilities

- `mobile-evaluator-access`: Decoding roles from the mobile JWT and using them to gate navigation — which tab bar and screens a logged-in user sees based on whether their roles include REVIEWER/ADMIN vs COLLECTOR-only.
- `mobile-evaluator-review-flow`: The evaluator screens and their behavior on mobile — queue/search/history listing, viewing an application's score and data, claiming, editing (re-score on save), approving/rejecting, generating/uploading a signed contract, and converting to a customer + loan, mirroring the desktop capabilities (`loan-application-review`, `loan-application-scoring`, `loan-application-conversion`, `loan-application-signing`) through mobile UI.

### Modified Capabilities

(none — backend review/scoring/conversion/signing behavior is unchanged; this change only adds a mobile consumer of it)

## Impact

- **Affected code**: `mods/mobile` (new evaluator route group + screens, role decoding in `lib/auth.ts`, navigation/tab-bar changes), shared mobile component library additions (already scoped in Pencil under the "EVALUATOR APP" section).
- **Not affected**: `mods/apiserver` (no backend changes — existing `reviewerProcedure`-gated routers are reused as-is), `mods/dashboard` (desktop flow unchanged).
- **Design source**: Pencil (`pencil.pen`) flow board `gzBYk` "Evaluator App / User Flow" — already designed and locked; this change reconciles that design into spec + build, it does not redesign it.
