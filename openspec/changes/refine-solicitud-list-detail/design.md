## Context

The Solicitudes list and detail (`SolicitudDetailPage.tsx`, `SolicitudesPage.tsx`) were built to Pencil v2 but carry small deviations and rough edges. This change is a batch of refinements plus one new backend capability (request PDF). The detail screens (Solicitud, Cliente, Transacción) share patterns (back breadcrumb, clickable rows), so some changes apply across them. Pencil v2 frame `VNNl1` is the source of truth for the detail.

Current contract handling: an application has a single file slot — the signed contract uploaded at the `APPROVED → SIGNED` transition (`saveContract` writes to `contractsPath`; metadata on `LoanApplication`; bytes retrieved via `getApplicationContract` as base64). There is no application attachment model.

The `@mikro/common` rendering stack already produces PDFs for receipts and reports (`receipts/generator.ts`, `reports/*ReportGenerator.ts`) via an SVG → `@resvg/resvg-js` → PDF pipeline; the request PDF reuses this rather than adding a dependency.

## Goals / Non-Goals

**Goals:**

- Land the low-effort UX fixes first (remove "Todas", pointer cursors, drop the breadcrumb) with no backend work.
- Bring the Solicitud detail to Pencil v2 and clarify the contract story (download link on the document name once a contract exists).
- Add a reviewer-gated "Generar PDF" that renders the application/request for field verification.

**Non-Goals:**

- General application attachments (front/back ID images) — needs a new model + storage + intake capture; separate change.
- Changing the sign/convert backend flow or the contract storage mechanism.

## Decisions

- **Pointer affordance — blanket + targeted.** Add a global rule so non-disabled buttons get `cursor-pointer` (the dashboard renders clickable rows as `<button>`, which browsers leave at `cursor: default`), plus `cursor-pointer` on any clickable `div`/`span` (nav rows, tiles). Rationale: one CSS rule fixes the majority (every row button) with minimal churn; alternative of editing each component is more work and easy to miss.

- **Back navigation reuses the page-header context, not a breadcrumb.** Remove the `Volver a …` button from the detail pages. The `PageHeader` subtitle already renders a context line (e.g. `Solicitudes / Juan Pérez García · …`); make its leading section segment ("Solicitudes") a link to the list. The sidebar nav item remains the primary way back. Rationale: reuses existing horizontal chrome (as requested), reclaims vertical space, matches the design. Alternative (rely on sidebar only) is fine too but the linked segment is a cheap, discoverable affordance.

- **Contract download is a link on the document name.** In the Contrato section, when a contract exists (`SIGNED`/`CONVERTED`), render the original filename as a link that fetches `getApplicationContract` and downloads the bytes. Remove the standalone "Ver PDF" (both the header action and any section button). Rationale: matches the TODO and reduces button clutter.

- **"Generar PDF" → new `generateApplicationPdf` procedure.** Reviewer-gated tRPC procedure taking an application id, returning `{ dataBase64, filename, mimeType }`. A renderer in `@mikro/common` (sibling to the report generators) lays out the application summary and produces PDF bytes through the existing resvg pipeline. The dashboard header action calls it and triggers a browser download (same pattern as `viewContract`). Rationale: reuses the proven PDF stack; keeps rendering server-side and role-gated.

- **Sequencing.** Tasks are ordered low-hanging-fruit first (1: remove Todas; 2: cursor; 3: breadcrumb) so they can ship independently of the PDF backend work (4–6).

## Risks / Trade-offs

- [Removing "Todas" changes the default view to "Nuevas"] → The session-remembered filter logic already handles this; reset any persisted "all" value to the default tab so returning users aren't stuck on a now-removed tab.
- [Global `button { cursor: pointer }` could affect intentionally non-pointer buttons] → Scope to `:not(:disabled)` and verify no button should look non-clickable; disabled buttons keep the default/not-allowed cursor.
- [Request PDF reuses the resvg pipeline] → resvg must be present at runtime (already addressed for the Docker image); the procedure fails gracefully (error toast) if rendering throws.

## Migration Plan

No data migration. Ship UI fixes (tasks 1–3) first; the PDF procedure (tasks 4–6) is additive. Rollback is reverting the commits; no schema or stored-data changes.

## Open Questions

- **"Contract available after Aprobada".** The TODO asks for the contract to be downloadable after approval, but today a contract only exists once a _signed_ PDF is uploaded (`SIGNED`). Two readings: (a) the **request** PDF (now generatable any time, including post-approval) is the document the reviewer downloads/sends — no contract generation needed; or (b) the system should **generate a contract PDF at approval** that is downloaded, signed offline, then re-uploaded. This change implements (a) + the signed-contract download link. If (b) is intended, it is a larger addition (a contract template + generation step) and should be its own task/change — flagged for the user to confirm before building.
