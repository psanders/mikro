## 1. Pencil design

- [x] 1.1 Draft filter icon on the Feed en vivo header frame (board `EzobQ`) — later relocated to the persistent filter bar, right-aligned, after live design review
- [x] 1.2 Draft the filter popup (Tipo checkboxes, Actor dropdown, Rango de fechas with presets, Limpiar/Aplicar)
- [x] 1.3 Draft the active-filter chip row below the header, made persistent (icon-only when empty) to avoid layout shift
- [x] 1.4 Draft the collapsed grouped-summary row (catalog `zmif2`)
- [x] 1.5 Confirm the design with the user — reviewed live, filter-icon placement revised per user's UX call; user then stepped away and asked for autonomous completion through PR

## 2. Backend: actor filter

- [x] 2.1 Add optional `actorId` to `listFeedEventsSchema` (mods/common/src/schemas/businessEvent.ts)
- [x] 2.2 Wire `actorId` into `createListFeedEvents`'s `and[]` predicate (mods/apiserver/src/api/events/createListFeedEvents.ts)
- [x] 2.3 Integration test: `actorId` narrows results; combined with `types`/`from`/`to` narrows further (`test/integration/events.test.ts`)
- [x] 2.4 Integration test: malformed `actorId` rejected with a structured error (TRPCError BAD_REQUEST), no query executed

## 3. Frontend: filter bar + popup component

- [x] 3.1 Build `FilterPopup` component in isolation (Storybook: default, applied filters, custom range) under mods/dashboard/src/founder/components/
- [x] 3.2 Wire Tipo checkboxes to `FEED_TYPE_GROUPS` (multi-select)
- [x] 3.3 Wire Actor dropdown to `listUsers`
- [x] 3.4 Wire Rango de fechas (presets + custom) to `from`/`to` via `resolveDateRange`
- [x] 3.5 Replace the FeedScreen pill row with `FilterBar` (persistent chip row + right-aligned filter icon + popup)
- [x] 3.6 Wire chip removal to clear only that filter dimension and re-query
- [x] 3.7 Persist filter state to `localStorage` (key `founder-feed-filters`) on apply/clear; read on mount, falling back to default (Todo / Todos / Hoy) when unset or unparsable

## 4. Frontend: grouped-run rendering

- [x] 4.1 `groupFeedRuns` — a pure second pass over each day group's events that folds consecutive same-type/same-actor events (excluding task-widget events) into runs
- [x] 4.2 Build a `GroupedFeedRow` summary component (Storybook: 5-event run, minimum 2-event run)
- [x] 4.3 Wire per-row expand/collapse state, rendering underlying `FeedCard` on expand (task-widget events are excluded from grouping so `TaskFeedCard` never needs to render inside a group)

## 5. Tests

- [x] 5.1 Backend integration tests cover the correctness-critical surface (actorId query predicate + validation) — see 2.3/2.4
- [x] 5.2 Storybook stories are this repo's test layer for `dashboard` components (no unit-test runner or e2e harness exists for `mods/dashboard` — confirmed no `test`/`test:e2e` script, no Playwright/Vitest dependency, no `.test.ts(x)` files anywhere in the package; the only e2e in the repo is Maestro, scoped to `mods/mobile`). `FilterPopup`, `FilterBar`, and `GroupedFeedRow` each ship with stories covering their key states in lieu of unit tests — setting up a new test framework for this one change was judged out of proportion and riskier than not doing it overnight.
- [x] 5.4 Ran lint + typecheck for `mods/common`, `mods/apiserver`, `mods/dashboard` (all clean) and the full `mods/apiserver` test suite (616 passing) — see PR description for the exact commands

## 6. Sync & archive

- [x] 6.1 Sync founder-feed delta spec into openspec/specs/founder-feed
- [x] 6.2 Archive the change
- [ ] 6.3 Open PR with description covering both the Pencil design and the shipped code
