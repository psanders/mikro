## Context

The dashboard (Vite + React + Tailwind, Tauri-wrapped) already has the design-system component library, Login + Inicio screens, react-router with an auth guard, an auth context, and a typed tRPC client (`trpc.*`) generated from the apiserver's `AppRouter`. So every pipeline procedure is already callable and typed: `listApplications`, `getApplication`, `claimApplication`, `approveApplication`, `rejectApplication`, `reopenApplication`, `uploadSignedContract`, `getApplicationContract`, `convertApplication`. Applications are ADMIN/REVIEWER-only to read; a non-reviewer login gets `FORBIDDEN`.

Pencil targets: `Jnc0R` (03 Solicitudes / Bandeja) and `hHGM9` (04 Solicitud — Detalle). As with Login/Inicio, fidelity is achieved by screenshotting + reading the frame during implementation and matching tokens/components.

## Goals / Non-Goals

**Goals:**

- A filterable, searchable applications list and a detail screen that surfaces the score and drives the full review/sign/convert flow.
- Faithful to the Pencil designs, built only from the existing component library.
- Correct status-adaptive actions and query invalidation so the UI reflects server state.

**Non-Goals:**

- Other dashboard screens, manual application creation/editing, real Inicio KPIs, any backend change.

## Decisions

### Data access & filtering

The list calls `listApplications`. Status filtering uses the procedure's `status` param (server-side) so each tab fetches its slice — cleaner than client-side here because the lifecycle has many states and pagination is per-status. Search by applicant name filters client-side over the loaded page (matches the intake screen's pattern). "Cargar más" bumps `limit`/`offset`.

### Status vocabulary (UI labels)

Map lifecycle → Spanish labels: `RECEIVED`=Nuevas, `IN_REVIEW`=En revisión, `APPROVED`=Aprobadas, `SIGNED`=Firmadas, `CONVERTED`=Convertidas, `REJECTED`=Rechazadas, `DRAFT`=Borradores, plus "Todas". A shared `STATUS_META` map (label + Badge tone) is reused by list and detail.

### Risk-band display

`riskBand` → Badge tone + label (LOW_RISK=green "Bajo", MODERATE_RISK=green/amber, MEDIUM_HIGH=amber, HIGH/VERY_HIGH=red, OUT_OF_COVERAGE=neutral "Fuera de zona"). The numeric `score` (ISC) shows alongside.

### Detail actions are status-driven

A single actions panel renders the operations valid for the current status, mirroring the backend transition map:

- `RECEIVED` → Claim, Approve, Reject
- `IN_REVIEW` → Approve, Reject
- `APPROVED` → Upload signed contract (file input → base64 → `uploadSignedContract`)
- `SIGNED` → Convert (loan-terms form), and view contract
- `APPROVED|REJECTED` → Reopen
- `CONVERTED` → read-only, show linked `customerId`/`loanId`
  Reject prompts for a required reason; Convert is a small form (principal/termLength/paymentAmount/paymentFrequency, prefilled from `requestedAmount`/`requestedTermWeeks`). After any mutation, invalidate `getApplication` (and the list) via `trpc.useUtils()`.

### Score breakdown from `scoreData`

The detail renders `scoreData.categories[]` as labeled `ProgressBar`s (weight + score), `flags[]` as red `Badge`s, `recommendation` prominently, and `evaluator_notes[]` as a list (the verification interview guide) — this is the reviewer's core value.

### Full submission view

Stable fields render in `KVRow`s; the complete `rawData` (spouse, reference, housing, business detail — Spanish values) renders in a collapsible `SectionCard` so reviewers can see everything the applicant submitted without cluttering the summary.

### Contract upload/view

`uploadSignedContract` takes base64; a hidden `<input type=file accept=application/pdf>` reads the file via `FileReader` → strip the data: prefix → mutate. Viewing calls `getApplicationContract` and opens the returned base64 as a blob (`application/pdf`) in a new tab / download link.

### Forbidden handling

If `listApplications`/`getApplication` returns `FORBIDDEN` (a non-reviewer logged in), show a clear "no tienes acceso a solicitudes" state rather than a generic error.

## Risks / Trade-offs

- **Server-side status tabs = a fetch per tab** → Acceptable; volumes are low and it keeps pagination correct per status. React Query caches per input so revisiting a tab is instant.
- **Large base64 PDFs over tRPC** → The intake/attachment body cap already covers this; PDFs are small. Viewing builds a blob client-side.
- **Inicio recent table swap** → Repointing to `listApplications` changes the Inicio data source; the KPIs stay placeholder to keep scope contained.
- **Status-adaptive UI must match backend transitions** → Centralize the allowed-actions logic in one helper mirroring `resolveReviewTransition` so the UI never offers an action the server will reject.

## Open Questions

- None blocking. (If reviewers want to act without claiming, the actions already allow approve/reject directly from `RECEIVED`, matching the backend.)
