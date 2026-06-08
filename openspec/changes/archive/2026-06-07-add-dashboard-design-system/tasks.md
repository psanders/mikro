## 1. Design tokens

- [x] 1.1 Expand `mods/dashboard/src/index.css` `@theme` with the full Pencil token set: `ds.*` (bg, surface, border, muted, subtle, green/amber/red + tints), `brand.*` (blue deep/primary/sky, ink, mist, orange, yellow), and radii (card 20, ds 10, pill 9999), using a consistent kebab mapping (e.g. `--color-ds-bg`, `--radius-card`)
- [x] 1.2 Pull exact values via `get_variables` and confirm each token matches; confirm the app still builds (`npm run build -w @mikro/dashboard`)

## 2. Storybook setup

- [x] 2.1 Add Storybook (`@storybook/react-vite` 10.4.2, supports Vite 8) ; add `storybook` and `build-storybook` scripts
- [x] 2.2 Configure `.storybook` to use the app's Vite config + Tailwind so stories render with real tokens; import `index.css` in preview
- [x] 2.3 Confirm Storybook boots and renders a smoke-test story (`build-storybook` succeeds)

## 3. Component library (read each Pencil node, then build + story + diff)

- [x] 3.1 Button — primary / secondary / success (Pencil `cp/btn`, `cp/btn-primary`, `cp/btn-success`)
- [x] 3.2 Field / input (Pencil `cp/field`) with label, icon, and error states
- [x] 3.3 Search input (Pencil `cp/search`)
- [x] 3.4 Status badge (Pencil `cp/badge-icon` / status pills) covering the green/amber/red states
- [x] 3.5 Icon chip — sm / lg (Pencil `cp/icon-chip-sm`, `cp/icon-chip-lg`)
- [x] 3.6 Stat card (Pencil `cp/stat-card`) with label, value, icon, and delta indicator
- [x] 3.7 Summary card and section card (Pencil `cp/summary-card`, `cp/section-card`, `cp/section-card-open`)
- [x] 3.8 KV row / cell (Pencil `cp/kv-row`, `cp/kv-cell`)
- [x] 3.9 Tab (Pencil `cp/tab`) and progress bar (Pencil `cp/progress-bar`)
- [x] 3.10 Page header (Pencil `cp/page-header`) with title, subtitle, and action slot
- [x] 3.11 Nav sidebar (Pencil `cp/nav-sidebar`) with items, active state, and footer (config + user)
- [x] 3.12 Add a Storybook story for every component above (built from exact Pencil values; `build-storybook` passes; visual diff to confirm in `npm run storybook`)

## 4. Re-implement Login (Pencil `RRbG1`)

- [ ] 4.1 Build the split layout: gradient brand panel (560px, tagline "Opera tu cartera en un solo lugar." + supporting copy + footer) and white centered form side
- [ ] 4.2 Compose the form from library components: Teléfono + Contraseña fields, "Recuérdame" control, "¿Olvidaste tu contraseña?" link, "Iniciar sesión" button
- [ ] 4.3 Keep the existing `trpc.login.useMutation` → `completeLogin` wiring, validation, error display, and session behavior unchanged
- [x] 4.4 Diff against the Pencil login screenshot (color, spacing, type, copy) and confirm login still works end-to-end

## 5. Re-implement dashboard "Inicio" (Pencil `IDIY8`)

- [x] 5.1 Replace the shell layout with the nav-sidebar + main content area per design (nav items: Inicio, Solicitudes, Clientes, Préstamos, Contabilidad, Reportes; footer config + user)
- [x] 5.2 Add the page header ("Inicio" + subtitle) with the "Nueva solicitud" CTA (inert until the Solicitudes screen exists)
- [x] 5.3 Build the four stat cards (Cartera total, Solicitudes nuevas, Cobrado hoy, Tasa de mora); wire to real procedures where one exists, otherwise render a clearly-marked placeholder
- [x] 5.4 Build the "Solicitudes recientes" table (Cliente, Monto, Plazo, Estado) wired to `listLoans` with loading/error states
- [x] 5.5 Keep the `whoami`-backed session display; diff the whole screen against the Pencil dashboard screenshot

## 6. Verify

- [x] 6.1 `npm run typecheck -w @mikro/dashboard` and `npm run lint -w @mikro/dashboard` clean
- [x] 6.2 `npm run build -w @mikro/dashboard` and `build-storybook` succeed
- [x] 6.3 Run the app against the local apiserver and confirm login + Inicio render to design with live data where wired
