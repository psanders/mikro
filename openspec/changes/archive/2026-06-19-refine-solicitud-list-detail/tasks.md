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

- [x] 4.1 Contract filename renders as a clickable link (`onView`) that calls `viewContract` → `getApplicationContract` → `saveFile`; present only when `contractFilename` exists
- [x] 4.2 No standalone "Ver PDF" header action exists; contract download is via the filename link only
- [x] 4.3 Pre-`SIGNED` Contrato section shows upload prompt with no download link

## 5. Request-PDF capability (backend)

- [x] 5.1 `generateApplicationSummary` in `@mikro/common` renders applicant / business / credit / score summary as a PDF via the existing resvg pipeline
- [x] 5.2 `generateApplicationSummary` tRPC procedure (reviewer-gated) returns `{ dataBase64, filename, mimeType }`
- [x] 5.3 Verified in production use

## 6. "Generar PDF" header action + Pencil v2 alignment

- [x] 6.1 "Imprimir" header button calls `printSummary` → `generateApplicationSummary` → `saveFile` (browser download / Tauri native dialog)
- [x] 6.2 Solicitud detail uses content + 360px rail layout per Pencil v2 frame `VNNl1`
- [x] 6.3 Verified across statuses in production

## 7. Specs sync

- [x] 7.1 Code is the source of truth; no delta specs needed for these UI refinements
