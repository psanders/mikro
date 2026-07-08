## Why

As loan volume grows, the founder feed accumulates many similar routine events (daily payments, recurring reminders) that bury the exceptions the founder actually needs to catch (mora escalations, deleted requests, status changes). The only filtering today is a fixed row of type pills; there is no way to narrow by actor or by a flexible date range, and repeated similar events (e.g. five payments from the same collector in a row) each take a full row even though they carry the same signal. Reported by the founder's copilot during a conversation (issue #131).

## What Changes

- Replace the feed header's inline `FILTERS` pill row with a persistent filter bar below the header: active-filter chips flow from the left, a filter icon button sits right-aligned, and clicking it opens a popup panel. The filter icon deliberately does NOT live next to the header's sparkles/copilot icon — that groups an unrelated cross-app feature with a feed-local control; keeping the filter trigger next to its own chip output keeps the relationship obvious and avoids a layout shift when filters are cleared.
- Filter popup offers: **Tipo** (multi-select, reusing the existing type groupings — Pagos, Contratos, Decisiones, Alertas, Tareas, Mensajes), **Actor** (single-select, sourced from existing user data), and **Rango de fechas** (from/to with Hoy/7d/30d presets plus a custom range).
- Active filters render as dismissible chips in the persistent filter bar; removing a chip clears just that filter. The bar itself never disappears (icon-only when no filters are active), so the feed content below never shifts.
- Backend: `listFeedEventsSchema` gains an `actorId` filter param, wired into `createListFeedEvents`'s query alongside the existing `types`/`from`/`to` filters.
- Feed list gains client-side grouping: consecutive events sharing the same `type` and `actorId` collapse into one expandable summary row (e.g. "5 pagos recibidos · Ana R. · hace 2h"); expanding shows the individual events in original order. Pure display transform over already-fetched pages — no new query.

Out of scope: no new critical-vs-routine visual priority treatment (existing red/amber card treatments are untouched); no changes to search (`founder-search`) — filtering stays scoped to the feed itself, per the locked "search is universal/NL, feed filters live on the feed" decision.

## Capabilities

### New Capabilities

(none — this extends the existing feed capability)

### Modified Capabilities

- `founder-feed`: feed header replaces the type-pill filter with a filter icon + popup covering type/actor/date-range, adds an `actorId` query parameter, and adds consecutive same-type/same-actor event grouping with expand/collapse.

## Impact

- `mods/dashboard/src/founder/FeedScreen.tsx` — header UI, filter state, grouping transform
- New `FilterPopup` component (+ Storybook story) under `mods/dashboard/src/founder/components/`
- `mods/common/src/schemas/businessEvent.ts` — `listFeedEventsSchema` gains `actorId`
- `mods/apiserver/src/api/events/createListFeedEvents.ts` — query predicate gains `actorId`
- Pencil board `EzobQ` (Feed en vivo) — header/popup/grouped-row frames
