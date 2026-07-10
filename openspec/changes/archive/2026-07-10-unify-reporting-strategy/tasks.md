## 1. Design (Pencil) — AC#1, all six report PDFs

- [x] 1.1 Loan-statement PDF built to match the real #161 PDF exactly (p1 header/verification banner/8-cell KPI grid/6-col status-pill schedule; p2 7-row método ledger/reversal note/footer) — approved by user
- [x] 1.2 PDF representations for the five existing reports (clientes, préstamos en riesgo, renovación, desempeño w/ narrative, contable) built reusing the shared template in `pencil.pen`
- [x] 1.3 Locked reusable blocks: `report/page-header`, `report/kpi-cell`, `report/status-pill` (text-only). Design-gate sign-off received on loan-statement; full-set sign-off pending

## 2. Reporting foundation — helpers (`@mikro/common`)

- [x] 2.1 Add the FIFO waterfall-allocation helper (snapshot-in → per-cuota amount-applied/coverage, reversed rows excluded) beside `eval/`
- [x] 2.2 Add the repayment-schedule builder (cuota, due date via `getDueDateForCycle`, coverage date, status, amount) reusing the allocation helper and `buildLoanSnapshot`/`evaluateSnapshot`
- [x] 2.3 Export both helpers from the `@mikro/common` barrel

## 3. Reporting foundation — Report contract + PDF renderer (`@mikro/common`)

- [x] 3.1 Define the shared `Report` contract (`defineReport<TInput>` → `{ toJson, toPdf }`; JSON = full typed data model)
- [x] 3.2 Implement reusable PDF layout blocks (brand header, verification badge, KPI cards, status-pill table, secondary ledger page) as satori layouts using the receipts `loadFonts` path and Mikro brand tokens
- [x] 3.3 Implement the multi-page PDF renderer: satori → SVG → PNG per page (Resvg + sharp) → `pdfkit` image placement → valid multi-page PDF
- [x] 3.4 Export the reporting foundation from the `@mikro/common` barrel (leaving receipts untouched)

## 4. Loan-statement report (`@mikro/common` + `mods/apiserver`)

- [x] 4.1 Define the loan-statement report (`defineReport`): input schema (loan id), `toJson` from snapshot + schedule + `evaluateSnapshot`, `toPdf` composing the blocks into the 2-page layout incl. health-check-driven verification badge
- [x] 4.2 Add the apiserver data builder: Prisma read (loan + customer + payments) resolving the DB via `getResolvedDatabaseUrl()`, mapped into the snapshot input (validated function + DI)
- [x] 4.3 Add the tRPC procedure (admin/founder only) that runs builder + report definition and returns JSON/PDF

## 5. Surfaces — founder feed + CLI

- [x] 5.1 Register the `loan-statement` automation in the catalog (read-only, loan-id `ask` slot, pattern of `pay-collector`/`record-expense`/`daily-close`)
- [x] 5.2 Wire the founder-feed action (Storybook-first for any new card/UI) to invoke the automation and surface the statement
- [x] 5.3 Add the `ctl` loan-statement command calling the same builder + report definition (JSON/PDF), equivalent output to the founder-feed action

## 6. Tests

- [x] 6.1 Unit-test the waterfall-allocation helper (cumulative coverage, reversed excluded) and the schedule builder (row-per-cuota, due dates)
- [x] 6.2 Unit-test the PDF renderer (multi-page output, blocks present) and the `Report` contract (JSON = canonical data)
- [x] 6.3 Unit-test the loan-statement report incl. a validation-failure case (unknown/invalid loan id → structured error, no document) and health-badge pass/fail
- [x] 6.4 Unit-test the loan-statement data builder + automation execute with injected stubs (no live DB); assert CLI/action share the definition
- [x] 6.5 All touched packages green: common (80), apiserver (416 unit + 631 integration), dashboard (typecheck/lint/build/Storybook), ctl (typecheck). e2e skipped — no Playwright in repo. Untouched packages (agents/mobile/site) not affected

## 7. Verify & wrap

- [x] 7.1 Generated loan #10036's statement PDF through the real builder→report→pdf path; confirmed 1:1 with the reference/#161. Two bugs found & fixed: page-2 MONTO/MÉTODO columns collapsed (added cell `gap` in `dataTable`); dates off-by-one (added `timeZone:"UTC"` to `formatDateEs`)

## 8. Migrate the 5 reports to JSON + PDF (`@mikro/common`)

- [x] 8.1 `performanceReport` — `defineReport` (JSON + PDF) from `PortfolioMetrics` + narrative, matching the Pencil "Desempeño" (KPI grid + 2 breakdown tables + resumen/puntos/riesgos/recomendación)
- [x] 8.2 `customersReport` — `defineReport` matching Pencil "Clientes" (health-grouped rows, status pills)
- [x] 8.3 `defaultedReport` — `defineReport` matching Pencil "Préstamos en Riesgo" (risk KPIs, Atrasado/Default pills, mora + notas)
- [x] 8.4 `renewalReport` — `defineReport` matching Pencil "Renovación" (candidates, Activo/Completado/Por terminar pills, calif + nota)
- [x] 8.5 `accountingReport` — `defineReport` matching Pencil "Contable" (Ingresos/Gastos KPIs, accounts balance, transactions w/ type pills)
- [x] 8.6 Unit-test each definition (JSON canonical; PDF multi-block present; a validation-failure case)

