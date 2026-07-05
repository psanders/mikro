# @mikro/dashboard

Internal **founder dashboard** for Mikro. One React (Vite + Tailwind) SPA that
is a typed tRPC client of `@mikro/apiserver`, delivered two ways from the
**same build**:

- **Desktop** (Windows + macOS) via a thin [Tauri 2](https://tauri.app) shell.
- **Web** — the same `dist/` served as static assets.

The shell does almost nothing: it hosts the webview and the login session. All
business logic stays behind the tRPC API. Authenticated admins land on the
founder app (feed, búsqueda, reportes, copilot); collectors/reviewers get a
pointer to the mobile app instead — day-to-day collection and review work
lives there, not in this dashboard. See
`openspec/changes/archive/2026-07-04-retire-ops-dashboard-ui/` for how that
split came to be.

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

### Signing the updater artifacts

`bundle.createUpdaterArtifacts` is `true`, so `tauri build` **signs** the
updater bundle (`.app.tar.gz` / `.sig`) with the minisign key whose public half
is baked into `plugins.updater.pubkey`. That requires two env vars, or the build
fails with _"A public key has been found, but no private key"_:

```bash
cd mods/dashboard
TAURI_SIGNING_PRIVATE_KEY="$(cat ../../.keys/tauri-updater.key)" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD='<password>' \
npm run tauri:build
```

- **CI** supplies these from repo secrets `TAURI_SIGNING_PRIVATE_KEY` /
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (see
  `.github/workflows/build-dashboard.yaml`). This is the path that matters — CI
  is what produces the releases clients actually update to.
- **Locally**, the key lives at `.keys/tauri-updater.key` (git-ignored,
  password-protected — the password is the CI secret, not stored in the repo).
  If you only need a runnable app and not the update flow, build **without**
  signing via:

  ```bash
  npm run tauri:dashboard:build:local
  ```

  That passes `src-tauri/tauri.local.conf.json`, a partial config Tauri
  deep-merges over the base to set `createUpdaterArtifacts: false`. The base
  `tauri.conf.json` stays `true`, so CI is unaffected and there's no flag to
  remember to revert. The local build produces a runnable, ad-hoc-signed `.app`
  but no `.sig`/manifest, so it can't exercise the update flow.

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

## Auto-update behaviour

The desktop updater (`src/lib/updater.ts`) is **silent and non-blocking**: on
launch and hourly it checks the manifest, and if a newer signed build exists it
downloads + installs it in the background — no prompt interrupts the operator.
Once staged, a dismissible banner (`UpdateBanner`) reports that the update
applies on next launch and offers a "Reiniciar ahora" button. Quitting during a
download is harmless; the next launch re-stages it.

### Known issue: verify the swap on disk, not by the window title

The install swaps the bundle in place; the compiled-in version only takes effect
on the **next launch**. To confirm an update actually applied, read the bundle
rather than trusting the running window title (which reflects the version at the
time that process launched):

```bash
/usr/libexec/PlistBuddy -c "Print CFBundleShortVersionString" /Applications/Mikro.app/Contents/Info.plist
```

On our ad-hoc signed bundles a `relaunch()` can occasionally re-run the
already-loaded old image rather than cold-launching the swapped binary; a full
`Cmd+Q` + relaunch always picks up the new version. Cosmetic — it does not affect
whether the update installed.

### Known issue: stale Screen Recording / Microphone entry after deleting the app (macOS)

macOS stores TCC privacy grants keyed to the bundle id `do.mikro.dashboard` in a
database **independent of the app bundle**. Deleting `/Applications/Mikro.app`
does **not** remove the grant, so a stale (often greyed-out) **Mikro** row lingers
in System Settings → Privacy & Security → **Screen & System Audio Recording** and
**Microphone**.

`tccutil reset All do.mikro.dashboard` is the normal way to clear grants, but it
resolves the bundle id through LaunchServices and **fails once the app is deleted**:

```
tccutil: No such bundle identifier "do.mikro.dashboard" … (OSStatus error -10814.)
```

Chicken-and-egg: the grant outlives the app, but the tool that clears it needs the
app present. Fixes, in order of preference:

1. **Remove the row manually** (works with the app already deleted): select
   **Mikro** in each privacy list, click **−**, authenticate, then `Cmd+Q` System
   Settings and reopen to confirm it's gone.
2. **Reset before deleting** — run `tccutil reset All do.mikro.dashboard` **while
   the app is still installed**, then delete it.
3. If you've already deleted it and prefer `tccutil`: rebuild/reinstall the app
   (`npm run tauri:dashboard:build:local`), reset, then delete again.

A clean rebuild after removal re-triggers fresh Screen + Audio permission prompts.
The complete app footprint to delete for a full reset: `/Applications/Mikro.app`,
`~/Library/Caches/do.mikro.dashboard`, `~/Library/WebKit/do.mikro.dashboard` (the
Tauri shell leaves nothing in Application Support / Preferences / Containers).
