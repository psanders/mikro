# Proposal: retire-ops-dashboard-ui

## Why

The founder direction is confirmed (user, 2026-07-04: "one hundred percent confident"). The old operations dashboard UI is now dead weight: its jobs are covered by the founder feed + copilot (Consultar/Actuar/Auditar) and by the mobile app (collector + evaluator roles). Keeping two UIs doubles maintenance and dilutes the product. **Only the UI retires** — every apiserver API, SDK surface, and business capability stays exactly as is.

## What Changes

- **REMOVE the ops dashboard UI**: pages (Overview/Inicio, Solicitudes list + detail + edit/sign/convert flows, Clientes list + detail, Contabilidad + transaction detail, Modelo), the ops `Layout`/`NavSidebar`, and the `cp/*`-style ops component library + its stories — everything in `mods/dashboard` not needed by login, the founder app, or shared plumbing (auth context, tRPC client, lib helpers, ToastProvider, AppUpdater, Tauri shell).
- **Founder path becomes the default**: login → `/founder` for ADMIN users. Non-admin users (COLLECTOR/REVIEWER) get a clear access screen pointing to the mobile app — there is no ops UI left to land on. **BREAKING** for dashboard reviewers: the desktop review flow is retired; review lives in the mobile evaluator app and via the copilot.
- **Feed subject links change target**: "Ver solicitud/cliente/préstamo" opened ops detail pages that no longer exist — they now open the copilot prefilled with a question about that entity.
- **Pencil**: the ops v2 design cluster (`YqrDN`) is marked DEPRECATED (kept for history, like `ZB26x`); the founder board `EzobQ` is the only active dashboard design.
- **NOT changed**: apiserver procedures (incl. sendPromo, review transitions, accounting, modelo projection engine consumers), `@mikro/common`, mobile app, WhatsApp agents, auth, Tauri packaging.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `ops-dashboard-shell`: chrome/navigation requirement rewritten — the authenticated app IS the founder app; no ops navigation or routes; non-admin access screen.
- `founder-feed`: subject-link scenario updated (links open the copilot, not retired ops detail views).
- `dashboard-design-system`: "Inicio screen" and "ops component library" requirements removed; tokens, Storybook coverage, login fidelity, pointer affordance, back-nav remain.
- `promo-send-shortcut`: the two dashboard-UI requirements (Inicio button/modal, toast) removed; the apiserver standalone-promo capability and flow-completion behavior remain.

### Removed Capabilities

- `solicitud-review-ui`, `solicitudes-list`, `clientes-list`, `cliente-detail`, `contabilidad-ledger`, `contabilidad-transaction-detail`, `modelo-report` — desktop UI capabilities; the underlying APIs/data stay, reachable via copilot and mobile.

## Impact

- `mods/dashboard`: large deletion (pages/, Layout, NavSidebar, unused ui/ components + stories); App.tsx route rewrite; new access screen. Bundle and Storybook shrink.
- `pencil.pen`: deprecation marker on `YqrDN`.
- No apiserver, common, mobile, or agents changes.
