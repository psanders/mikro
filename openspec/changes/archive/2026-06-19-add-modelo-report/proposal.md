## Why

The "Modelo de negocio" (Projection Model) page lets an operator simulate the portfolio's financial projection and break-even, but there is no way to export it. The page's own dev note already anticipates this: _"a future 'Exportar PDF' action could reuse mods/common report tooling."_ Operators need a branded, printable snapshot of the projection that downloads the same way in both the Tauri desktop app and the web build.

## What Changes

- Add an **"Exportar PDF"** action to the Modelo de negocio page that generates a branded **PDF** of the current projection (parameters, key stats, monthly projection, sensitivity scenarios) and saves it via the existing `saveFile` helper (native dialog in Tauri, browser download on web).
- Render the report as a **pdfkit PDF**, matching the Loan Application documents (`@mikro/common/contracts` — `renderSummaryPdf`/`renderContractPdf`): Inter fonts, the `mikro` wordmark, and the brand palette. Reuse the summary generator's brand primitives rather than the Satori/PNG report pipeline.
- Add a tRPC procedure (`generateModeloReport`) that takes the projection parameters, runs the projection, and returns the PDF as base64 — mirroring `createGenerateApplicationSummary`.
- Promote the projection engine to `@mikro/common` (browser-safe subpath) so the dashboard and the server compute the identical result from one source.
- No LLM narrative (the Modelo section is explicitly non-AI per the existing product decision).
- **Out of scope:** the four existing reports (rendimiento, clientes, mora, renovación) stay as PNG — they are delivered as inline images over WhatsApp by the María agent, where image is the intended UX. A broader PDF migration of those is deferred.

## Capabilities

### New Capabilities

- `modelo-report`: Generate and save a branded PDF of the business-model projection from the dashboard, working in both the Tauri desktop app and the web build.

### Modified Capabilities

<!-- none — the projection engine move is an internal refactor with no behavior change -->

## Impact

- **New**: a pdfkit `renderModeloReportPdf` in `mods/common/src/contracts/` (exported via `@mikro/common/contracts`); `mods/apiserver/src/api/reports/createGenerateModeloReport.ts` + tRPC route; `generateModeloReportSchema` in `mods/common/src/schemas/report.ts`.
- **Moved**: projection engine (`runProjection` + types) from `mods/dashboard/src/lib/projection.ts` to `@mikro/common` under a browser-safe `./projection` subpath; the dashboard imports from there.
- **Refactor (optional)**: factor the summary PDF's brand primitives (`mikro` wordmark, section heads, kv rows, palette) into a small shared pdfkit helper so the modelo report and the summary share them.
- **Changed**: `mods/dashboard/src/pages/ModeloPage.tsx` gains the export button; reuses `mods/dashboard/src/lib/saveFile.ts` (unchanged).
- No DB/schema migrations. No new runtime dependencies (pdfkit already used by the Loan Application PDFs). Reuses the existing Inter fonts in `mods/apiserver/assets/fonts/`.
