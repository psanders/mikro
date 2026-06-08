## Why

The Solicitudes (loan application) list and detail screens work functionally but drift from the Pencil v2 design (the source of truth) and carry small UX rough edges: a "Todas" filter nobody asked for, no pointer affordance on clickable rows, a back breadcrumb that isn't in the design and wastes vertical space, and an unclear contract story. Reviewers also have no way to produce a printable application summary to hand to the field agent who verifies the business.

## What Changes

- **Remove the "Todas" status tab** from the Solicitudes list. The lifecycle tabs (Nuevas / En evaluación / Aprobadas / Documentos / Convertidas / Rechazadas) remain; the default view is the first lifecycle tab.
- **Pointer affordance**: clickable rows and interactive components (table rows, list tiles, nav rows, toggles) show a `cursor-pointer` on hover, dashboard-wide.
- **Remove the "Volver a …" back breadcrumb** from the detail screens (Solicitud, Cliente, Transacción). Navigation back is done through the existing horizontal chrome (the sidebar nav item + the page-header context line), reclaiming vertical space and matching the design.
- **Contract link on the document name**: in the Solicitud detail Contrato section, the stored signed contract is downloaded by clicking the document name itself, not a separate "Ver PDF" button. The download link is present once a contract exists (SIGNED onward).
- **"Generar PDF" header action**: replaces the header "Ver PDF". Generates a PDF of the application/request itself (applicant, business, credit, references, housing, score summary) so a reviewer can send it to the field agent. Available for any submitted application.
- **Align the Solicitud detail to Pencil v2 (`VNNl1`)**: bring the content + 360px rail layout, section grouping, and the Contrato/progress/score blocks to the design.

Out of scope (separate follow-up): **general application attachments** (front/back ID images). Today an application has a single file slot — the signed contract (`saveContract` to disk + metadata on `LoanApplication`; no attachment model). ID-image attachments need a new model + storage + public-intake capture + UI, and will be proposed as their own change.

Open question carried into design: TODO asks for "the contract" to be downloadable "after Aprobada." Today the contract only exists once a _signed_ PDF is uploaded (APPROVED → SIGNED). Design must reconcile whether the post-approval downloadable document is (a) the generated **request** PDF, or (b) a newly generated **contract** PDF. This proposal scopes (a) + the signed-contract download link; option (b) — system-generated contract at approval — is flagged for a decision in design.

## Capabilities

### New Capabilities

- `application-request-pdf`: a server-side procedure that renders a PDF summary of a loan application (request) for offline field verification, reusing the existing `@mikro/common` PDF/receipt rendering stack.

### Modified Capabilities

- `solicitudes-list`: remove the "Todas" tab and adjust the default selected tab.
- `solicitud-review-ui`: remove the back breadcrumb; contract download as a link on the document name (SIGNED+); "Generar PDF" header action; detail aligned to Pencil v2.
- `dashboard-design-system`: clickable rows/components expose a pointer cursor; detail screens navigate back via the existing chrome rather than a per-screen breadcrumb component.

## Impact

- **Dashboard** (`mods/dashboard/src`): `SolicitudesPage.tsx`, `SolicitudDetailPage.tsx`, `ClienteDetailPage.tsx`, `TransaccionDetailPage.tsx`, and shared `ui/` components (rows/tiles/nav, plus a small download/link helper).
- **API server** (`mods/apiserver/src`): a new `generateApplicationPdf` (or similar) procedure + a renderer in `@mikro/common` reusing the receipt/report PDF stack.
- **Specs**: `solicitudes-list`, `solicitud-review-ui`, `dashboard-design-system`, and new `application-request-pdf`.
- No database schema changes. The signed-contract storage and `getApplicationContract` retrieval are unchanged.
