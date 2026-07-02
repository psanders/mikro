# Design: retire-ops-dashboard-ui

## Context

Founder direction confirmed; both founder changes shipped (feat/founder-feed, PR #74). The ops dashboard UI is superseded: review moved to the mobile evaluator app, everything else to feed/search/reports/copilot. Only `mods/dashboard` UI code and Pencil markers change.

## Goals / Non-Goals

**Goals:** delete the ops UI surface; founder path is the app; non-admins get a clear pointer to mobile; Pencil ops cluster marked deprecated.

**Non-Goals:** ANY apiserver/common/mobile/agents change; removing auth, the Tauri shell, or the tRPC client; deleting Pencil history (marked, not removed).

## Decisions

1. **Keep-list, not delete-list.** `mods/dashboard/src` keeps: `main.tsx`, `App.tsx` (rewritten), `index.css`, `server-stub.ts`, `lib/`, `context/AuthContext`, `components/ui/ToastProvider` (+ anything it and `LoginPage`/`AppUpdater` transitively need), `pages/LoginPage.tsx`, `founder/**`. Everything else in `pages/`, `components/`, and their stories is deleted. Trace imports before deleting — the build must prove the keep-list correct.
2. **Routing**: `/login` unauthenticated; authenticated: ADMIN → `/founder` tree (unknown paths redirect there); non-ADMIN → `AccessScreen` (Spanish, founder-branded, points to the Mikro mobile app) on every route. Ops routes cease to exist (no redirect stubs beyond the catch-all).
3. **Subject links → copilot.** Feed "Ver solicitud/préstamo/cliente" actions now call `openWith("Muéstrame los detalles de …")` instead of navigating to retired detail pages. Search result rows do the same for entities without a founder view (clients/loans); event rows keep expanding in place.
4. **Pencil**: rename the v2 cluster title `YqrDN` to carry a DEPRECATED marker (same convention as `ZB26x`); add a note pointing to board `EzobQ` as the active design. Component library `d1E5om` stays (tokens still authoritative).
5. **Reviewer impact is accepted and explicit** (user decision): desktop review retires; migration = mobile evaluator app + copilot. ops-dashboard-auth unchanged — collectors/reviewers can still authenticate (they just land on the access screen), preserving token behavior for any future non-founder surface.

## Risks / Trade-offs

- [Hidden import from founder/login into deleted code] → typecheck + vite build + storybook build gate the deletion; agent traces imports first.
- [Contabilidad has no founder UI yet] → accepted; data intact via API/copilot; candidate for a future founder report or screen.

## Migration Plan

Pure frontend deletion + Pencil marker; no data or API migration. Rollback = git revert.

## Open Questions

None.
