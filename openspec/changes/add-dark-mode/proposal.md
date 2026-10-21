## Why

The Ops app and the Mikro Decisión extension are light only. Evaluators and the founder work long hours in them, often at night, and the extension sits on top of bureau portals that may be dark.

## What Changes

- **Ops dashboard:**
  - A dark theme built from the same design tokens (`ds.*`, `brand.*`), redefined under `html.dark`. It uses **neutral grays**; blue stays only as the accent (primary button, links, selection). The extension keeps the navy brand look.
  - **Sistema** (follow the OS, live) is the default. A **Sistema / Claro / Oscuro** switch lives in the avatar menu, next to Cerrar sesión. It's a secondary control, not a primary action.
  - The choice is remembered per device.
  - About 780 hard-coded color classes become tokens.
  - New tokens:
    - `ds-violet`, `ds-violet-bg`, `ds-violet-tint`;
    - `ds-inverse` (dark chips such as tooltips stay dark);
    - `ds-green-solid` / `ds-red-solid` (buttons with white text stay strong in both themes).
- **Mikro Decisión extension:** the panel and the options page follow the OS setting (`prefers-color-scheme`), with no switch.
- **Pencil:**
  - the `ds.*` / `brand.*` variables gain a `mode: dark` theme value (light stays the default);
  - Ops board section **11 · Tema oscuro**: the avatar menu with the switch (light and dark), a dark admin feed, and two dark extension panels.

## Capabilities

### Modified Capabilities

- `dashboard-design-system`: themes (dark mode) and the theme switch.
- `credit-report-extension`: the panel follows the OS light/dark setting.

## Impact

- `mods/dashboard`:
  - `index.css` (tokens + dark palette);
  - `lib/theme.ts` (setting, OS sync);
  - `main.tsx` (applied before the first render);
  - `FounderShell.tsx` (switch in the avatar menu);
  - token codemod across the components;
  - e2e `theme.spec.ts`.
- `mods/score`: panel colors become CSS variables with a `prefers-color-scheme: dark` block; options page dark styles.
- `designs/mikro.lib.pen` (themed variables) + `designs/ops.pen` (section 11).
- No API, data or config changes.
