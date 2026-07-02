# ops-dashboard-shell — delta

## MODIFIED Requirements

### Requirement: Application chrome and navigation

The dashboard SHALL provide a top-level application layout with navigation, and SHALL route between an authenticated area and an unauthenticated (login) area based on session state. The navigation structure MUST be extensible so additional feature areas can be added as later changes without restructuring the shell. The "Solicitudes" navigation item SHALL route to the applications list (`/solicitudes`) and show the active highlight when on a Solicitudes route. The Inicio "Solicitudes recientes" section SHALL show recent loan applications (from `listApplications`), with rows linking to the application detail. The "Clientes" navigation item SHALL route to the customers list (`/clientes`) and show the active highlight when on a Clientes route, and the authenticated area SHALL include routes for `/clientes` and `/clientes/:id` under the auth guard. The "Contabilidad" navigation item SHALL route to the accounting ledger (`/contabilidad`) and show the active highlight when on a Contabilidad route, and the authenticated area SHALL include routes for `/contabilidad` and `/contabilidad/:id` under the auth guard.

The founder app is a separate, self-contained area: its routes (`/founder`, `/founder/buscar`, `/founder/reportes`) SHALL render with their own founder shell OUTSIDE the operations layout, and the operations navigation SHALL NOT gain founder items. The only operations-shell behavior change is landing: an ADMIN user's default landing after login SHALL be `/founder`; non-admin users keep their current landing and cannot access founder routes.

#### Scenario: Unauthenticated user is routed to login

- **WHEN** an unauthenticated user opens the dashboard
- **THEN** the login view is shown and the authenticated application area is not accessible

#### Scenario: Authenticated user sees the application shell

- **WHEN** an authenticated user opens the dashboard
- **THEN** the top-level layout with navigation is shown and authenticated views are reachable

#### Scenario: Solicitudes nav routes to the list

- **WHEN** an authenticated user clicks the "Solicitudes" nav item
- **THEN** the app navigates to `/solicitudes` and the item shows the active highlight

#### Scenario: Inicio shows recent applications

- **WHEN** an authenticated reviewer views Inicio
- **THEN** the "Solicitudes recientes" section lists recent loan applications and a row opens its detail

#### Scenario: Clientes nav routes to the list

- **WHEN** an authenticated user clicks the "Clientes" nav item
- **THEN** the app navigates to `/clientes` and the item shows the active highlight

#### Scenario: Clientes routes are guarded

- **WHEN** an unauthenticated user attempts to open `/clientes` or `/clientes/:id`
- **THEN** the auth guard redirects to login and the customer views are not accessible

#### Scenario: Contabilidad nav routes to the ledger

- **WHEN** an authenticated user clicks the "Contabilidad" nav item
- **THEN** the app navigates to `/contabilidad` and the item shows the active highlight

#### Scenario: Contabilidad routes are guarded

- **WHEN** an unauthenticated user attempts to open `/contabilidad` or `/contabilidad/:id`
- **THEN** the auth guard redirects to login and the accounting views are not accessible

#### Scenario: Admin lands on the founder app

- **WHEN** an ADMIN user logs in
- **THEN** the app navigates to `/founder` and the founder shell (not the operations layout) is shown

#### Scenario: Operations navigation is unchanged

- **WHEN** any authenticated user views the operations layout's navigation
- **THEN** it contains no founder items and behaves exactly as before this change

#### Scenario: Founder routes are inaccessible to non-admins

- **WHEN** a non-admin authenticated user opens `/founder`, `/founder/buscar`, or `/founder/reportes`
- **THEN** the user is redirected away and the founder views are not shown

#### Scenario: Founder routes are guarded

- **WHEN** an unauthenticated user attempts to open a `/founder` route
- **THEN** the auth guard redirects to login
