## ADDED Requirements

### Requirement: Light and dark themes from the same tokens

The Ops dashboard SHALL render every screen in a light and a dark theme built from the same design tokens (`ds.*`, `brand.*`), redefined for dark under `html.dark`. Components SHALL use tokens rather than hard-coded colors so that both themes apply. Buttons with white text SHALL use the solid tokens (`ds-green-solid`, `ds-red-solid`), which keep their contrast in both themes.

#### Scenario: Dark theme applied

- **WHEN** the dark theme is active
- **THEN** the page background, surfaces, borders, text and status colors use the dark token values, and white-text buttons keep a solid fill

### Requirement: Theme setting defaults to the system

The dashboard SHALL offer the theme setting **Sistema / Claro / Oscuro** in the avatar menu, next to Cerrar sesión, as a secondary control. **Sistema** SHALL be the default and SHALL follow the OS light/dark setting, including changes while the app is open. Claro and Oscuro SHALL override the OS. The choice SHALL be remembered on the device and applied before the first render.

#### Scenario: Default follows the OS

- **WHEN** nothing was chosen and the OS is in dark mode
- **THEN** the dashboard opens dark, and turns light if the OS switches to light

#### Scenario: Manual choice is remembered

- **WHEN** the user picks Oscuro while the OS is light, and reloads
- **THEN** the dashboard is still dark

#### Scenario: Back to Sistema

- **WHEN** the user picks Sistema again
- **THEN** the dashboard follows the OS once more
