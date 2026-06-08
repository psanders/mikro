# @mikro/dashboard

Internal **operations dashboard** for Mikro ops staff. One React (Vite + Tailwind)
SPA that is a typed tRPC client of `@mikro/apiserver`, delivered two ways from the
**same build**:

- **Desktop** (Windows + macOS) via a thin [Tauri 2](https://tauri.app) shell.
- **Web** — the same `dist/` served as static assets.

The shell does almost nothing: it hosts the webview and the login session. All
business logic stays behind the tRPC API. This package is the _foundation_ —
feature screens (accounting, user management, loan management) land as later
changes; see `openspec/changes/add-ops-dashboard-shell/`.

## Configuration

Copy `.env.example` to `.env` and set the API base URL (no trailing slash; the
client appends `/trpc`):

```
VITE_API_URL=http://localhost:4000
```

## Develop

From the repo root:

```bash
npm run start:dashboard        # web dev server at http://localhost:5174
npm run tauri:dashboard:dev    # desktop app (Tauri) — compiles Rust on first run
```

## Build

```bash
npm run build:dashboard        # web build → mods/dashboard/dist
npm run tauri:dashboard:build  # desktop installers (.app/.dmg, .exe/.msi)
```

The web build is the substrate; the desktop build wraps the very same `dist/`
(see `src-tauri/tauri.conf.json` → `frontendDist: "../dist"`). Deploying as a
plain webapp = host `dist/` and point `VITE_API_URL` at the API. No source
changes.

## Prerequisites

- **Web**: Node ≥ 22 only.
- **Desktop**: also the **Rust toolchain** (`rustup`/`cargo`), **rustc ≥ 1.88**
  (Tauri's current dependency tree requires it — run `rustup update stable` if
  `tauri dev` reports an unsupported-rustc error), plus each OS's Tauri
  prerequisites — see https://tauri.app/start/prerequisites/. Day-to-day web work
  needs no Rust.

### Regenerating app icons

Icons under `src-tauri/icons/` were generated from a 1024×1024 source:

```bash
npm run tauri -w @mikro/dashboard icon ../mobile/assets/icon.png
```

## Known follow-ups (not done in the foundation change)

- **API CORS** — `@mikro/apiserver` currently ships **no CORS middleware**. Native
  mobile doesn't need it, but a **browser-served** dashboard (dev origin
  `http://localhost:5174`, plus the deployed origin and the Tauri webview origin
  `tauri://localhost` / `http://tauri.localhost`) will be blocked by the browser
  until the API sends `Access-Control-Allow-Origin` for those origins, allows the
  `Authorization` header, and answers `OPTIONS` preflight. Add this to the API
  (or front it with a reverse proxy) before the web target works end-to-end.
- **Code signing** — installers are unsigned, so macOS Gatekeeper and Windows
  SmartScreen will warn. Before broad rollout, set up Apple notarization and a
  Windows code-signing certificate.
