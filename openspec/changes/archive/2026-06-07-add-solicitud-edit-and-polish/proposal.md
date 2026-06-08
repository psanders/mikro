## Why

Three rough edges on the Solicitudes screens, surfaced while using them: (1) the list forgets the chosen status filter when you open a solicitud and come back, so reviewers lose their place; (2) there is no way to correct/complete an application's data from the dashboard (e.g. a typo'd cédula that blocks conversion, or missing fields); and (3) the detail accordion sections look thin/cramped when collapsed and their padding is inconsistent. This change polishes the review experience as we close out the pipeline.

## What Changes

- **Remember the filter** — the Solicitudes list persists the selected status filter (and search) for the session, so returning from a detail restores the same view.
- **Edit a solicitud** — an "Editar" action on the detail opens a single modal with the application's fields grouped by section (Personal / Negocio / Crédito / Referencias / Vivienda), prefilled and editable. Saving updates the application and **re-scores** it (scoring is deterministic on every write). Locked once `CONVERTED`.
- **New `updateApplication` mutation** (reviewer-gated) — merges the edited fields into the application, re-derives the stable columns, recomputes the score, and persists; status/review/contract/conversion fields are untouched.
- **Accordion polish** — `SectionCard` gets more generous, consistent padding so collapsed sections read as proper cards and open bodies are comfortable.

## Capabilities

### New Capabilities

- `loan-application-edit`: The reviewer-gated `updateApplication` mutation (merge + re-derive + re-score, locked when converted)

### Modified Capabilities

- `solicitud-review-ui`: The detail screen gains the "Editar" modal
- `solicitudes-list`: The status filter + search persist across navigation
- `dashboard-design-system`: `SectionCard` padding/sizing improved

## Impact

- `mods/common/src/` — `updateApplicationSchema` (id-or-sessionId + editable field patch)
- `mods/apiserver/src/` — `createUpdateApplication` + reviewer-gated `updateApplication` tRPC mutation (reuses `normalizeApplication` + `scoreApplication`)
- `mods/dashboard/src/` — edit modal on the detail; session-persisted filter on the list; `SectionCard` padding
- No Prisma migration (uses existing columns)
- Out of scope: editing after conversion, editing customers/loans, the other screens
