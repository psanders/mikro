## 1. Formatters return empty

- [x] 1.1 `src/lib/applications.ts`: `recommendationLabel`, `confidenceLabel`, `fieldDisplayLabel`, `formatDate` return `""` instead of `"—"`
- [x] 1.2 `src/lib/applications.ts`: `formatDop` early-returns `""` when the number is not finite (no bare `"RD$ "`)
- [x] 1.3 `SolicitudDetailPage` `raw()` helper returns `""` instead of `"—"`

## 2. Preserve stacked-row layout

- [x] 2.1 `ui/KVCell.tsx`: add a one-line `min-h` to the value span so empty values don't collapse the cell
- [x] 2.2 Apply the same value-line `min-h` to the local `KV` components in `SolicitudDetailPage`, `ClienteDetailPage`, `TransaccionDetailPage`

## 3. Remove inline placeholder fallbacks

- [x] 3.1 `SolicitudDetailPage`: KV/RailRow + computed `name` (`?? "—"` / `|| "—"` / `: "—"` → empty)
- [x] 3.2 `ClienteDetailPage`: KV rows
- [x] 3.3 `TransaccionDetailPage`: KV rows
- [x] 3.4 `ClientesPage`: list cells
- [x] 3.5 `SolicitudesPage`: name, businessName, score cells
- [x] 3.6 `OverviewPage`: name, businessName, score cells
- [x] 3.7 `ContabilidadPage`: descripcion, category cells (leave `— Seleccionar —` / `— Sin categoría —` select prompts)
- [x] 3.8 `ModeloPage`: breakEvenMonth value

## 4. Verify

- [x] 4.1 Grep confirms no placeholder `"—"` remains (`return "—"`, `?? "—"`, `|| "—"`, `: "—"`); legitimate prose/labels/select prompts retained
- [x] 4.2 Typecheck, lint, build pass
- [x] 4.3 Spot-check a detail screen with empty fields keeps row height/alignment
