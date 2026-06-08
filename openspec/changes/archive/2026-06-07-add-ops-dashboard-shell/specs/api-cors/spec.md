## ADDED Requirements

### Requirement: Configurable cross-origin access for browser clients

`@mikro/apiserver` SHALL apply CORS so that browser-based clients can call the API. The set of allowed origins MUST come from configuration (`corsAllowedOrigins`) rather than being hardcoded, and MUST default to the dashboard's local dev origin and the Tauri webview origins. For an allowed origin the server SHALL echo that specific origin (never a wildcard) with `Vary: Origin`, allow the `Authorization` and `Content-Type` request headers, and answer the preflight `OPTIONS` request before routing. Native clients (mobile/CLI), which send no `Origin`, MUST be unaffected.

#### Scenario: Preflight from an allowed origin

- **WHEN** a browser sends an `OPTIONS` preflight to an API route with an `Origin` listed in `corsAllowedOrigins`
- **THEN** the server responds with a success status and headers `Access-Control-Allow-Origin` echoing that origin, `Vary: Origin`, `Access-Control-Allow-Methods`, and `Access-Control-Allow-Headers` including `Authorization`

#### Scenario: Actual request from an allowed origin carries the header

- **WHEN** a browser issues a `POST` (e.g. tRPC `login`) with an allowed `Origin`
- **THEN** the response includes `Access-Control-Allow-Origin` echoing that origin, so the browser does not block it

#### Scenario: Disallowed origin receives no allow header

- **WHEN** a request arrives with an `Origin` not listed in `corsAllowedOrigins`
- **THEN** the response carries no `Access-Control-Allow-Origin` header and the browser blocks the cross-origin read

#### Scenario: Native client is unaffected

- **WHEN** a request arrives with no `Origin` header (native mobile/CLI client)
- **THEN** the request is processed normally with no CORS headers required
