## Context

The website form lives in `site/src/pages/SolicitudPage.tsx` (~1000 lines, accordion). Autosave, the pagehide beacon, Meta pixel events and ad attribution are all inline. The apiserver endpoint body lives inline in `mods/apiserver/src/index.ts`, which makes the CAPI side effect untestable.

## Decisions

1. **Shared site module** `site/src/solicitud/`: field components + option lists + per-section field renderer, a `useSolicitud` hook owning form state, sessionId, autosave, the pagehide beacon, section-progress tracking and submit, and the result screens (success + out-of-area). Both pages are thin layouts over these.
2. **Coverage is config, not code**: `applications.coveredProvinces: z.array(z.enum(PROVINCE_VALUES)).min(1)`, required (no `.default`) so a missing key fails boot, matching `accounting.disbursementAccountId`.
3. **Enforce inside `createUpsertApplication`, opt-in by dependency**: the website intake gets its own instance built with `coveredProvinces`; the WhatsApp paths keep an instance without it, so their behavior is untouched. The upsert writes `status: REJECTED`, `reviewNote: "OUT_OF_COVERAGE_AREA"`, `reviewedAt: now`, `reviewedById: null` (system decision), and skips `scheduleFollowUpJob`.
4. **Missing province never rejects**: a final submit without a province (shouldn't happen from the form, it's required) is treated as in-area — we only reject on a positive out-of-area signal.
5. **Province comparison** normalizes both sides (uppercase, diacritics stripped, non-alphanumerics → `_`) so "Puerto Plata" and "PUERTO_PLATA" match — the same rule the scorer uses.
6. **Endpoint extracted** to `createApplicationIntakeHandler({ upsertApplication, sendLeadConversion })` so tests can assert "no CAPI call" for out-of-area.
7. **Response contract** stays `result: "ok"`; `outcome: "out_of_area"` is additive. Old cached site bundles ignore it (they'd show success — acceptable, and the row is still rejected).
8. **Stepper validation** uses the shared `APPLICATION_SECTIONS.requiredFields` to gate "Siguiente" and highlights missing fields; it does not rely on native `required` (hidden steps can't be validated by the browser).
9. **Autosave on step change** reuses `buildAutosavePayload` with `lastSection` = the step being left — identical payload shape to the accordion's toggle autosave, so the form-completeness report keeps working.

## Risks

- Deploy/rollback ordering of the new required config key (see proposal Impact).
- The Pencil frames live in the main checkout's `pencil.pen` (the file open in the Pencil app, which also carries another session's uncommitted edits), so they are not part of this change's diff and need committing from there.
- Pre-existing: the payload schema rejected `fbp`/`fbc: null`, silently dropping final submissions without Meta cookies (answered "ok", row left DRAFT). Fixed here by making tracking keys nullish; without it, out-of-area rejection could not fire for those visitors either.
