# Ship checkpoint — add-solicitud-stepper

Started: 2026-09-22
Current stage: 4 — Test (done) · awaiting human gates (design sign-off, sync, archive)

**Scope:** `/solicitud` becomes a one-section-per-screen stepper with visible progress (same questions, grouping and icons); the old accordion stays at `/solicitud-v0`. Both routes share one module. A new required `applications.coveredProvinces` config makes the website intake auto-reject final out-of-area submissions (REJECTED + `OUT_OF_COVERAGE_AREA`, no nudge, no Meta Lead) and the site shows a "not in your city yet" screen.

**Detected surfaces:** OpenSpec: yes · Pencil: yes · Storybook: no (site has none) · E2E: no (no Playwright for the site)

| #   | Stage           | Status      | Notes                                                                                                                                       |
| :-- | :-------------- | :---------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | Frame           | done        | Change `add-solicitud-stepper` written + validated                                                                                          |
| 1   | Design (Pencil) | in-progress | 6 frames added to the MAIN checkout's `pencil.pen` (the file open in Pencil); not in this PR's diff. Awaiting user "we're happy"            |
| 2   | Spec reconcile  | done        | Design matched the delta specs; no behavior change                                                                                          |
| 3   | Build           | done        | Storybook skipped (none in site)                                                                                                            |
| 4   | Test            | done        | Unit tests + lint + typecheck + site build + check-links green; manual browser walk-through on both routes. E2E skipped (no site e2e infra) |
| 5   | Sync            | pending     | Human gate                                                                                                                                  |
| 6   | Archive         | pending     | Human gate                                                                                                                                  |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Pencil frames (main checkout pencil.pen)

- Mobile: `aKmjR` Stepper · Paso 1, `NuL37` Stepper · Paso 5, `DoTlt` Fuera de cobertura
- Desktop: `z9i4le` Stepper · Paso 1, `Ss5jU` Stepper · Paso 5, `C8u2cX` Fuera de cobertura

## Decision log

- 2026-09-22 — Found + fixed a pre-existing intake bug: `fbp`/`fbc` posted as `null` failed `z.string().optional()`, so final submits without a Meta cookie were dropped as "invalid payload" while answering ok (row stayed DRAFT). Tracking keys are now `nullish()`.
- 2026-09-22 — Desktop Pencil frames added on user request.
- 2026-09-22 — Design deferred at first: Pencil had `proyecta/design/pencil.pen` open and the MCP ignores `filePath`; resumed once the user opened mikro's pencil.pen. Only new frames were added (the file carries another session's uncommitted edits, so it is not committed here).
- 2026-09-22 — Coverage enforced via an opt-in `coveredProvinces` dep on `createUpsertApplication`; only the website intake instance gets it, so WhatsApp paths are unchanged.
- 2026-09-22 — Endpoint body extracted to `createApplicationIntakeHandler` so "no CAPI Lead on out-of-area" is unit-tested.
- 2026-09-22 — Checkpoint created; framing the change.
