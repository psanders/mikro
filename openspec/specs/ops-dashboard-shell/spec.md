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

### Requirement: Authenticated end-to-end data path

The dashboard SHALL include at least one view that calls an existing protected procedure on `@mikro/apiserver` using the authenticated tRPC client and renders the returned data, proving the login → token → authenticated request → render path end to end.

#### Scenario: Proof-of-concept screen renders live data

- **WHEN** an authenticated operator opens the proof-of-concept screen
- **THEN** the dashboard calls a protected procedure (such as `whoami` or `listLoans`) with the Bearer token and renders the response

#### Scenario: Online-only behavior on API unavailability

- **WHEN** the API is unreachable while loading an authenticated view
- **THEN** the dashboard surfaces an error state rather than serving stale or offline data
