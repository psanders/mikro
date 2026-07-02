# ops-dashboard-shell — delta

## MODIFIED Requirements

### Requirement: Application chrome and navigation

The dashboard SHALL route between an unauthenticated (login) area and the authenticated founder app based on session state. The founder app (`/founder`, `/founder/buscar`, `/founder/reportes`, rendered in the founder shell) is the only authenticated UI: after login an ADMIN user SHALL land on `/founder`, and unknown routes SHALL redirect there for admins. Non-admin authenticated users (COLLECTOR/REVIEWER) SHALL see an access screen explaining that the desktop app is the founder dashboard and directing them to the Mikro mobile app; they SHALL NOT reach founder routes. The retired operations navigation and its routes (`/solicitudes`, `/clientes`, `/contabilidad`, `/modelo`, Inicio) SHALL no longer exist.

#### Scenario: Unauthenticated user is routed to login

- **WHEN** an unauthenticated user opens the dashboard
- **THEN** the login view is shown and no authenticated area is accessible

#### Scenario: Admin lands on the founder app

- **WHEN** an ADMIN user logs in
- **THEN** the app navigates to `/founder` and the founder shell is shown

#### Scenario: Non-admin sees the access screen

- **WHEN** a COLLECTOR or REVIEWER logs in or opens any authenticated route
- **THEN** an access screen is shown pointing to the mobile app, and founder routes are not reachable

#### Scenario: Ops routes are gone

- **WHEN** any user navigates to `/solicitudes`, `/clientes`, `/contabilidad`, or `/modelo`
- **THEN** no operations view renders (admins are redirected to `/founder`; non-admins see the access screen)

#### Scenario: Founder routes are guarded

- **WHEN** an unauthenticated user attempts to open a `/founder` route
- **THEN** the auth guard redirects to login
