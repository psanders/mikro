## Context

`"—"` is used two ways in `mods/dashboard`:

- **Missing-data placeholder** (the target): formatters in `src/lib/applications.ts` (`recommendationLabel:62`, `confidenceLabel:74`, `formatDop:117`, `formatDate:121/124`, `fieldDisplayLabel:147`); the `raw()` helper (`SolicitudDetailPage:96`); and ~25 inline `?? "—"` / `|| "—"` fallbacks across 8 pages (KV rows, RailRows, table cells, computed names/scores).
- **Legitimate text** (must keep): code comments, enum labels (`"Rechazar — fuera de zona"`), and `<option>` select prompts (`"— Seleccionar —"`, `"— Sin categoría —"`).

Stacked key-value renderers: `ui/KVCell.tsx` (label over value) and three local `KV` copies (`SolicitudDetailPage:787`, `ClienteDetailPage:320`, `TransaccionDetailPage:255`). Horizontal renderers (`ui/KVRow`, local `RailRow`) and list tables keep their height from the always-present label/name, so only the stacked ones risk collapse.

## Goals / Non-Goals

**Goals:**

- Absent values render empty, no em-dash, everywhere data is displayed.
- Formatters return `""` for missing/invalid input; `formatDop` returns `""` (not `"RD$ "`).
- Stacked KV rows keep height/alignment when the value is empty.
- One documented convention.

**Non-Goals:**

- Touching prose, enum labels, or select prompts.
- Changing validation, query logic, or data shapes.
- A new shared "empty value" component or design-token work beyond the line-height fix.

## Decisions

- **Return type stays `string`, value becomes `""`.** Returning `null` would force every call site to handle it and widen types. Empty string is a drop-in: `recommendationLabel`/`confidenceLabel`/`fieldDisplayLabel`/`formatDate` return `""`; `formatDop` early-returns `""` when the number is not finite instead of embedding `"—"` in the `RD$` template. Alternative (return `null`) rejected: more churn, no benefit since callers render into text slots.
- **Drop inline fallbacks rather than keep `?? ""`.** For `ReactNode` value props, `app.phone ?? ""` and bare `app.phone` render the same for null/undefined; prefer removing the fallback for clarity. Keep an explicit `?? ""` only where the expression would otherwise render `0`/`false` or a non-string falsy that should be blank (decide per call site; default to the simplest correct form).
- **Preserve height in stacked KV via the component, not call sites.** Add a `min-h` equal to one line-height to the value `<span>` in `ui/KVCell` and the three local `KV` copies (e.g. `min-h-[1.2em]` matching their font size). This guarantees a consistent row whether or not the value is present, in one place per component — no `&nbsp;` hacks at call sites. Alternative (nbsp fallback per call) rejected: scatters the concern and reintroduces a magic value at every call.
- **Scope the cleanup with a precise grep.** Distinguish placeholders from prose by matching the placeholder forms (`return "—"`, `?? "—"`, `|| "—"`, `: "—"`) rather than every `—`.

## Risks / Trade-offs

- [A stacked row whose label is long and value empty looks slightly bare] → Acceptable; the reserved line keeps alignment, which is the requirement.
- [Some call sites render numbers/IDs where empty is genuinely ambiguous (e.g. score 0 vs absent)] → Existing guards already distinguish (`score != null ? score : "—"` → `: ""`); keep the null checks, only swap the placeholder.
- [Missing a placeholder or removing a legitimate dash] → Mitigated by the final scoped grep and a typecheck/build/lint pass.

## Migration Plan

1. Update the 5 formatters + `raw()` helper to return `""`.
2. Add value-line `min-h` to `ui/KVCell` and the three local `KV` components.
3. Remove inline `?? "—"` / `|| "—"` / `: "—"` fallbacks across the 8 pages.
4. Grep to confirm no placeholder `"—"` remains; typecheck, lint, build.

Rollback: revert; isolated to dashboard display, no data effects.

## Open Questions

- None. Empty-string return and component-level line-height are settled above.
