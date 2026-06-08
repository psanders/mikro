# ops-dashboard-shell Specification

## Purpose

TBD - created by archiving change add-ops-dashboard-shell. Update Purpose after archive.

## Requirements

### Requirement: Single codebase for desktop and web

The operations dashboard SHALL be a single React single-page application whose compiled web build is the substrate for both delivery targets: a Tauri 2 desktop app and a standalone webapp. Producing the webapp from the same build MUST NOT require source changes to the application code.

#### Scenario: Desktop build wraps the web app

- **WHEN** the dashboard is built for desktop with Tauri 2
- **THEN** the produced application loads the same compiled SPA assets used for the web target, with no fork of the application source

#### Scenario: Web deployment from the same build

- **WHEN** the dashboard's web build output is served as static assets and pointed at a reachable API base URL
- **THEN** the application runs in a browser with the same screens and behavior as the desktop app, without code changes

### Requirement: Cross-platform desktop packaging

The dashboard SHALL be packageable as a desktop application for Windows and macOS using Tauri 2. The desktop shell MUST remain thin — hosting the webview and session only — with all business logic served by `@mikro/apiserver`.

#### Scenario: Windows package

- **WHEN** the desktop build is run for the Windows target
- **THEN** an installable Windows application is produced that launches the dashboard

#### Scenario: macOS package

- **WHEN** the desktop build is run for the macOS target
- **THEN** an installable macOS application is produced that launches the dashboard

### Requirement: Configurable API base URL

The dashboard SHALL read its API base URL from environment-based configuration rather than a hardcoded value, so the same build can target different API hosts.

#### Scenario: API URL supplied by configuration

- **WHEN** the dashboard starts with an API base URL provided via its environment configuration
- **THEN** all API requests are issued against that configured base URL

### Requirement: Application chrome and navigation

The dashboard SHALL provide a top-level application layout with navigation, and SHALL route between an authenticated area and an unauthenticated (login) area based on session state. The navigation structure MUST be extensible so additional feature areas can be added as later changes without restructuring the shell. The "Solicitudes" navigation item SHALL route to the applications list (`/solicitudes`) and show the active highlight when on a Solicitudes route. The Inicio "Solicitudes recientes" section SHALL show recent loan applications (from `listApplications`), with rows linking to the application detail. The "Clientes" navigation item SHALL route to the customers list (`/clientes`) and show the active highlight when on a Clientes route, and the authenticated area SHALL include routes for `/clientes` and `/clientes/:id` under the auth guard. The "Contabilidad" navigation item SHALL route to the accounting ledger (`/contabilidad`) and show the active highlight when on a Contabilidad route, and the authenticated area SHALL include routes for `/contabilidad` and `/contabilidad/:id` under the auth guard.

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

### Requirement: Authenticated end-to-end data path

The dashboard SHALL include at least one view that calls an existing protected procedure on `@mikro/apiserver` using the authenticated tRPC client and renders the returned data, proving the login → token → authenticated request → render path end to end.

#### Scenario: Proof-of-concept screen renders live data

- **WHEN** an authenticated operator opens the proof-of-concept screen
- **THEN** the dashboard calls a protected procedure (such as `whoami` or `listLoans`) with the Bearer token and renders the response

#### Scenario: Online-only behavior on API unavailability

- **WHEN** the API is unreachable while loading an authenticated view
- **THEN** the dashboard surfaces an error state rather than serving stale or offline data
