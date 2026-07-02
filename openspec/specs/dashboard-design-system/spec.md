# dashboard-design-system Specification

## Purpose

TBD - created by archiving change add-dashboard-design-system. Update Purpose after archive.

## Requirements

### Requirement: Design tokens from Pencil

The dashboard SHALL define the Pencil design tokens as a single source of styling — Tailwind v4 `@theme` tokens / CSS variables — covering the `ds.*` semantic colors (background, surface, border, muted, subtle, and green/amber/red with their tints), the `brand.*` palette (blue deep/primary/sky, ink, mist), and the radii (card, ds, pill). Components and screens MUST consume these tokens rather than hardcoded hex values.

#### Scenario: Token values match the design

- **WHEN** a component uses a semantic color or radius
- **THEN** it resolves to the corresponding Pencil token value (e.g. `ds.bg` = `#F4F7FB`, `brand.blue.primary` = `#1F4AA8`, `radius.card` = 20)

#### Scenario: No ad-hoc hex in components

- **WHEN** a design-system component or a re-implemented screen needs a color or radius defined as a token
- **THEN** it references the token, not an inline hex literal

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

### Requirement: Pointer affordance on interactive elements

Clickable rows and interactive components that are not native buttons/links — table and list rows that open a detail, nav rows, list tiles, and custom toggles — MUST show a pointer cursor on hover, so it is visually clear they are actionable.

#### Scenario: Hovering a clickable row

- **WHEN** the user hovers over a table/list row that navigates to a detail (e.g. a Solicitudes, Clientes, or Contabilidad row)
- **THEN** the cursor changes to a pointer

#### Scenario: Hovering an interactive component

- **WHEN** the user hovers over an interactive design-system element rendered as a `div`/`span` (nav row, tile, toggle)
- **THEN** the cursor changes to a pointer

### Requirement: Back navigation via existing chrome

Detail screens SHALL NOT render a per-screen back breadcrumb (e.g. "Volver a solicitudes"). Returning to a list SHALL be done through the existing chrome — the sidebar navigation item for the section and the page-header context line — to reclaim vertical space and match the Pencil designs.

#### Scenario: Detail screen omits the breadcrumb

- **WHEN** a detail screen (Solicitud, Cliente, Transacción) renders
- **THEN** it shows no "Volver a …" breadcrumb component, and the corresponding sidebar nav item is the way back to the list