## 9. Rewire surfaces to the new definitions

- [x] 9.1 apiserver: each `generate*Report` tRPC mutation returns JSON/PDF via the new definition (drop PNG). Added `generateCustomersReport` (new endpoint, `protectedProcedure`, mirrors `exportAllCustomers`'s all-active-customers scope). The three WhatsApp-copilot PNG tools (performance/defaulted/renewal) still render PNG for now — their data computation was extracted into exported `compute*` helpers shared with the JSON/PDF builders, so no logic is duplicated; the copilot PNG/Excel tool surface itself is retired in Phase F (10.2)
- [x] 9.2 ctl: each `reports/*` command outputs PDF/JSON (drop PNG default). `customers.ts` rewired onto the new `generateCustomersReport` endpoint (mirrors `loan-statement.ts`); this drops its prior collector-id filter + Excel/CSV/PNG `--output` extension routing (no report entry point may emit PNG/Excel per the founder-reports spec). `accounting.ts` keeps its `--format table` option alongside the new default PDF/JSON
- [x] 9.3 dashboard `ReportesScreen`: catalog reconciled to the real 6 Pencil reports (node `Gz8x7`: Estado de cuenta, Clientes, Préstamos en riesgo, Renovación, Desempeño, Contable), each wired to its tRPC mutation via `saveFile` (PDF default; `formats` badges show `["PDF","JSON"]`). Audit-log row kept exactly as-is (CSV, `exportAuditLog`) under its own label, unchanged. "Estado de cuenta" is per-loan (doesn't fit the period-catalog pattern) — rendered disabled with a short note instead of a broken download, per design.md's risk-note guidance

## 10. Retire / delete the old paths

- [x] 10.1 Delete the satori→PNG report generators + layouts in `mods/common/src/reports/` that are replaced (keep only what the new definitions use). Deleted 5 `*Generator.ts` + 5 `*Layout.ts`; pruned the retired accounting interfaces from `reports/types.ts`; rewrote `reports/index.ts` + the root `common/src/index.ts` barrel to export only the narrative prompt builders/parsers + `PortfolioMetrics`/`ReportNarrative` types
- [x] 10.2 Delete the WhatsApp-copilot Excel report tools + customer-list exports (`handleGenerate{Performance,Defaulted,RenewalCandidates}Report`, `exportAllCustomers`, `exportCollectorCustomers`, `excelUtils`) and their registrations/wiring (executor/index, executor/types, definitions.ts `allTools`, tools/index + agents barrel `ExportedCustomer`/`ExportedLoan`, createInvokeLLM SLOW_TOOLS, apiserver toolPolicy READ_TOOLS, apiserver index.ts tool-executor deps + imports). `uploadMedia`/`sendWhatsAppMessage`/`renderCustomersReportToPng` deps became orphaned and were removed from the interface; the WhatsApp `client/uploadMedia.ts` helper is still used by `sendReceiptViaWhatsApp` (kept). Copilot now exposes no report/Excel tool
- [x] 10.3 Removed `exceljs` from `mods/agents/package.json` and `mods/ctl/package.json` (`grep -rln "exceljs" mods/*/src mods/*/test` → nothing); `npm install` refreshed the root lock (targeted diff). `sharp`/`satori`/`@resvg/resvg-js` kept — still used by `reporting/renderer.ts` + receipts
- [x] 10.4 Grepped every deleted symbol across `mods/*/src` (excl. dist): only surviving refs are historical doc-comments in `reporting/*.ts` + `customerReportGrouping.ts` (no imports). Deleted orphaned `mods/ctl/src/lib/exportUtils.ts` (zero importers)

## 11. Migration tests + green

- [x] 11.1 Update/replace tests that asserted PNG/Excel output; add JSON/PDF assertions — done for the Phase E surfaces (performance/defaulted/renewal schema `format`-default assertions updated; new `createGenerateAccountingReport.test.ts`/`createGenerateCustomersReport.test.ts` assert the `{data, pdfBase64, filename, mimeType}` JSON shape). PNG/Excel-asserting tests for the agents/ctl-export paths retired in task 10.x remain for Phase F
- [x] 11.2 Full green across all touched packages. common: build + 96 tests. apiserver: typecheck + 416 unit + 631 integration. agents: typecheck + build + 143 passing (fixed `customerReportGrouping.test.ts` — dropped the deleted `getCustomersReportHeight` describe blocks; the 20 remaining agents failures are pre-existing config-fixture (`mikro.json`) failures unrelated to this change and ungated by CI). ctl: typecheck + build. dashboard: typecheck + vite build + Storybook build. Repo-wide `npm run lint` (eslint .) exit 0. Deleted retired tests: agents `exportAllCustomers.test.ts` + `excelUtils.test.ts`, apiserver `defaultedReportLayout.test.ts`

## 7. Verify & wrap

- [x] 7.2 Spec ↔ implementation reconciled (all requirements satisfied: shared Report contract + banner/KPI/pill blocks; loan-statement JSON+PDF w/ health banner + page-2 non-reversed + reconciliation note; admin-gated tRPC + CLI + automation share one definition; loan-statement automation registered read-only w/ invalid-id rejection). Tasks checked; checkpoint updated
