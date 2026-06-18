## Why

The dashboard renders an em-dash (`"—"`) wherever a value is missing — in formatters, key-value rows, list tables, and computed fields. It's visually noisy, adds no information, and clutters detail screens that have several optional fields. Empty reads cleaner.

## What Changes

- Change the shared formatters in `src/lib/applications.ts` (`recommendationLabel`, `confidenceLabel`, `formatDop`, `formatDate`, `fieldDisplayLabel`) to return an empty string instead of `"—"` for missing/invalid input. `formatDop` returns `""` entirely (not a bare `"RD$ "`).
- Remove inline `?? "—"` / `|| "—"` fallbacks across the pages (`SolicitudDetailPage`, `ClienteDetailPage`, `TransaccionDetailPage`, `ClientesPage`, `SolicitudesPage`, `OverviewPage`, `ContabilidadPage`, `ModeloPage`) and the `raw()` helper in `SolicitudDetailPage`; render empty.
- Preserve layout: the stacked key-value components (local `KV` copies + `ui/KVCell`) reserve their value line height so an empty value does not collapse the row.
- Define the empty-data display convention so future code follows it.
- **Out of scope (kept):** legitimate em-dashes in prose/labels (e.g. `"Rechazar — fuera de zona"`) and interactive select-prompt options (e.g. `"— Seleccionar —"`), which are input affordances, not missing-data markers.

## Capabilities

### New Capabilities

- `empty-data-display`: The dashboard convention for rendering absent values — missing data renders empty (no em-dash or other placeholder glyph), while layout (row height/alignment) is preserved.

### Modified Capabilities

<!-- No spec-level requirement changes to existing capabilities; only how absent values are rendered. -->

## Impact

- Modified: `src/lib/applications.ts` (5 formatters), `KVCell.tsx` and the local stacked `KV` components, and the 8 listed pages (remove inline fallbacks).
- No backend/API or data-model changes. No change to validation, prose labels, or select prompts.
