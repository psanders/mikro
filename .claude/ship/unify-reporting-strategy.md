# Ship checkpoint — unify-reporting-strategy

Started: 2026-07-09
Current stage: 5 — Sync (HUMAN GATE — awaiting approval)

**Scope:** Build the shared reporting foundation (a `Report` contract producing JSON+PDF, a unified branded PDF renderer on the receipts font/satori pipeline encoding the issue #161 look/feel, plus FIFO waterfall-allocation + repayment-schedule helpers in `@mikro/common`) and land the loan-statement PDF as the first migrated report, wired into the founder-feed automation catalog and the CLI. Design all 6 reports (loan-statement + performance/customers/defaulted/renewal/accounting) as PDFs in Pencil upfront (AC#1). Migrating the other 5 reports and retiring PNG/Excel/CSV is a follow-up branch. Tracks issue #110 (which absorbed #161).

**Detected surfaces:** OpenSpec: yes · Pencil: yes (`./pencil.pen`) · Storybook: yes (dashboard) · E2E: no (no Playwright anywhere → stage 4 e2e skipped)

| #   | Stage           | Status      | Notes                                                                                                                                           |
| :-- | :-------------- | :---------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done        | Surfaces detected; OpenSpec change `unify-reporting-strategy` created                                                                           |
| 1   | Design (Pencil) | done        | All 6 PDFs built, verified, uniform 900×1240. User signed off "designs are great"                                                               |
| 2   | Spec reconcile  | done        | Reconciled: verification badge→banner; page-2 excludes reversed rows (method table + reconciliation note). `openspec validate` passes           |
| 3   | Build           | done        | Foundation + loan-statement (Phases A/B/C via Sonnet). Feed download button added                                                               |
| 4   | Test            | done        | common 80, apiserver 416 unit + 631 integration, dashboard build/Storybook, ctl tc. e2e skipped (no Playwright). #10036 rendered + verified 1:1 |
| 5   | Sync            | in-progress | HUMAN GATE — promote delta specs (reporting-foundation, loan-statement-report, founder-tasks) into main specs                                   |
| 6   | Archive         | pending     | HUMAN GATE — after sync                                                                                                                         |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Existing landscape (from stage-0 survey)

- PNG reports (satori/sharp) in `mods/common/src/reports/`: performance, customers, defaulted, renewal, accounting — each `*Layout` + `*Generator` (+ some LLM `*Prompt`).
- Excel exports (exceljs) in `mods/agents/src/tools/executor/`: customer exports + copilot report tools.
- CSV: dashboard `ReportesScreen` audit-log export (`exportAuditLog`) only wired; rest of catalog inert ("Próximamente").
- PDF: `mods/common/src/receipts/` pipeline (satori + fonts + qrcode + jwt) — the font pipeline #161 reuses.
- CLI (`ctl`): no report command yet.
- Deps: common has pdfkit+satori+sharp; agents+ctl have exceljs.
- Existing specs: `founder-reports` (catalog screen + audit CSV — note CSV conflicts with JSON/PDF-only target, out of scope this branch), `application-request-pdf`, `business-event-log`, `founder-tasks` (automation catalog pattern: pay-collector/record-expense/daily-close).
- #161 template look: page 1 = brand header + verification badge + KPI cards + status-pill schedule table; page 2 = raw payment ledger + reversed-entry note. Brand tokens: blue-deep #103A8A, ink #14254A, orange-primary #F68A1F, orange-deep #E85B1C, yellow-accent #FFD447, mist #E9F2FF; font Inter.

## Phase A API (from `@mikro/common`, for Phase B)

- `allocatePaymentsToCuotas(input: {payments, cuota, termLength}) → CuotaAllocation[]` (Zod-validated; only COMPLETED/PARTIAL INSTALLMENT count).
- `buildRepaymentSchedule(snapshot: LoanSnapshot) → RepaymentScheduleRow[]` ({cuota,dueDate,coverageDate,status:"PAID"|"PARTIAL"|"OVERDUE"|"UPCOMING",amountApplied}).
- `defineReport<TSchema,TData>(spec) → Report` where `Report = {name, toJson(input):Promise<TData>, toPdf(input, deps?):Promise<Buffer>}`; spec = `{name, inputSchema, buildData(input)→TData, toDocument(data)→ReportDocument}`.
- `renderReportToPdf(doc, deps?)`; blocks `brandHeader, verificationBanner, kpiGrid, dataTable, section, footerNote, page`; `BRAND`, `PAGE_WIDTH=816`, `PAGE_HEIGHT=1056` (US Letter @96dpi — the 900 Pencil width was mockup-only). Fonts default to receipts `loadFonts`; inject via `deps.loadFonts` for tests. Pages are raster.
- Files: `mods/common/src/reporting/{allocation,schedule,report,blocks,renderer,index}.ts`; tests in `mods/common/test/reporting/`.

## Build status (loan-statement)

- Phase A (foundation) + Phase B (loan-statement report + apiserver builder `createGenerateLoanStatement` + `generateLoanStatement` tRPC on `adminProcedure` + `loan-statement` automation in catalog + `ctl reports loan-statement` command) DONE & green: common 80, apiserver 414 passing; ctl typecheck/lint clean.
- Verified end-to-end: rendered loan #10036 through the real builder path → PDF 1:1 with reference/#161. Fixed 2 bugs (page-2 column gap in `dataTable`; `formatDateEs` UTC timezone).
- One shared code path (report definition) behind tRPC + CLI + automation → parity by construction.
- REMAINING: task 5.2 founder-feed UI (Storybook) — blocked on a product decision: `AutomationResult` has no slot for returning document bytes to a feed card (design.md open question: download-link/blob vs post-into-feed). 6.5 full-repo green + 7.2 wrap after 5.2. Then human-gated Sync (5) + Archive (6).

## Phase C (task 5.2) — DONE

- Founder-feed download: `AutomationResult` + `ExecuteFiringResult` gained optional `attachment {filename,mimeType,base64}`; `loanStatement.execute` returns the PDF attachment; `firings.ts` threads it through the confirm RETURN only (persisted `task.completed` event stays summary-only — no bytes, no storage). `confirmFiring` output carries it via inferred type. Dashboard `TaskActionCard`/`TaskFeedCard` render "Descargar estado de cuenta" (base64→`saveFile`, same helper as ReportesScreen); Storybook story `ResolvedWithDownload`. All green.

## SCOPE EXPANDED 2026-07-10 (overnight, user-directed)

User: end state = ONLY the 6 Pencil reports survive, as PDF + JSON; delete everything else (PNG generators, ALL Excel, WhatsApp report delivery). User asleep, authorized autonomous execution + a morning note (`MORNING-NOTE-reports.md` at repo root). Close-out approved: sync + archive + commit + PR.

Conservative holds (flagged in morning note, NOT deleted): audit-log CSV export (shipped founder-reports feature, not a Pencil report); `generateModeloReport` (business-risk PDF, separate capability).

Migration phases: D = 5 report definitions in @mikro/common (LAUNCHED, Sonnet a288771e); E = rewire tRPC/CLI/dashboard to new defs (drop PNG); F = delete PNG generators + agents Excel tools + customer exports + exceljs dep + WhatsApp report delivery; then full green → sync → archive → commit → PR.

## Phase F deletion plan (surgical — run AFTER E removes callers)

DELETE (PNG render surface):

- `mods/common/src/reports/{performance,customers,defaulted,renewal,accounting}ReportLayout.ts`
- `mods/common/src/reports/{reportGenerator(=perf),customersReportGenerator,defaultedReportGenerator,renewalReportGenerator,accountingReportGenerator}.ts`
- their exports from `mods/common/src/reports/index.ts` + `mods/common/src/index.ts` barrel.

DELETE (Excel / WhatsApp report delivery):

- `mods/agents/src/tools/executor/{excelUtils,exportAllCustomers,exportCollectorCustomers,handleGeneratePerformanceReport,handleGenerateDefaultedReport,handleGenerateRenewalCandidatesReport}.ts` + their tool registrations (`tools/definitions.ts`, `executor/index.ts`, `executor/types.ts`) + WhatsApp wiring (`whatsapp/handleWhatsAppMessage`, `whatsapp/client/uploadMedia` if now orphaned).
- `mods/ctl/src/lib/exportUtils.ts` if orphaned after E.
- Remove `exceljs` dep from `mods/agents` and `mods/ctl` once no importer remains.

PRESERVE (still used for narratives / data typing — DO NOT delete):

- `mods/common/src/reports/{reportPrompt,defaultedReportPrompt,renewalReportPrompt}.ts` (LLM narrative builders feeding performance/defaulted/renewal inputs).
- `mods/common/src/reports/types.ts` (PortfolioMetrics/ReportNarrative/AccountingReportData — apiserver builders + narrative). F must grep for remaining users before deleting anything.

## Phase E DONE + verified (2026-07-10)

Rewired all report surfaces to the new defs, dropped PNG. apiserver: 4 existing report builders swapped to `{data,pdfBase64,filename,mimeType}` via the new defs + new `generateCustomersReport` (protectedProcedure, all-active scope); narrative compute extracted into shared `compute*` helpers (copilot PNG tools still call them until F deletes those tools). ctl: 5 report commands → PDF default / `--format json` (customers lost collector-id filter + Excel/PNG output; accounting kept `--format table`). dashboard ReportesScreen: catalog reconciled to the 6 Pencil reports, wired via saveFile, formats→[PDF,JSON]; audit-log CSV row untouched; Estado de cuenta rendered disabled+note (per-loan, not period). Verified GREEN independently: common 96, apiserver 424 unit + 639 integration, dashboard build OK, all 4 typecheck + lint clean (fixed 1 prettier nit). Also removed a stray `mods/apiserver/__tmp_render_10036.ts` (my leftover verify script). Filed unrelated bug #194 (qcobro empty-portfolio skip).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-07-09 — Phase A (Sonnet) DONE + independently verified: `mods/common/src/reporting/` (allocation, schedule, defineReport, blocks, renderer) + tests. 73 passing, typecheck/lint/build clean, receipts untouched. tasks 2.1–2.3, 3.1–3.4, 6.1–6.2 checked. (First launch stalled on watchdog after reading phase; resumed via SendMessage, completed.) Note: @mikro/common uses chai not sinon — DI stubs used instead.
- 2026-07-09 — Per user: all 7 report pages set to uniform 900×1240 (fits tallest = statement p1 1207); short reports pad with bottom white space, content top-aligned.
- 2026-07-09 — All 5 remaining reports designed in Pencil reusing the template: Clientes (fq274), Préstamos en Riesgo (t7qgL), Renovación (viGjb), Desempeño (pJXXq, narrative: KPI+2 breakdown tables+resumen/puntos/riesgos/recomendación), Contable (xrebd, KPI+accounts+transactions w/ colored type pills). Added reusable `report/page-header` (J5Wrk). AC#1 (all report PDFs represented in Pencil) satisfied.
- 2026-07-09 — Pencil REBUILT to match the real #161 PDF exactly (user shared it). p1 `Z7KzNm`: white header + blue tile "m"/"mikro" wordmark + right meta (Generado/Desembolso/Frecuencia), mist verification banner (bold headline + bulleted explanation), 8-cell divided KPI grid (Capital/Interés/Total a pagar/Abonado/Saldo/Mora/Días/Ciclos; saldo+mora+días in orange; subtexts), 6-col schedule (CUOTA/VENCE/ESTADO/CUBIERTA EL/MONTO CUOTA/APLICADO) text-only pills incl. Sin pago (red) + Vence hoy (yellow), coverage deltas, highlighted Parcial row. p2 `FLcHT`: 7-row ledger FECHA/TIPO/MONTO/MÉTODO (reversed excluded), note box (bold lead + body + 2 reconciliation bullets), footer. Reusable blocks: `report/status-pill` text-only (Updmp), `report/kpi-cell` (Q0WN81). Known Pencil-only approx: note bold-lead is stacked not inline (satori PDF will inline it). AWAITING design-gate sign-off before replicating to the other 5 reports.
- 2026-07-09 — [superseded] First anchor mockup (blue header band, icon pills, 6 carded KPIs) diverged from the real PDF; deleted and rebuilt per user's shared reference.
- 2026-07-09 — Receipts are an exception: NOT reports, keep PNG capability intact; foundation only reuses receipts `loadFonts`, never modifies/retires receipts (per user). Recorded in design Non-Goals.
- 2026-07-09 — PDF path decided: satori→SVG→PNG per page (existing receipts pipeline) → pdfkit image placement → multi-page PDF. No new HTML→PDF engine. Trade-off: raster text.
- 2026-07-09 — OpenSpec change created + validated (proposal/design/specs/tasks). New caps: reporting-foundation, loan-statement-report; MODIFIED: founder-tasks (loan-statement automation). Entering Pencil design stage.
- 2026-07-09 — Scope = foundation + loan-statement (follow-up branch for the other 5 + format retirement); design all 6 report PDFs in Pencil upfront; drive via /ps:ship on branch `feat/unify-reporting-strategy`.
- 2026-07-09 — Folded #161 (loan-statement PDF) into #110 as its first concrete report; closed #161 as duplicate.
- 2026-07-09 — Checkpoint created; framing the change.
