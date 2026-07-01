## Context

`mods/mobile` (Expo Router, tRPC + react-query, `expo-secure-store`) is currently a single-purpose collector app: login (phone+password) → PIN unlock → tabs Hoy/Ruta/Buscar/Cuadre. It stores the JWT but never inspects it. The backend already models multi-role users (`Role { ADMIN, COLLECTOR, REVIEWER }`, `UserRole` junction table) and embeds `roles` in the JWT at login (`mods/apiserver/src/api/auth/createLogin.ts`). Reviewer actions are already gated server-side via `reviewerProcedure` and fully spec'd (`loan-application-review`, `loan-application-scoring`, `loan-application-conversion`, `loan-application-signing`). Desktop (`mods/dashboard/src/pages/SolicitudDetailPage.tsx`) is the only current consumer of that reviewer surface.

The target UX (locked in Pencil, flow board `gzBYk`) is a mobile-first port of that desktop flow, sharing the mobile app's design system (`m/*` components, extended under an "EVALUATOR APP" section — no separate library) and shared auth/profile screens (cluster `nCQnp`).

## Goals / Non-Goals

**Goals:**

- Decode JWT roles client-side and use them to pick which navigation/screens a logged-in user sees.
- Port the desktop reviewer flow to mobile screens per the locked Pencil design, wired to the existing tRPC mutations.
- Keep this one app/one binary — no separate evaluator app, no separate login.

**Non-Goals:**

- No backend changes. `reviewerProcedure` and the review/scoring/conversion/signing logic are reused unmodified.
- No offline support for evaluator screens in this pass (collector screens have some offline/sync affordances via `expo-sqlite`; evaluator data freshness matters more than offline access, so evaluator screens are online-only for v1).
- No redesign — Pencil screens/components are locked; this change reconciles that design into spec + code, it does not iterate the design further.

## Decisions

- **Role source = JWT claim, decoded client-side, no re-verification.** The token already carries `roles`; decoding it (base64 payload split, no signature check needed client-side) avoids an extra round trip on every launch. Server-side `reviewerProcedure` remains the actual authorization boundary — client-side role checks are UX routing only, not a security control. _Alternative considered_: a `whoami`/`me` tRPC call after login. Rejected as an unnecessary round trip when the claim is already in the token.
- **Roles are read once at login/unlock and cached alongside the token** in `mods/mobile/lib/auth.ts`, not re-decoded on every render.
- **Navigation split by route group**, mirroring the existing `(auth)` convention: collector screens stay where they are, evaluator screens live under a new `(evaluator)` group with their own tab layout (Inicio/Cola/Historial/Buscar per Pencil). The root layout picks which tab layout to mount based on decoded roles, after PIN unlock.
- **Dual-role users (has both COLLECTOR and REVIEWER, or ADMIN) default to the evaluator navigation, with a manual switcher.** Evaluation is the more time-sensitive workflow (48h SLA), so it's the default; a switcher (reachable from the profile screen, part of the shared cluster `nCQnp`) lets the user flip to the collector tab bar and back. _User decision, 2026-07-01._ This adds one small piece of UI not in the original locked Pencil screens (a toggle/menu entry on Perfil) — call out to the user during Pencil review at build time rather than re-litigating the whole flow.
- **Screens reuse the existing tRPC hooks pattern** (`mods/mobile/lib/trpc.ts`) and react-query, matching how collector screens already fetch data — no new data-fetching library.
- **Contract upload (Firmada) uses `expo-image-picker` (camera capture).** A reviewer approving a loan in the field has the physical signed contract on hand; photographing it is the natural flow, vs. assuming it was scanned elsewhere first. _User decision, 2026-07-01._

## Risks / Trade-offs

- [Client-side role gating could be bypassed by a modified client] → Not a real risk: every mutation still goes through server-side `reviewerProcedure`; worst case a COLLECTOR-only user sees an evaluator screen that then fails their mutations server-side.
- [12-screen surface is large for one change] → `tasks.md` sequences the build (nav/role gating → queue/search/history → detail+score → edit/re-score → approve/reject → contract/convert), so partial progress is still shippable/testable per slice.
- [Dual-role default (evaluator-first) may not match what reviewers who also collect actually want] → Open question below; cheap to flip later since it's a single routing decision.

## Migration Plan

Purely additive — no data migration. Ship as a normal mobile release; since evaluator screens are gated by role, COLLECTOR-only users see no change. No feature flag needed given the role gate already limits exposure, but nothing here blocks adding one if a staged rollout is wanted.

## Open Questions

Resolved 2026-07-01 (see Decisions above): dual-role users get evaluator-first navigation with a manual switcher on Perfil; signed-contract upload uses camera capture via `expo-image-picker`.
