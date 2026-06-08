## Why

The loan origination pipeline is feature-complete on the backend (intake → score → review → sign → convert), but none of it is usable: ops staff have no screen to see incoming applications, read the score, or run the review/sign/convert flow. The "Solicitudes" nav item is still inert. This is Phase 4 — the dashboard that makes the whole pipeline operable, faithful to the Pencil designs.

## What Changes

- **Solicitudes list** (`/solicitudes`, Pencil `Jnc0R`) — wired to `listApplications`: status-filter tabs over the real lifecycle, search by applicant name, columns (applicant + business, monto, score with risk-band badge, status, fecha), row → detail, loading/error/empty, "Cargar más" pagination, and a clear message when a non-reviewer hits the FORBIDDEN gate.
- **Solicitud detail** (`/solicitudes/:id`, Pencil `hHGM9`) — wired to `getApplication`: header (name + status + ISC/risk band), request summary, applicant/business info with a collapsible full-submission view from `rawData`, the score breakdown (6 category bars, flags, recommendation, evaluator notes as the interview guide), and a status-adaptive actions area: claim/approve/reject/reopen, upload + view signed contract, and a "Convertir" loan-terms form; once `CONVERTED`, the linked customer/loan. Queries invalidate after each action.
- **Shell wiring** — activate the "Solicitudes" nav route; repoint the Inicio "Solicitudes recientes" table from `listLoans` to `listApplications` (rows → detail) and drop the inert "Nueva solicitud" CTA (applications come from the public form).

## Capabilities

### New Capabilities

- `solicitudes-list`: The applications list screen — filter, search, score/status display, pagination, access handling
- `solicitud-review-ui`: The application detail screen — score breakdown + the review/sign/convert actions wired to the pipeline

### Modified Capabilities

- `ops-dashboard-shell`: Solicitudes nav becomes active; the Inicio recent table is repointed to applications and the inert CTA removed

## Impact

- `mods/dashboard/src/pages/` — new `SolicitudesPage.tsx` + `SolicitudDetailPage.tsx`
- `mods/dashboard/src/` — routes for `/solicitudes` and `/solicitudes/:id` under the auth guard
- `mods/dashboard/src/components/Layout.tsx` — activate the Solicitudes nav entry
- `mods/dashboard/src/pages/OverviewPage.tsx` — repoint recent table to `listApplications`; remove the CTA
- No backend changes — all procedures already exist on `AppRouter`
- Out of scope: the other screens (Clientes, Préstamos, Contabilidad, Reportes), manual application creation/editing, real Inicio KPI data (stays placeholder)
