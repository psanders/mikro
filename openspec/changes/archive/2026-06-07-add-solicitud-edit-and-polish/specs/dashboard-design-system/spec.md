## MODIFIED Requirements

### Requirement: Component library matching Pencil

The dashboard SHALL provide a React + Tailwind component library that mirrors the Pencil `cp/*` components, including: button (primary / secondary / success), field/input, search, tab, status badge, stat-card, summary-card, section-card, kv-row, page-header, nav-sidebar, progress-bar, and icon-chip. Each component MUST be faithful to its Pencil counterpart in color, spacing, typography, and structure. The `section-card` (accordion) MUST use comfortable, consistent padding so a collapsed section reads as a proper card (not a thin strip) and open bodies share a consistent inset; it MAY be collapsible via an `onToggle` affordance.

#### Scenario: Component renders per design

- **WHEN** a library component is rendered with representative props
- **THEN** its appearance matches the corresponding Pencil component within the token system (colors, radii, spacing, type)

#### Scenario: Screens compose the library

- **WHEN** a dashboard screen needs a design-system element (button, field, card, badge, nav, header, etc.)
- **THEN** it composes the library component rather than re-implementing the markup inline

#### Scenario: Collapsible section card is well-padded

- **WHEN** a `section-card` is rendered collapsed and expanded
- **THEN** the collapsed header has comfortable vertical padding and the expanded body uses a consistent inset
