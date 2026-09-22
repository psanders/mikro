# Ship checkpoint — add-solicitud-stepper

Started: 2026-09-22
Current stage: 6 — Archive (done) · change complete

**Scope:** `/solicitud` becomes a one-section-per-screen stepper with visible progress (same questions, grouping and icons); the old accordion stays at `/solicitud-v0`. Both routes share one module. A new required `applications.coveredProvinces` config makes the website intake auto-reject final out-of-area submissions (REJECTED + `OUT_OF_COVERAGE_AREA`, no nudge, no Meta Lead) and the site shows a "not in your city yet" screen.

**Detected surfaces:** OpenSpec: yes · Pencil: yes · Storybook: no (site has none) · E2E: no (no Playwright for the site)

| #   | Stage           | Status      | Notes                                                                                                                                       |
| :-- | :-------------- | :---------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | Frame           | done        | Change `add-solicitud-stepper` written + validated                                                                                          |
| 1   | Design (Pencil) | done        | 8 frames approved by user 2026-09-22; committed to pencil.pen in the wrap-up PR
| 2   | Spec reconcile  | done        | Design matched the delta specs; no behavior change                                                                                          |
| 3   | Build           | done        | Storybook skipped (none in site)                                                                                                            |
| 4   | Test            | done        | Unit tests + lint + typecheck + site build + check-links green; manual browser walk-through on both routes. E2E skipped (no site e2e infra) |
| 5   | Sync            | done        | loan-application-intake +1 requirement; new solicitud-form spec (4 requirements)
| 6   | Archive         | done        | openspec/changes/archive/2026-09-22-add-solicitud-stepper

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Pencil frames (main checkout pencil.pen)

- Mobile: `aKmjR` Stepper · Paso 1, `XIyWp` Paso 3, `NuL37` Paso 5, `DoTlt` Fuera de cobertura
- Desktop: `z9i4le` Stepper · Paso 1, `rxKZe` Paso 3, `Ss5jU` Paso 5, `C8u2cX` Fuera de cobertura
- "Monto solicitado" swapped to a select (`crIxS`) in the legacy accordion frames too: `iVHMA` (mBc0P desktop), `eI8J4` (PT4PZ mobile)

## Decision log

- 2026-09-22 — User approved design + sync + archive; Pencil frames committed, specs synced, change archived (wrap-up PR after #288).
- 2026-09-22 — User reversed the Puerto Plata default: Provincia stays unselected so applicants can't just default into the only covered city. Pencil Paso 5 frames now show it as "Seleccionar".
- 2026-09-22 — User: default the form to RD$10,000, 10 semanas, Puerto Plata (both routes; Pencil Paso 3 + accordion frames updated). Side effect: defaults ride every autosave, so draft completeness counts 3 extra required fields as filled.
- 2026-09-22 — User: "Monto solicitado" must be a select, RD$5,000–RD$30,000 in 5k steps (user wrote "5,10,15…30 pesos"; read as thousands). UI-only cap; the server still accepts any amount.
- 2026-09-22 — Found + fixed a pre-existing intake bug: `fbp`/`fbc` posted as `null` failed `z.string().optional()`, so final submits without a Meta cookie were dropped as "invalid payload" while answering ok (row stayed DRAFT). Tracking keys are now `nullish()`.
- 2026-09-22 — Desktop Pencil frames added on user request.
- 2026-09-22 — Design deferred at first: Pencil had `proyecta/design/pencil.pen` open and the MCP ignores `filePath`; resumed once the user opened mikro's pencil.pen. Only new frames were added (the file carries another session's uncommitted edits, so it is not committed here).
- 2026-09-22 — Coverage enforced via an opt-in `coveredProvinces` dep on `createUpsertApplication`; only the website intake instance gets it, so WhatsApp paths are unchanged.
- 2026-09-22 — Endpoint body extracted to `createApplicationIntakeHandler` so "no CAPI Lead on out-of-area" is unit-tested.
- 2026-09-22 — Checkpoint created; framing the change.
