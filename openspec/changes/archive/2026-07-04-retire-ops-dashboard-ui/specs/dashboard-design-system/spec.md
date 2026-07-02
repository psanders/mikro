# dashboard-design-system — delta

## REMOVED Requirements

### Requirement: Dashboard "Inicio" screen matches the Pencil design

**Reason**: The Inicio screen is retired with the operations dashboard UI; the founder feed is the home.
**Migration**: Founder screens are specified in `founder-feed`/`founder-search`/`founder-reports` against Pencil board `EzobQ`.

### Requirement: Component library matching Pencil

**Reason**: The ops `cp/*` component library is retired with the operations screens; the founder app carries its own components per screen.
**Migration**: Founder components live in `src/founder/` with Storybook stories; the design tokens requirement remains in force.
