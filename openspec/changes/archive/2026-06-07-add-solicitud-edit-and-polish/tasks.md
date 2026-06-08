## 1. Backend: updateApplication (@mikro/common + apiserver)

- [x] 1.1 Add `updateApplicationSchema` in `@mikro/common` (id-or-sessionId + `patch`: the editable English content keys, all optional strings); export it + the input type
- [x] 1.2 Add `createUpdateApplication(client)` in `mods/apiserver/src/api/applications/`: load app; throw `CONFLICT` if `CONVERTED`; merge `patch` over existing `rawData`; run `normalizeApplication({ sessionId, ...merged })` + `scoreApplication`; update stable columns + `rawData` + score columns only (leave status/review/contract/conversion); export from the barrels
- [x] 1.3 Register reviewer-gated `updateApplication` tRPC mutation in `protected.ts`; build `common` + typecheck apiserver

## 2. Accordion polish (SectionCard)

- [x] 2.1 Improve `SectionCard` padding: more generous collapsed header padding (so it isn't a thin strip) and a consistent open-body inset; verify the existing detail sections still look right

## 3. Filter persistence (SolicitudesPage)

- [x] 3.1 Initialize the status filter + search from `sessionStorage` (`solicitudes.status`, `solicitudes.q`) and write them on change, so returning from a detail restores the view

## 4. Edit modal (SolicitudDetailPage)

- [x] 4.1 Add an editable-fields config grouped by section (Personal / Negocio / Crédito / Referencias / Vivienda) with labels + input/select types; reuse the public form's option lists for the enumerated fields
- [x] 4.2 Build an `EditSolicitudModal` prefilled from `rawData`; on save call `trpc.updateApplication` with the patch and invalidate `getApplication` + the list
- [x] 4.3 Add an "Editar" button on the detail header (hidden when `CONVERTED`) that opens the modal

## 5. Verify

- [x] 5.1 `npm run typecheck` + `build` clean for `common`, `apiserver`, and `dashboard`
- [x] 5.2 Against the running stack (reviewer): edit a solicitud → fields + score update, pipeline state unchanged; editing a `CONVERTED` one is blocked
- [x] 5.3 Pick a status tab, open a solicitud, go back → the tab is still selected
- [x] 5.4 Screenshot the detail collapsed + open to confirm the accordion padding reads well
