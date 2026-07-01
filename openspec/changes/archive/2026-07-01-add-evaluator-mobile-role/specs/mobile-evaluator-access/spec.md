## ADDED Requirements

### Requirement: Mobile app decodes roles from the JWT after login

The mobile app SHALL decode the `roles` claim from the JWT returned by login and store it alongside the token so navigation can read it without an extra network call.

#### Scenario: Login response carries roles

- **WHEN** a user successfully logs in and the server returns a JWT containing a `roles` claim
- **THEN** the app decodes and stores those roles alongside the persisted token

### Requirement: Decoded roles survive PIN unlock and app resume

The mobile app SHALL make the decoded roles available after PIN unlock and on app resume, without requiring the user to log in again, as long as the stored token is still valid.

#### Scenario: App resumes after PIN unlock

- **WHEN** a returning user unlocks the app with their PIN
- **THEN** the previously decoded roles for the stored token are available to the navigation layer

### Requirement: Evaluator navigation is shown for REVIEWER/ADMIN roles

The mobile app SHALL present the evaluator tab bar (Inicio, Cola, Historial, Buscar) and evaluator screens when the logged-in user's roles include `REVIEWER` or `ADMIN`.

#### Scenario: Reviewer logs in

- **WHEN** a user whose roles include `REVIEWER` completes login and PIN unlock
- **THEN** the app shows the evaluator tab bar instead of the collector tab bar

#### Scenario: Admin logs in

- **WHEN** a user whose roles include `ADMIN` completes login and PIN unlock
- **THEN** the app shows the evaluator tab bar

### Requirement: Collector-only users see unchanged collector navigation

The mobile app SHALL continue showing the existing collector tab bar (Hoy, Ruta, Buscar, Cuadre) unchanged for users whose roles do not include `REVIEWER` or `ADMIN`.

#### Scenario: Collector-only user logs in

- **WHEN** a user whose only role is `COLLECTOR` completes login and PIN unlock
- **THEN** the app shows the existing collector tab bar with no evaluator screens reachable

### Requirement: Dual-role users default to evaluator navigation

When a logged-in user's roles include both `COLLECTOR` and (`REVIEWER` or `ADMIN`), the mobile app SHALL default to the evaluator tab bar.

#### Scenario: User has both COLLECTOR and REVIEWER roles

- **WHEN** a user whose roles include both `COLLECTOR` and `REVIEWER` completes login and PIN unlock
- **THEN** the app shows the evaluator tab bar

### Requirement: Dual-role users can switch between collector and evaluator navigation

The mobile app SHALL offer a manual switcher, reachable from the Perfil screen, for users whose roles include both `COLLECTOR` and (`REVIEWER` or `ADMIN`), letting them toggle between the evaluator and collector tab bars.

#### Scenario: Dual-role user switches to collector view

- **WHEN** a dual-role user opens the switcher on Perfil and selects the collector view
- **THEN** the app shows the collector tab bar (Hoy/Ruta/Buscar/Cuadre)

#### Scenario: Dual-role user switches back to evaluator view

- **WHEN** a dual-role user currently viewing the collector tab bar selects the evaluator view from the switcher
- **THEN** the app shows the evaluator tab bar again

#### Scenario: Single-role users do not see the switcher

- **WHEN** a user whose roles do not include both `COLLECTOR` and (`REVIEWER` or `ADMIN`) opens Perfil
- **THEN** no navigation switcher is shown
