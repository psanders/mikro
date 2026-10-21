Read AGENTS.md before changing dependencies, CI workflows, or anything
build/release related. It records the practices that keep the workflows
green and the checks that enforce them.

## Branch hygiene

Once a branch's PR is confirmed merged into `main`, delete it without asking:

- Verify first: `git merge-base --is-ancestor <branch> origin/main`.
- Delete the local branch (`git branch -d`) — switch off it first if it's checked out.
- Check the remote: `git ls-remote --heads origin <branch>`. This repo has
  "delete branch on merge" enabled, so it's usually already gone; if not,
  delete it (`git push origin --delete <branch>`).

Do this proactively at the end of any task that ends in a merged PR, and
whenever you notice a stale merged branch lying around — don't wait to be
asked twice.

## Design files (`designs/`)

Pencil design files, one per area, all importing the shared library as `ui`
(refs are `ui:<id>`, variables `$ui:<name>`, `descendants` keys `ui:<id>`):

- `mikro.lib.pen` — variables + light/dark themes, Brand Book, App Icons, and
  the three component libraries (Mobile, Website, Ops).
- `ops.pen` — Ops Dashboard (`EzobQ`, incl. renewal, feed, dark mode) and the
  Mikro Decisión extension.
- `app.pen` — Collectors flow, shared screens, Evidencias.
- `website.pen` — site, FAQ, OpenGraph, offer table.
- `solicitud.pen` — the loan application form.
- `ads.pen` — legacy ad creatives. `ads-system/ads.pen` — Round-2 ad
  system (self-contained, own variables, `images/` next to it).
- `deck.pen` — pre-seed pitch deck. `exports.pen` — export frames.

Reusable components and variables live only in the lib; area files keep only
frames (single-area reusables may stay local). The `mods/mobile/assets` avatars
are referenced as `../mods/mobile/assets/…`. The root `pencil.pen` is gone —
don't recreate it.

Conventions (Pencil is the source of truth for the Ops dashboard and apps):

- One board per area, numbered sections (`01 · …`) with a one-line purpose.
  `ops.pen` runs `00 Fundamentos` (live component index) → `14 Arquitectura`;
  `app.pen` is one board, `Collectors · User Flow` (mobile only; there is no
  evaluator app — evaluation lives in Ops).
- Guidance for development, not documentation of every case: one canonical
  frame per screen/panel; show types/icons/CTAs in a table (see ops `03 Tarjeta
del feed`), not one frame per state.
- Every Ops UI part is an `ops/*` component in the lib's Ops library
  (`ops/rail`, `ops/feed-card`, `ops/side-panel`, …); ops.pen only instances
  them. Add a missing part to the lib first.
- Dark frames use the theme axis `ui:mode` (not `mode`) once tokens come from
  the lib. A new/changed lib component is only visible in importing files after
  Pen is restarted.
- Saving: focus the file's window (`open -a Pen <file>`), then File ▸ Save
  (scripted ⌘S is unreliable); confirm the file's mtime changed.
