## Context

`LoanApplication.rawData` holds the full submission as English-keyed fields with their original display values (e.g. `monthlySales: "RD$50,000 – RD$100,000"`, `phone: "(809) 354-5211"`). The stable columns are derived from it by the pure `normalizeApplication`, and the score by the pure `scoreApplication(NormalizedApplication)` — both already exported from `@mikro/common`. Scoring runs on every write. The dashboard detail (`SolicitudDetailPage`) and list (`SolicitudesPage`) exist; `SectionCard` is the collapsible accordion component.

## Goals / Non-Goals

**Goals:**

- Persist the list's filter across navigation.
- Let reviewers edit an application's fields and have it re-score, without touching pipeline state.
- Make the detail accordion read well collapsed and open.

**Non-Goals:**

- Editing converted applications, editing the created Customer/Loan, schema changes, the public form.

## Decisions

### updateApplication reuses the pure pipeline

`createUpdateApplication(client)` loads the app (block with `CONFLICT` if `CONVERTED` — it's locked once it became a customer/loan), merges the incoming field patch over the existing `rawData`, then runs `normalizeApplication({ sessionId, ...mergedRawData })` to re-derive the stable columns and `scoreApplication(normalized)` to recompute the score. It updates the stable columns + `rawData` + score columns only — `status`, review audit, contract, and conversion links are left as-is. This keeps a single source of truth (the same normalize+score used at intake) and means an edit can fix data that blocks conversion (e.g. cédula format) and refresh the advisory score.

Input `updateApplicationSchema`: id-or-sessionId + a `patch` object of the editable English content keys (all optional strings), validated leniently like the intake payload.

### Edit modal: one form, grouped by section

The detail gets an "Editar" button (hidden when `CONVERTED`). It opens a modal whose fields mirror the public form, grouped Personal / Negocio / Crédito / Referencias / Vivienda, prefilled from `rawData`. Enumerated fields (estado civil, tipo de negocio, ventas, etc.) use selects with the same option lists as the site form so values stay in the vocabulary the scorer matches; free-text fields (names, address, amount) use inputs. On save, only the changed/holding values are sent as the patch; success invalidates `getApplication` + the list.

### Filter persistence: session storage

The list reads its initial status filter and search from `sessionStorage` (keys `solicitudes.status`, `solicitudes.q`) and writes them on change. Returning from a detail (however reached) restores the view. Chosen over URL params for robustness with the back link and direct opens; it is session-scoped so it resets on a new session.

### SectionCard padding

Increase the collapsed header padding (more vertical breathing room so a collapsed card isn't a thin strip) and standardize the open-body padding via a consistent inner wrapper, so every section's content has the same comfortable inset. Purely presentational; no API change.

## Risks / Trade-offs

- **Editing re-scores, which can change band/recommendation** → Intended; the score is advisory and should reflect current data. Review state is preserved, so an edit doesn't silently un-approve.
- **Option lists duplicated in the dashboard edit modal** → Mild duplication of the site's select options; acceptable, and could later be shared via `@mikro/common` if they drift.
- **Free-text enum fields could fall outside the scorer's vocabulary** → Mitigated by using selects for the score-relevant enumerated fields.
- **Locked after conversion** → Editing a converted application is blocked; correcting a converted record is a separate (customer/loan) concern, out of scope.

## Open Questions

- None blocking.
