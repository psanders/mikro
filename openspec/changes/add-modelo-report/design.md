## Context

The Modelo de negocio page (`ModeloPage.tsx`) computes a projection entirely client-side via `runProjection` in `mods/dashboard/src/lib/projection.ts` (pure math, ~498 lines, no `fs`/Node deps — deliberately browser-safe). The page prefills parameters from live data and lets the operator edit and recalculate.

The codebase has **two** server-side document pipelines:

- **Satori → PNG** (`mods/common/src/reports/*`): the rendimiento/clientes/mora/renovación reports. These are delivered as **inline images over WhatsApp** by the María agent — PNG is intentional for that channel.
- **pdfkit → PDF** (`mods/common/src/contracts/*`, exported via `@mikro/common/contracts`): the Loan Application **contract** and **summary**. `renderSummaryPdf` already establishes the brand: Inter fonts (TTF bytes passed in, Times fallback), a vector `mikro` wordmark (`drawLogo`), the brand palette (`#14254a`/`#103a8a`/`#1f4aa8`/`#3f86e0` …), accent-tick section heads, and kv rows. Its procedure `createGenerateApplicationSummary` loads `assets/fonts/Inter-*.ttf` and returns `{ dataBase64, filename, mimeType: "application/pdf" }`.

The dashboard writes returned bytes with `saveFile` (`mods/dashboard/src/lib/saveFile.ts`), which already branches Tauri (native `@tauri-apps/plugin-dialog` + `plugin-fs`) vs web (Blob download) and supports `application/pdf`. `saveFile` needs no changes.

The Modelo report is **dashboard-only** (no WhatsApp path), so it follows the **PDF** pipeline like the Loan Application, not the PNG report pipeline.

## Goals / Non-Goals

**Goals:**

- One-click PDF export from the Modelo page, saving in both Tauri and web via the existing `saveFile`.
- A branded PDF consistent with the Loan Application documents (`mikro` wordmark, Inter, brand palette).
- The exported report exactly matches the on-screen projection.
- No duplicated projection math.

**Non-Goals:**

- No LLM narrative (Modelo is non-AI per the `ModeloPage` dev notes).
- No change to the projection algorithm or the page's inputs/inference.
- No migration of the four WhatsApp reports — they stay PNG (image is the intended WhatsApp UX). Revisit separately if desired.
- No change to `saveFile`, the DB, or document dependencies.

## Decisions

**Render as a pdfkit PDF, reusing the summary generator's brand toolkit.**
Build `renderModeloReportPdf(data)` in `mods/common/src/contracts/`, exported via `@mikro/common/contracts`, on top of the same brand primitives `renderSummaryPdf` uses (`mikro` wordmark, section heads, kv rows, palette, Inter-with-Times-fallback). Those primitives are currently private to `summaryGenerator.ts`; factor the reusable ones into a small shared module so both documents share one brand source. Alternative — a Satori/PNG modelo report — was rejected: the user wants a PDF like the Loan Application, and this report is dashboard-only so the WhatsApp-oriented PNG path adds nothing.

**Recompute from parameters server-side (not from a passed result).**
The procedure input is the `ProjectionConfig` (~11 numeric parameters), not the full `ProjectionResult`. The server runs the shared engine and renders from its own result. Rationale: smallest, simplest wire schema; the server owns what it renders; `runProjection` is deterministic, so recomputing from the same parameters yields exactly the on-screen numbers. Alternative — POSTing the whole `ProjectionResult` tree — was rejected: a large, churny zod schema and the server rendering numbers it didn't compute.

**Promote the projection engine to `@mikro/common` under a browser-safe `./projection` subpath.**
For the server to recompute, `runProjection` + its types must live where both sides can import them. Move `projection.ts` to `mods/common/src/projection/` and add a `./projection` entry to `mods/common/package.json` `exports` (mirroring the existing `./contracts` subpath). The file is pure math with no `fs`, so the dashboard bundle stays browser-safe — the reason it must be a dedicated subpath, not the `@mikro/common` root (which pulls `config.js → fs`). The dashboard's `lib/projection.ts` becomes a thin re-export so `ModeloPage` is otherwise untouched.

**Procedure shape mirrors `createGenerateApplicationSummary`.**
Load Inter fonts from `mods/apiserver/assets/fonts/`, run the projection, render the PDF, return `{ dataBase64, filename: "modelo-negocio-<YYYY-MM-DD>.pdf", mimeType: "application/pdf" }`. Reviewer/admin-protected, like the other report routes.

**New capability, not a modification.**
Report export for Modelo isn't specced today; the projection-engine move is an internal refactor with no behavior change, so no existing spec's requirements change.

## Risks / Trade-offs

- [Adding a `./projection` subpath could pull server-only code into the browser bundle] → The moved file imports nothing from `fs`/Node; a dashboard build verifies the bundle stays clean. Keep the subpath's transitive imports pure.
- [Refactoring the summary's brand primitives could regress the existing summary PDF] → Extract conservatively and keep `renderSummaryPdf` output byte-stable; the summary path is covered by manual generation in verify.
- [On-screen vs report divergence] → Eliminated by construction: both run the same engine from the same parameters.
- [pdfkit Inter rendering] → Same fonts/fallback the summary already uses; nothing new.

## Migration Plan

1. Move `projection.ts` → `@mikro/common` `./projection`; repoint the dashboard import; confirm the dashboard builds (browser bundle clean) and the page is unchanged.
2. Factor shared brand primitives; add `renderModeloReportPdf`; add schema + procedure + route.
3. Wire the page's export button to the procedure + `saveFile`.
   Rollback is code-only (no data/schema changes): revert the commits.
