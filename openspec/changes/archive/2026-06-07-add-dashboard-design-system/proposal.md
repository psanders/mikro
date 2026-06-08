## Why

The dashboard foundation (`add-ops-dashboard-shell`) shipped login and an overview screen as ad-hoc Tailwind, not matching the finished "Mikro Operations" design in `pencil.pen`. That design defines a full token system and a `cp/*` component library plus 11 screens. We should adopt it now — before more screens are built — so every future screen reuses one faithful, reviewable component set instead of accruing more ad-hoc UI.

## What Changes

- Encode the Pencil design tokens as Tailwind v4 `@theme` tokens / CSS variables: `ds.*` semantic colors (bg, surface, border, muted, subtle, green/amber/red + bg variants), `brand.*` (blue deep/primary/sky, ink, mist), and radii (card 20, ds 10, pill).
- Add **Storybook** (`@storybook/react-vite`) to `mods/dashboard`, with a story per component.
- Port the `cp/*` design-system components to React + Tailwind, faithful to Pencil: button (primary/secondary/success), field/input, search, tab, status badge, stat-card, summary-card, section-card, kv-row, page-header, nav-sidebar, progress-bar, icon-chip.
- Re-implement the **Login** screen to match Pencil frame `RRbG1` (split layout: gradient brand panel + white centered form), reusing the existing tRPC login wiring and auth/session behavior unchanged.
- Re-implement the **first screen / dashboard "Inicio"** to match Pencil frame `IDIY8` (nav sidebar + page header with "Nueva solicitud" CTA + four stat cards + a "Solicitudes recientes" table), wired to real data where procedures exist (`whoami`, `listLoans`) with loading/error states.
- Match Pencil faithfully on color, spacing, type, and copy.

Out of scope (follow-on changes): the other 9 screens (Solicitudes, Clientes, Préstamos, Contabilidad, Reportes, and detail screens), which will reuse this component library; and any backend changes.

## Capabilities

### New Capabilities

- `dashboard-design-system`: A token foundation, a React component library matching the Pencil `cp/*` components with Storybook coverage, and the first two design-faithful screens (Login and the "Inicio" dashboard) built from it — the shared visual vocabulary all dashboard screens build on.

### Modified Capabilities

<!-- None as deltas. The foundation change (add-ops-dashboard-shell) is not yet
     archived, so ops-dashboard-shell / ops-dashboard-auth have no base spec in
     openspec/specs/ to delta against. The design-faithful Login and Inicio
     screens are captured here as ADDED requirements under
     dashboard-design-system; the shell/auth specs stay behaviorally accurate
     (login flow, token/Bearer/401, routing are unchanged — only the views are
     re-skinned). Reconcile at archive time. -->

## Impact

- **New code**: design tokens in `mods/dashboard` (Tailwind `@theme` / CSS), a `components/ui` (or similar) component library with stories, and Storybook config. New dev deps: `@storybook/react-vite` + Storybook addons.
- **Reworked**: `mods/dashboard` login, layout/nav, and overview screens now compose the component library instead of inline Tailwind.
- **Reused, unchanged**: the tRPC client + auth seam, the `AppRouter`-typed procedures, and all `@mikro/apiserver` behavior (including the CORS added in the foundation change).
- **Design source**: `pencil.pen` via the `pencil` MCP tools — component library frame `d1E5om`, screens frame `ZB26x`, login `RRbG1`, dashboard `IDIY8`.
- **Build**: Storybook adds `storybook`/`build-storybook` scripts; the app's Vite build is unaffected.
