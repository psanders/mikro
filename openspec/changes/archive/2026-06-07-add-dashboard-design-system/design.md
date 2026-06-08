## Context

`mods/dashboard` exists (foundation change) as a Vite + React + Tailwind v4 SPA with a working login and a placeholder overview, plus a thin `Layout`/nav and a tRPC + auth seam. The finished UI lives in `pencil.pen` (accessed via the `pencil` MCP tools): a token set (`get_variables`), a `cp/*` component library (frame `d1E5om`), and 11 screens (frame `ZB26x`). This change adopts that design for the two screens that already exist and stands up the component library + Storybook the remaining screens will reuse.

Key facts from the design:

- Tokens: `ds.bg #F4F7FB`, `ds.surface #FFFFFF`, `ds.border #E5EAF1`, `ds.muted #697A93`, `ds.subtle #EEF3F9`, status `green/amber/red` + tints; `brand.blue.deep #103A8A / primary #1F4AA8 / sky #3F86E0`, `brand.ink #14254A`, `brand.mist #E9F2FF`; radii card 20, ds 10, pill 9999.
- Login `RRbG1`: split — 560px gradient brand panel + white centered form.
- Dashboard `IDIY8`: `cp/nav-sidebar` + main (page header + 4 `cp/stat-card` + a "Solicitudes recientes" table).

## Goals / Non-Goals

**Goals:**

- One token source (Tailwind v4 `@theme`) mirroring Pencil; components/screens consume tokens, not hex.
- A React component library faithful to the `cp/*` set, each with a Storybook story.
- Login and "Inicio" re-implemented from the library, faithful to Pencil, with existing auth/data wiring intact.

**Non-Goals:**

- The other 9 screens and their bespoke components (follow-on changes that reuse this library).
- Any backend/API change.
- Pixel-cloning the Pencil canvas chrome (device frame, shadows around the artboard) — we reproduce the screen content, not the presentation frame.

## Decisions

**Tokens as Tailwind v4 `@theme` (extend the existing `index.css`).**
The foundation already uses `@import "tailwindcss"` + `@theme`. We expand that block with the full `ds.*` / `brand.*` / `radius.*` set so tokens are usable as Tailwind utilities (`bg-ds-bg`, `text-ds-muted`, `rounded-card`) and as CSS variables. Single source, no parallel SCSS.
_Alternatives:_ a separate JS token module (rejected — splits the source of truth from Tailwind); raw CSS variables only (rejected — loses Tailwind utility ergonomics).

**Component library under `src/components/ui/`, plain presentational components.**
Faithful, prop-driven, side-effect-free components (button, field, badge, cards, nav-sidebar, page-header, etc.). Screens compose them; data/auth logic stays in screens/context. This keeps stories trivial (no providers needed for most) and mirrors the mobile app's `components/ui` convention.
_Alternatives:_ a headless lib (Radix/shadcn) (rejected — the Pencil set is small and specific; matching it directly is simpler than restyling a generic kit).

**Storybook via `@storybook/react-vite`.**
Reuses the app's Vite config and Tailwind plugin so stories render with real tokens. Mobile uses Storybook RN; this is the web-native equivalent. Add `storybook`/`build-storybook` scripts.
_Alternatives:_ Ladle/Histoire (rejected — Storybook is the team's known tool and the React-Vite builder is first-class).

**Faithfulness method.**
For each component/screen, read the Pencil node (`batch_get`) for structure + exact values and screenshot (`get_screenshot`) for visual check, then translate to tokens. Verify against the screenshot after building each piece (per the reference-fidelity practice). Spanish copy is taken verbatim from the design.

**Reuse, don't rewrite, the auth/data wiring.**
Login keeps the `trpc.login.useMutation` → `completeLogin` flow and the field names/validation; only the presentation changes. The Inicio screen keeps `whoami` and adds `listLoans` for the recent-requests table, with loading/error states; stat figures without a procedure render as clearly-marked placeholders.

## Risks / Trade-offs

- **Design drift / infidelity** → Build component-by-component and diff against the Pencil screenshot before moving on; pull exact token values via `get_variables`/`batch_get` rather than eyeballing.
- **Storybook + Vite 8 / Tailwind v4 version friction** → Pin Storybook to a version compatible with the installed Vite 8; if the builder lags, that's a contained dev-only concern (the app build is independent). Surface and stop if incompatible rather than downgrading the app's Vite.
- **Token namespacing in Tailwind v4** → Pencil names use dots (`ds.bg`); Tailwind utilities need valid identifiers (`--color-ds-bg` → `bg-ds-bg`). Adopt a consistent kebab mapping and document it.
- **Placeholder vs real data ambiguity on Inicio** → Mark any non-wired stat as a placeholder in the UI so it isn't mistaken for live data.
- **Scope creep into other screens** → Hard-scope to Login + Inicio; new components are added only as those two need them (the rest of the `cp/*` set can still be storied, but screens beyond Inicio are out).

## Migration Plan

Additive and within `mods/dashboard`; no other package changes.

1. Expand tokens in `index.css`; verify the app still builds.
2. Add Storybook + scripts; confirm it boots.
3. Build the component library bottom-up (atoms → cards → nav/header), each with a story, each diffed against Pencil.
4. Re-skin Login from the library; confirm auth still works end-to-end.
5. Re-skin the overview into "Inicio"; wire `whoami` + `listLoans`, mark placeholders.
6. Run typecheck + lint + build clean.

Rollback: revert the workspace changes; the foundation screens return. No data or API impact.

## Open Questions

- Stat-card data sources: `listLoans` can back "Solicitudes recientes"; do "Cartera total / Cobrado hoy / Tasa de mora" map to existing report procedures (e.g. `generatePortfolioMetrics`) or remain placeholders for now? Default: placeholders unless a clean read exists.
- Fonts: Pencil type — does the dashboard adopt a specific family (e.g. Inter) to match, and is it already available/bundled? Default: Inter via the existing stack.
- Does "Nueva solicitud" CTA need to route anywhere yet, or is it inert until the Solicitudes screen exists? Default: present but inert (no target screen in scope).
