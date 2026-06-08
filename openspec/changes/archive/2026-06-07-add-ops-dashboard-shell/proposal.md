## Why

Internal ops staff need a back-office application to create contracts, manage loan requests, run accounting, manage users, and do basic loan management. Most of this already exists as protected tRPC procedures on `@mikro/apiserver`, but there is no operator-facing surface that consumes them. We need a foundation those feature screens can be built on — one that installs easily on Windows and macOS for staff today and can be served as a plain webapp later without a rewrite.

## What Changes

- Add a new `mods/dashboard` workspace: a Vite + React + Tailwind single-page app that is a typed tRPC client of `@mikro/apiserver`, reusing the `AppRouter` type and Bearer-JWT pattern already established in `mods/mobile/lib/trpc.ts`.
- Wrap that SPA as a cross-platform desktop app with **Tauri 2** (Windows + macOS). The shell is intentionally thin: it hosts the webview and the login/session — all business logic stays behind the API.
- Implement an operator login flow (phone E.164 + password → JWT → stored → sent as `Authorization: Bearer`), matching the existing `mikro auth` semantics, including 401/expiry handling.
- Provide the application chrome: top-level layout, navigation, and authenticated/unauthenticated routing — structured so the five feature areas slot in as later changes.
- Ship **one** proof-of-concept screen wired to an existing protected procedure (e.g. `listLoans` or `whoami`) to prove the full path end-to-end: login → token → authenticated tRPC call → rendered data.
- Keep the web build as the substrate: the same compiled SPA must be deployable as a standalone webapp later with zero refactor; Tauri only wraps it.
- Add config-driven CORS to `@mikro/apiserver` so browser-origin clients (the dashboard web build and the Tauri webview) can call the API. Native clients (mobile/CLI) are unaffected. Allowed origins come from a new `corsAllowedOrigins` config field.

Out of scope (follow-on changes): the feature screens themselves (accounting, user management, loan management); net-new backend work for the loan-request lifecycle and contract generation; production code signing / notarization (tracked as a known follow-up cost, not done here).

## Capabilities

### New Capabilities

- `ops-dashboard-shell`: The operations dashboard application foundation — a single React SPA delivered both as a Tauri 2 desktop app (Windows + macOS) and as a deployable webapp from the same build, with app layout, navigation, online-only operation, and at least one authenticated view backed by a real API procedure.
- `ops-dashboard-auth`: Operator authentication and session for the dashboard — phone + password login against the existing API, JWT acquisition and storage, attaching the Bearer token to tRPC requests, and handling logout and token expiry (401).
- `api-cors`: Cross-origin access control on `@mikro/apiserver` — configurable allowed origins so browser-based clients (the dashboard web build and the Tauri webview) can call the API while native clients remain unaffected.

### Modified Capabilities

<!-- None. openspec/specs/ is empty; this is the first capability set. The apiserver API surface is reused as-is with no requirement changes. -->

## Impact

- **New code**: `mods/dashboard` workspace (React/Vite/Tailwind frontend, Tauri 2 shell, tRPC client). Added to the root `workspaces` list and Lerna/Turbo build/test wiring.
- **Reused**: `@mikro/apiserver` (`AppRouter` type + existing protected procedures, e.g. `whoami`, `listLoans`); the JWT auth model; the `@trpc/client` + `httpBatchLink` + Bearer pattern from `mods/mobile`.
- **Modified (small)**: `@mikro/apiserver` gains a config-driven CORS middleware; `@mikro/common` config schema gains a `corsAllowedOrigins` field (with a dev-friendly default). No procedures or the auth model change.
- **New dependencies**: Tauri 2 (Rust toolchain for desktop builds), plus the dashboard's frontend deps (`@trpc/client`, `@tanstack/react-query`, router, Tailwind).
- **CI/build**: desktop packaging needs the Rust toolchain on build runners; the web build is a standard Vite static build.
- **Config**: dashboard needs the API base URL (env-based, like mobile's `EXPO_PUBLIC_API_URL`).
- **Known follow-up cost (not in this change)**: Apple notarization + a Windows code-signing certificate to make installers friction-free.
