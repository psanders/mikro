## Why

Many visitors open the website loan application (`/solicitud`) and leave before submitting. The current form is one long accordion that shows all five sections at once, which reads as "a lot of work" and gives no sense of progress. Hypothesis: showing one section at a time with a visible progress indicator motivates applicants to finish.

Separately, Mikro only lends in Puerto Plata today, yet applicants from every province can submit. Those out-of-area applications land as `RECEIVED`, get a WhatsApp nudge, fire a Meta `Lead`, and wait for a human to reject them. The applicant never learns we can't serve them.

## What Changes

- `/solicitud` becomes a **stepper**: the same five sections (same questions, same grouping, same icons), one per screen, with a "Paso X de 5" label, a progress bar, and a row of step icons. Anterior/Siguiente buttons; each step validates its required fields before advancing; the buró consent and the submit button sit on the last step.
- "Monto solicitado" becomes a select (RD$5,000–RD$30,000 in RD$5,000 steps) instead of a free amount, on both routes, so nobody asks for more than Mikro lends. Defaults: RD$10,000 and 10 semanas; Provincia is deliberately left unselected so out-of-area applicants can't default into the covered area.
- The current accordion form moves to **`/solicitud-v0`**, unchanged in behavior, so we can revert or A/B it.
- Both pages share one module for field definitions, option lists, initial state, autosave, submit, Meta tracking, and the result screens — no duplicated form logic.
- New required apiserver config **`applications.coveredProvinces`** (array of province enum values, initially `["PUERTO_PLATA"]`). No default: boot fails without it.
- `POST /v1/applications`: a **final** website submission whose province is not covered is persisted as `REJECTED` with `reviewNote: "OUT_OF_COVERAGE_AREA"`, schedules no follow-up nudge, sends no Meta CAPI Lead, and responds `{ result: "ok", outcome: "out_of_area" }`. Partial autosaves never reject.
- Both site pages: on `outcome: "out_of_area"` they show a "not available in your city yet" screen instead of the success screen and do **not** fire the browser `Lead` pixel.
- Fix: the intake payload schema accepts `fbp`/`fbc: null` (what the site sends when a Meta cookie is absent). Previously such final submissions were dropped as invalid payloads while the applicant saw "Solicitud enviada".
- The province option list moves to the shared `applicationForm` module (single source for the site dropdown, `PROVINCE_LABELS`, and the config enum).

## Capabilities

### New Capabilities

- `solicitud-form`: the public website application form — stepper UI at `/solicitud`, legacy accordion at `/solicitud-v0`, and the out-of-area result screen.

### Modified Capabilities

- `loan-application-intake`: adds coverage-area enforcement on final website submissions.

## Impact

- `mods/common/src/schemas/applicationForm.ts` (province list + coverage helper), `mods/common/src/schemas/application.ts` (`PROVINCE_LABELS` derived), `mods/common/src/config.ts` (new required `applications` section).
- `mods/apiserver/src/api/applications/createUpsertApplication.ts` (optional `coveredProvinces` dep), new `createApplicationIntakeHandler.ts` (the endpoint body, extracted so it is unit-testable), `mods/apiserver/src/index.ts` wiring.
- `site/src/App.tsx`, `site/src/pages/SolicitudPage.tsx` (stepper), `site/src/pages/SolicitudV0Page.tsx` (old accordion), new `site/src/solicitud/*` shared module.
- `mikro.json.example`, test fixtures, config tests.
- **Deploy**: prod `mikro.json` needs `applications.coveredProvinces` added at deploy time of this release (and removed on a rollback), since the config schema is `.strict()`.
- Out of scope: the WhatsApp intake paths (José agent `createSaveAnswer`/`createFinalizeApplication`, WhatsApp Flow `createSubmitApplicationFromFlow`) keep their current behavior; they share `createUpsertApplication` but use an instance without `coveredProvinces`. The scoring engine's own hardcoded `zona_cobertura` is also unchanged.
