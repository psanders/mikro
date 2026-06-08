## Context

Mikro is an npm/Lerna monorepo (`mods/*`, `site`). The backend (`@mikro/apiserver`) exposes a tRPC API over Express and ships its `AppRouter` type for typed clients. The mobile app already consumes it: `mods/mobile/lib/trpc.ts` builds a `createTRPCClient<AppRouter>` with an `httpBatchLink` to `${API_URL}/trpc` and an `async headers()` that attaches `Authorization: Bearer <token>`. Auth is per-user JWT only (phone E.164 + password → token, `jwtExpiresIn` default 30d). The public `site` is Vite + React + Tailwind but does not touch the API.

This change establishes the foundation for an internal operations dashboard. The five eventual feature areas (contracts, loan requests, accounting, user management, basic loan management) are deliberately out of scope here; most of their API surface already exists as protected procedures. The foundation must prove the full client path and remain deployable as a plain webapp later.

## Goals / Non-Goals

**Goals:**

- A `mods/dashboard` workspace: one Vite + React + Tailwind SPA that is a typed tRPC client of `@mikro/apiserver`.
- Tauri 2 desktop packaging for Windows + macOS, with a deliberately thin shell.
- The same web build deployable as a standalone webapp with zero source changes.
- Operator login (phone + password → JWT), token storage, Bearer on every request, logout, and 401/expiry handling.
- Application chrome (layout + navigation + authed/unauthed routing) that later feature areas slot into.
- One proof-of-concept screen calling a real protected procedure (`whoami` or `listLoans`).

**Non-Goals:**

- The feature screens themselves (accounting, users, loan management) — follow-on changes.
- Net-new backend work (loan-request lifecycle, contract generation) — follow-on changes.
- Production code signing / Apple notarization / Windows certificate — known follow-up cost, not done here.
- Offline support — the dashboard is online-only by decision.

## Decisions

**Tauri 2 over Electron for the desktop shell.**
Because all business logic lives behind the tRPC API, the desktop shell needs to do almost nothing (host a webview, hold the session). Tauri produces small installers (~MBs vs ~100MB+), uses the OS webview, and keeps the frontend a pure web build — so the "deploy as webapp later" path is the same artifact, not a port. Electron's main advantage (a heavy Node process in the shell) buys us nothing here. Trade-off: Tauri adds a Rust toolchain to desktop builds (CI cost).
_Alternatives:_ Electron (rejected: size/memory, no benefit given thin shell); PWA-only (rejected: weaker native install/menus, though it stays viable since the web build exists); reuse Expo/RN for desktop (rejected: weak/experimental desktop story, poor fit for data-dense back-office UI).

**Frontend stack: Vite + React + Tailwind, mirroring `site`.**
The team already builds React with Vite + Tailwind in `site`, and React with tRPC in mobile. Reusing this stack minimizes new concepts and keeps the build a standard static Vite output that Tauri can wrap and a static host can serve.
_Alternatives:_ Next.js (rejected: SSR/server runtime is unnecessary for an internal SPA and complicates the static/desktop story).

**Reuse the mobile tRPC client pattern, adapted to a browser/webview.**
Use `createTRPCClient<AppRouter>` + `httpBatchLink` to `${API_URL}/trpc` with an `async headers()` Bearer injection, plus an auth-error link that detects 401 — directly mirroring `mods/mobile/lib/trpc.ts` and `authErrorLink`. Add `@tanstack/react-query` (already used in mobile) for data fetching/caching in the UI.
_Alternatives:_ Hand-rolled fetch wrappers (rejected: loses end-to-end type safety from `AppRouter`).

**Token storage abstracted behind a small interface.**
Define one `getToken/setToken/clearToken` seam. On web, back it with browser storage; in Tauri, it can later use a more secure store. Keeping it behind an interface means the same UI code runs on both targets and the storage backend can harden without touching screens. The 30-day JWT means session-restore-on-launch is expected behavior.
_Alternatives:_ Direct `localStorage` calls scattered in components (rejected: couples UI to a web-only API and blocks a secure desktop store).

**API base URL via environment configuration.**
Mirror mobile's `EXPO_PUBLIC_API_URL` with a Vite env var (e.g. `VITE_API_URL`) so one build can target different hosts and the desktop and web targets differ only in configuration.

**Capability split: `ops-dashboard-shell` + `ops-dashboard-auth`.**
Shell covers packaging, single-codebase delivery, chrome/navigation, and the end-to-end POC; auth covers login/session/Bearer/expiry. Keeping auth separate lets its requirements evolve (e.g. admin-only routes) without touching shell specs.

## Risks / Trade-offs

- **Rust toolchain in CI for Tauri builds** → Desktop packaging requires Rust on build runners; document setup and keep web builds (the common path) toolchain-free so day-to-day work isn't blocked.
- **Code signing deferred** → Unsigned installers trigger OS warnings ("unidentified developer", SmartScreen). Acceptable for an internal pilot; tracked as an explicit follow-up (Apple notarization + Windows cert) before broad rollout.
- **Webview API parity across OS versions** → Tauri uses the system webview (WebView2 on Windows, WKWebView on macOS); older/edge webviews may differ. Mitigation: target a modern baseline and test the POC on both OSes early.
- **CORS / auth headers from a browser origin** → A browser-served webapp hits the API from a different origin than mobile; confirm the apiserver's CORS allows the dashboard origin and the `Authorization` header. Mitigation: verify against a running apiserver as part of the POC.
- **Scope creep into feature screens** → The temptation to "just add accounting too." Mitigation: the proposal hard-scopes this to the shell + one POC screen; everything else is a separate change.

## Migration Plan

This is additive — a new workspace, no changes to existing packages or the API.

1. Scaffold `mods/dashboard` (Vite + React + Tailwind), add it to root `workspaces` and build/test wiring.
2. Add the tRPC client + auth seam; implement login, session restore, Bearer injection, logout, 401 handling.
3. Add app chrome (layout, navigation, authed/unauthed routing) and the one POC screen against `whoami`/`listLoans`.
4. Add the Tauri 2 shell and verify desktop launch on Windows + macOS; verify the same build runs as a web SPA.
5. Rollback is trivial: the workspace is self-contained and can be removed without affecting other packages.

## Open Questions

- Which procedure for the POC screen — `whoami` (simplest, proves auth) or `listLoans` (proves a real data list)? Leaning `whoami` first, optionally `listLoans` to exercise a table.
- Router choice: `react-router-dom` (as in `site`) vs TanStack Router — default to `react-router-dom` for consistency unless there's a reason to differ.
- Does the running apiserver already permit a browser origin via CORS, or is a config addition needed for the web target?
- Where should the dashboard's API URL config live for desktop builds (bundled env vs a settings input)?
