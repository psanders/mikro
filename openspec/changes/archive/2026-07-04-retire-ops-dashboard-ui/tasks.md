# Tasks: retire-ops-dashboard-ui

## 1. Pencil deprecation

- [x] 1.1 Mark ops v2 cluster `YqrDN` DEPRECATED (title marker + note pointing to founder board `EzobQ`)

## 2. Dashboard cleanup

- [x] 2.1 Rewrite App.tsx routing: login → ADMIN lands `/founder` (catch-all redirects there); non-admin → `AccessScreen` on all routes; ops routes removed
- [x] 2.2 New `AccessScreen` (Spanish, founder-styled, points to the Mikro mobile app)
- [x] 2.3 Delete ops pages, Layout/NavSidebar, unused `components/ui/*` + stories per design keep-list (trace imports first)
- [x] 2.4 Feed subject links + search result navigation → copilot `openWith(...)` prefills (no retired-route targets anywhere)

## 2b. Design tweaks (user, 2026-07-04, folded into this change)

- [x] 2b.1 Remove online indicators in Pencil + code: feed "EN VIVO" chips (3 screens), dock "en línea" status (2 docks), sparkles-button presence dot
- [x] 2b.2 Feed header title "Hoy" → "Feed" in Pencil (c1C4ya/PWRu9/l5Jp1) + FeedScreen.tsx; day-group Hoy/Ayer labels unchanged; founder-copilot + founder-feed spec deltas updated

## 3. Gates

- [x] 3.1 typecheck, eslint (src), vite build, storybook build all green; grep proves no references to deleted modules or routes remain
