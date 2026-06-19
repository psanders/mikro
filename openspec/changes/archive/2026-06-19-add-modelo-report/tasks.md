## 1. Share the projection engine

- [x] 1.1 Move `mods/dashboard/src/lib/projection.ts` to `mods/common/src/projection/` (engine + types); keep it pure (no `fs`/Node imports)
- [x] 1.2 Add a browser-safe `./projection` subpath to `mods/common/package.json` `exports` (mirror the `./contracts` entry) and export the engine from an `index.ts`
- [x] 1.3 Repoint the dashboard: import the engine from `@mikro/common/projection` (re-export shim or update `ModeloPage` imports) so `ModeloPage` behavior is unchanged
- [x] 1.4 Build the dashboard and confirm the browser bundle pulls no server-only modules

## 2. PDF renderer (pdfkit, brand like the Loan Application)

- [x] 2.1 Factor the reusable brand primitives from `summaryGenerator.ts` (the `mikro` wordmark, section heads, kv rows, palette, Inter-with-Times fallback) into a small shared pdfkit module; keep `renderSummaryPdf` output unchanged
- [x] 2.2 Add `renderModeloReportPdf(data)` in `mods/common/src/contracts/` and export it via `@mikro/common/contracts`: header with `mikro` wordmark + title, key stats, monthly projection table, sensitivity scenarios, generated-at footer
- [x] 2.3 Add `generateModeloReportSchema` (input: the projection parameters) to `mods/common/src/schemas/report.ts` and export it

## 3. Server procedure

- [x] 3.1 Add `mods/apiserver/src/api/reports/createGenerateModeloReport.ts` mirroring `createGenerateApplicationSummary`: load Inter fonts from `assets/fonts/`, run the shared projection, render the PDF, return `{ dataBase64, filename: "modelo-negocio-<YYYY-MM-DD>.pdf", mimeType: "application/pdf" }`
- [x] 3.2 Register the `generateModeloReport` tRPC route (reviewer/admin-protected, matching the other report routes)

## 4. Dashboard export action

- [x] 4.1 Add an "Exportar PDF" button to `ModeloPage` (disabled when parameters are invalid)
- [x] 4.2 On click: call `generateModeloReport` with the current parameters, decode the base64 PDF, and save via `saveFile(bytes, filename, "application/pdf")`
- [x] 4.3 Handle loading + error states on the button

## 5. Verify

- [x] 5.1 Generate a PDF from the page; confirm the brand (mikro wordmark, Inter, palette) matches the application summary PDF and the content matches the on-screen stats, monthly table, and sensitivity
- [x] 5.2 Verify saving works on web (browser download) and in Tauri (native dialog), including dialog-cancel as a no-op
- [x] 5.3 Confirm the existing application summary PDF still renders correctly after the brand-primitive refactor
- [x] 5.4 Typecheck apiserver + common + dashboard; run the common/apiserver test suites
