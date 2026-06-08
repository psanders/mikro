## ADDED Requirements

### Requirement: Design tokens from Pencil

The dashboard SHALL define the Pencil design tokens as a single source of styling — Tailwind v4 `@theme` tokens / CSS variables — covering the `ds.*` semantic colors (background, surface, border, muted, subtle, and green/amber/red with their tints), the `brand.*` palette (blue deep/primary/sky, ink, mist), and the radii (card, ds, pill). Components and screens MUST consume these tokens rather than hardcoded hex values.

#### Scenario: Token values match the design

- **WHEN** a component uses a semantic color or radius
- **THEN** it resolves to the corresponding Pencil token value (e.g. `ds.bg` = `#F4F7FB`, `brand.blue.primary` = `#1F4AA8`, `radius.card` = 20)

#### Scenario: No ad-hoc hex in components

- **WHEN** a design-system component or a re-implemented screen needs a color or radius defined as a token
- **THEN** it references the token, not an inline hex literal

### Requirement: Component library matching Pencil

The dashboard SHALL provide a React + Tailwind component library that mirrors the Pencil `cp/*` components, including: button (primary / secondary / success), field/input, search, tab, status badge, stat-card, summary-card, section-card, kv-row, page-header, nav-sidebar, progress-bar, and icon-chip. Each component MUST be faithful to its Pencil counterpart in color, spacing, typography, and structure.

#### Scenario: Component renders per design

- **WHEN** a library component is rendered with representative props
- **THEN** its appearance matches the corresponding Pencil component within the token system (colors, radii, spacing, type)

#### Scenario: Screens compose the library

- **WHEN** a dashboard screen needs a design-system element (button, field, card, badge, nav, header, etc.)
- **THEN** it composes the library component rather than re-implementing the markup inline

### Requirement: Storybook coverage

The dashboard SHALL include Storybook (`@storybook/react-vite`) with at least one story per library component, and provide scripts to run and build it.

#### Scenario: Stories render in Storybook

- **WHEN** Storybook is started
- **THEN** every library component appears with a story exercising its primary variants/states

### Requirement: Login screen matches the Pencil design

The login view SHALL match Pencil frame `RRbG1` ("Operations / 01 Inicio de sesión"): a split layout with a gradient brand panel (tagline "Opera tu cartera en un solo lugar.") and a white centered form (Teléfono and Contraseña fields, a "Recuérdame" control, a "¿Olvidaste tu contraseña?" link, and an "Iniciar sesión" button), built from the component library. The existing authentication behavior — login mutation, token storage, Bearer attachment, logout, and 401 handling — MUST be preserved unchanged.

#### Scenario: Login renders to design

- **WHEN** an unauthenticated operator opens the dashboard
- **THEN** the login screen renders the split brand/form layout and copy matching the Pencil design, using library components

#### Scenario: Authentication still works

- **WHEN** the operator submits valid credentials on the re-implemented login screen
- **THEN** the same login mutation runs, the token is stored, and the operator enters the authenticated area exactly as before

### Requirement: Dashboard "Inicio" screen matches the Pencil design

The first authenticated screen SHALL match Pencil frame `IDIY8` ("Operations / 02 Inicio (Dashboard)"): the nav sidebar, a page header with a "Nueva solicitud" call-to-action, four stat cards (Cartera total, Solicitudes nuevas, Cobrado hoy, Tasa de mora), and a "Solicitudes recientes" table — all built from the component library. Where a backing procedure exists (e.g. `whoami`, `listLoans`), the screen MUST show real data with loading and error states; other figures MAY be placeholders pending their procedures.

#### Scenario: Inicio renders to design

- **WHEN** an authenticated operator opens the dashboard
- **THEN** the "Inicio" screen renders the nav sidebar, page header with CTA, four stat cards, and the recent-requests table matching the Pencil design

#### Scenario: Live data where available

- **WHEN** the Inicio screen mounts and a backing procedure exists for a region
- **THEN** that region fetches via the authenticated tRPC client and shows loading and error states (online-only), rather than a static placeholder
