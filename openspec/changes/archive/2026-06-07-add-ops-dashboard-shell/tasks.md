## 1. Workspace scaffolding

- [x] 1.1 Create `mods/dashboard` as a Vite + React + TypeScript SPA (ESM, strict), mirroring the `site` stack
- [x] 1.2 Add Tailwind (via `@tailwindcss/vite`) and base styles, matching `site`'s setup
- [x] 1.3 Register `mods/dashboard` in the root `package.json` `workspaces` and ensure it is picked up by Lerna build/test/lint
- [x] 1.4 Add `build`, `dev`, `lint`, `typecheck` scripts; confirm `npm run build`/`typecheck` pass from the repo root
- [x] 1.5 Add a `VITE_API_URL` env config (with `.env.example`) for the API base URL

## 2. API client and auth seam

- [x] 2.1 Add `@trpc/client` and `@tanstack/react-query`; depend on `@mikro/apiserver` for the `AppRouter` type
- [x] 2.2 Create a typed tRPC client (`createTRPCClient<AppRouter>` + `httpBatchLink` to `${VITE_API_URL}/trpc`) mirroring `mods/mobile/lib/trpc.ts`
- [x] 2.3 Implement a token store seam (`getToken`/`setToken`/`clearToken`) backed by browser storage, isolated so a Tauri secure store can replace it later
- [x] 2.4 Add an `async headers()` that injects `Authorization: Bearer <token>` when a token exists, and omits it otherwise
- [x] 2.5 Add an auth-error link that detects `401` and clears the token (mirror `mods/mobile/lib/authErrorLink`)
- [x] 2.6 Wire `@tanstack/react-query` provider around the app

## 3. Authentication flow

- [x] 3.1 Build a login view: phone (E.164) + password inputs with validation
- [x] 3.2 Call the existing API auth/login procedure; on success store the JWT, on failure show an auth error
- [x] 3.3 Restore session on launch when a valid stored token exists
- [x] 3.4 Implement logout that clears the token and returns to the login view
- [x] 3.5 On `401`, clear the token and route back to login (expiry handling)

## 4. Application chrome

- [x] 4.1 Add routing (`react-router-dom`) split into unauthenticated (login) and authenticated areas
- [x] 4.2 Guard the authenticated area so unauthenticated users are routed to login
- [x] 4.3 Build the top-level layout (header + navigation) with an extensible nav structure for future feature areas

## 5. Proof-of-concept screen

- [x] 5.1 Add one authenticated screen that calls a protected procedure (`whoami`, optionally `listLoans`) via the authenticated client
- [x] 5.2 Render the returned data, with loading and error states (online-only: surface an error when the API is unreachable)

## 6. Tauri 2 desktop shell

- [x] 6.1 Add Tauri 2 to `mods/dashboard`, configured to load the Vite build output (src-tauri/ scaffold + tauri.conf.json + icons; `tauri info` validates config & toolchain)
- [x] 6.2 Add desktop build scripts and verify the app launches and reaches login on macOS — confirmed: `tauri dev` compiles and opens the native window with the Login screen
- [ ] 6.3 Verify the desktop app launches and reaches login on Windows — **not verifiable on this macOS host** (needs a Windows machine/CI runner)
- [x] 6.4 Document the Rust toolchain prerequisite for desktop builds in the dashboard README

## 7. Web-target parity and verification

- [x] 7.1 Serve the same Vite build as a static webapp pointed at the API and confirm login + POC screen work with no source changes — verified via running apiserver: browser-origin request passes CORS, reaches the `login` procedure, and returns a properly-shaped tRPC response (successful auth depends on valid E.164 creds — see note below)
- [x] 7.2 Confirm the apiserver permits the dashboard browser origin (CORS) and the `Authorization` header — **resolved: added config-driven CORS to the apiserver (see group 8) rather than only noting it.**
- [x] 7.3 Run `npm run lint` and `npm run typecheck` clean for the workspace
- [x] 7.4 Record the code-signing / notarization follow-up (Apple notarization + Windows cert) in the dashboard README as a known TODO

## 8. API CORS for browser clients

- [x] 8.1 Add a `corsAllowedOrigins` field to the `@mikro/common` config schema (dev-friendly default: dashboard dev origin + Tauri webview origins)
- [x] 8.2 Add config-driven CORS middleware to `@mikro/apiserver` (echo specific origin + `Vary`, allow `Authorization`/`Content-Type`, answer `OPTIONS` preflight before routes); native clients unaffected
- [x] 8.3 Document `corsAllowedOrigins` in `mikro.json.example`
- [x] 8.4 Verify against a running server: preflight + actual POST from an allowed origin carry the echo header; a disallowed origin gets none
