## Context

Reporting today is fragmented across `@mikro/common` (five satori→PNG reports in `mods/common/src/reports/`), `mods/agents` (exceljs exports/copilot report tools), the dashboard `ReportesScreen` (audit-log CSV only wired, rest inert), and the receipts pipeline (`mods/common/src/receipts/`, satori→SVG→PNG). Despite `pdfkit` being a dependency of `@mikro/common`, there is **no PDF renderer** in the codebase — the issue #161 loan statement was produced by a throwaway HTML→PDF script. Issue #110 wants one shared module standardized on JSON + PDF, with CLI/dashboard parity. This change builds that foundation and lands the loan-statement as the first report; the five existing reports are migrated (and PNG/Excel/CSV retired) in a follow-up.

The eval framework already owns the authoritative loan math: `buildLoanSnapshot`/`evaluateSnapshot` (`mods/common/src/eval/`) and `getDueDateForCycle` (`mods/common/src/utils/calculatePaymentStatus.ts`). Its snapshot docstring explicitly warns against reimplementing derived-number logic ad hoc — the #10036 script violated that by hand-deriving the schedule. The foundation must make the reusable helper the only path.

## Goals / Non-Goals

**Goals:**

- One shared `Report` contract in `@mikro/common`: typed input → `{ json, pdf }`, no per-format duplication.
- A branded multi-page PDF renderer reusing the receipts Inter font pipeline and Mikro brand tokens, encoding the #161 blocks (header, verification badge, KPI cards, status-pill table, ledger page).
- A single tested FIFO waterfall-allocation helper + a repayment-schedule builder that reuse the eval snapshot and `getDueDateForCycle`.
- Loan-statement report (JSON + 2-page PDF) exposed via a founder-feed automation-catalog action and a CLI command, equivalent output.
- All six report PDFs represented in Pencil (AC#1) using the #161 look/feel.

**Non-Goals:**

- Migrating the five existing PNG/Excel reports or retiring PNG/Excel/CSV (follow-up change).
- Changing the founder-reports catalog screen or the audit-log CSV export.
- Any BI/report-authoring capability.
- Scheduling semantics beyond registering the automation (the loan-statement is on-demand; scheduled use rides the existing task worker unchanged).
- **Receipts are explicitly out of scope and unchanged.** Receipts (`mods/common/src/receipts/`) are not reports: the JSON/PDF-only mandate does NOT apply to them, and their PNG output is a required capability that stays intact. The foundation only _reuses_ the receipts font-loading path (`loadFonts`); it does not modify, wrap, or retire the receipts pipeline. The follow-up report migration likewise leaves receipts alone.

## Decisions

**PDF rendering path: satori → SVG → PNG per page → pdfkit image placement.**
Reuse the exact receipts pipeline (`satori` layout → `@resvg/resvg-js` → `sharp` PNG) to render each page, then place full-page PNGs into a multi-page PDF via `pdfkit` (already a dep). Rationale: guarantees pixel-fidelity with the receipts brand look, reuses the font pipeline verbatim, and avoids introducing an HTML→PDF engine (puppeteer/playwright) purely for rendering. Alternative considered: satori SVG embedded directly into pdfkit via `svg-to-pdfkit` — rejected for weaker font/gradient fidelity vs. the proven Resvg raster path. Alternative considered: headless-Chromium HTML→PDF (what the #161 script did) — rejected as a heavy new runtime dependency. Trade-off: raster pages mean non-selectable text in the PDF; acceptable for a branded statement, and revisitable in the follow-up if selectable text is required.

**Report contract shape.** A `defineReport<TInput>()`-style factory returning `{ toJson(input), toPdf(input) }`, where `toPdf` composes reusable layout blocks (header/badge/kpiCards/table/ledgerPage) that the renderer knows how to paginate. `toJson` returns the full typed data model so the JSON is canonical and the PDF is pure presentation. Rationale: keeps "one data model, two projections" and lets the follow-up migrate each existing report by writing a definition, not a new pipeline.

**Helper placement and reuse.** The waterfall-allocation helper and schedule builder live in `@mikro/common` alongside `eval/`, consuming a snapshot rather than raw Prisma rows, so they are storage-agnostic and unit-testable with fixtures. The loan-statement report is the first consumer. Rationale: honors the snapshot docstring's "don't reimplement" rule and keeps the helper reusable by future reports/scripts.

**Loan-statement data builder in apiserver.** The Prisma read (loan + customer + payments) and mapping into a snapshot input lives in `mods/apiserver` (it owns the DB); the pure report definition lives in `@mikro/common`. tRPC exposes the founder-feed action; the CLI command calls the same builder + definition. Rationale: keeps `@mikro/common` DB-free and gives CLI/dashboard a single shared code path (parity by construction).

**Automation catalog registration.** Register `loan-statement` as a read-only automation following the `pay-collector`/`record-expense`/`daily-close` pattern (per founder-tasks spec), loan-id as an `ask` slot for on-demand use. Rationale: matches #161's stated wiring and reuses the catalog's schema-validated slot machinery.

## Risks / Trade-offs

- [Raster PDF text is not selectable/searchable] → Acceptable for a branded customer statement; the JSON payload carries all data for programmatic use; revisit vector text in the follow-up if needed.
- [Two SQLite DBs can diverge (#161 note: root `mikro.db` vs `mods/apiserver/data/mikro.db`)] → The apiserver builder MUST resolve the DB via the app's normal config (`getResolvedDatabaseUrl()`), not hardcode a path like the throwaway script did; note the divergence as a separate concern, out of scope here.
- [PDF renderer is new surface area] → Mitigated by reusing the receipts pipeline wholesale and covering the renderer + helpers with unit tests (incl. a validation-failure case) before wiring surfaces.
- [Scope creep toward migrating all reports] → Explicitly deferred; only the loan-statement is built. Pencil designs for the other five are design artifacts, not built code.

## Migration Plan

No data migration. Additive: new module + helpers in `@mikro/common`, new tRPC procedure + CLI command, new catalog automation. No existing report path is touched, so rollback is removing the new surfaces. Deploy rides the normal release pipeline. The follow-up change handles migrating the five existing reports and retiring PNG/Excel/CSV.

## Open Questions

- Exact KPI set on the statement header cards — lock during the Pencil design stage (default: principal, cuota, remaining balance, mora accrued, cuotas covered, days overdue).
- Whether the founder-feed action returns a download link/blob vs. posting the PDF into the feed — resolve against the existing automation execute-result convention during build.
