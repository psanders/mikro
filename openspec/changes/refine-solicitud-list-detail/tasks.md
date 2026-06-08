## 1. Remove the "Todas" tab (low-hanging fruit)

- [x] 1.1 In `SolicitudesPage.tsx`, drop the prepended `{ label: "Todas", value: "all" }` tab so only the lifecycle tabs render
- [x] 1.2 Change the default/remembered status to the first lifecycle tab (Nuevas / `RECEIVED`); migrate any persisted `"all"` value to the default so returning users aren't stuck on a removed tab
- [x] 1.3 Simplify the query input now that `"all"` is gone (no `status: undefined` branch needed)

## 2. Pointer affordance on clickable elements (low-hanging fruit)

- [x] 2.1 Add a global rule (dashboard `index.css`/global styles) so non-disabled `<button>` elements use `cursor: pointer`
- [x] 2.2 Add `cursor-pointer` to interactive non-button components rendered as `div`/`span` (nav rows, list tiles, custom toggles) where not already covered
- [x] 2.3 Verify disabled controls keep a non-pointer cursor

## 3. Remove the back breadcrumb; navigate via chrome (low-hanging fruit)

- [x] 3.1 Remove the `Volver a …` breadcrumb button from `SolicitudDetailPage.tsx`, `ClienteDetailPage.tsx`, and `TransaccionDetailPage.tsx`
- [x] 3.2 Make the `PageHeader` subtitle's leading section segment (e.g. "Solicitudes") a link back to the corresponding list
- [x] 3.3 Confirm reduced vertical space and that the sidebar nav still highlights/returns to the section

## 4. Contract download as a link on the document name

- [ ] 4.1 In the Solicitud detail Contrato section, when a contract exists (`SIGNED`/`CONVERTED`), render the original filename as a link that downloads the stored contract via `getApplicationContract`
- [ ] 4.2 Remove the standalone header "Ver PDF" action and any duplicate contract button
- [ ] 4.3 Keep the pre-`SIGNED` Contrato copy ("se genera/sube al firmar") with no download link

## 5. Request-PDF capability (backend)

- [ ] 5.1 Add a request-PDF renderer in `@mikro/common` (sibling to the report generators) that lays out applicant / business / credit / references / housing / score summary and returns PDF bytes via the existing resvg pipeline
- [ ] 5.2 Add a reviewer-gated `generateApplicationPdf` tRPC procedure (by application id) returning `{ dataBase64, filename, mimeType }`; not-found and forbidden handled
- [ ] 5.3 Unit-check the renderer/procedure against a seeded application

## 6. "Generar PDF" header action + Pencil v2 alignment

- [ ] 6.1 Replace the detail header "Ver PDF" with a "Generar PDF" action that calls `generateApplicationPdf` and triggers a browser download
- [ ] 6.2 Reconcile the Solicitud detail layout/sections with Pencil v2 frame `VNNl1` (content + 360px rail, section grouping, Contrato/score/progress blocks)
- [ ] 6.3 Manually verify the flow across statuses (RECEIVED → IN_REVIEW → APPROVED → SIGNED → CONVERTED, and REJECTED) against the seeded applications

## 7. Specs sync

- [ ] 7.1 After implementation, sync the delta specs into `openspec/specs/` (solicitudes-list, solicitud-review-ui, dashboard-design-system, new application-request-pdf)
