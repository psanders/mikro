## Context

`FeedScreen.tsx` currently renders a fixed row of type-only filter pills (`Todo/Pagos/Contratos/Decisiones/Alertas/Tareas/Mensajes`) that map to `listFeedEvents({ types })`. The backend (`createListFeedEvents.ts`) already accepts `from`/`to` date bounds — they're just never surfaced in the UI. There is no actor filter and no grouping of repeated similar events. Issue #131 asks for all three as the business grows and the feed gets noisier.

The founder app has a hard fidelity constraint (CLAUDE.md, project memory): it must match its Pencil board (`EzobQ`) exactly, screen-by-screen, component-by-component — no ad hoc UI that isn't first drafted in Pencil.

## Goals / Non-Goals

**Goals:**

- Collapse the always-visible pill row into a single filter icon + popup, freeing header space, while keeping (and extending) the same filtering power.
- Add actor filtering, both UI and backend query support.
- Surface the date-range filtering the backend already supports.
- Reduce visual noise from repeated similar events via consecutive-run grouping, without losing any individual event (still reachable via expand).

**Non-Goals:**

- No new critical/routine visual weighting or "focus" toggle — deferred to a follow-up issue.
- No change to `founder-search`'s NL search behavior.
- No grouping across day boundaries — a run never spans two day groups, since day headers already segment the list.

**Persistence (user, 2026-07-08):** filter selections MUST be remembered across sessions, not reset per the old pill behavior. Default state, when nothing has been saved yet, is Tipo: Todo (unfiltered), Actor: Todos (unfiltered), Rango de fechas: Hoy (today only) — a deliberately narrower default than today's unbounded feed, matching the issue's noise-reduction goal.

## Decisions

**Filter UI: icon + popup, triggered from a persistent filter bar — not the header.** First draft put the filter icon in the header next to the sparkles/copilot icon (matching the user's initial instruction). On reviewing the Pencil draft, we moved it: the header's copilot icon is a cross-app, persistent feature; filtering is local to the feed list. Grouping them implied a false peer relationship. The filter icon now lives right-aligned on the same row as the active-filter chips — proximity to its own output — and that row is always rendered (icon-only when empty) so toggling filters never shifts the feed content below. The popup keeps the existing type taxonomy as checkboxes (multi-select, unlike today's single-select pill) rather than inventing a new grouping — same six categories, same `types` arrays, just multi-selectable.

**Filter bar is persistent, not conditional.** Rejected an initial variant where the chip row only rendered when filters were active, because that causes a layout jump each time a filter is applied/cleared. A permanent slim bar (icon only when empty) avoids this — the same trade-off Linear/Superhuman-style filter bars make.

**Actor filter: single-select, not multi.** The feed's actor population per admin is small (collectors + a few staff); a dropdown of names matches the "Actor: Todos ▾" mockup the user approved. `actorId` on the schema is a single optional string, not an array — simplest predicate, matches approved mockup, extend to array later only if requested.

**Actor source: existing `createListUsers`.** No new endpoint. `listUsers` already returns the set of platform users; the feed's `actorId`/`actorName` are populated from the same user records at event-record time, so the dropdown's option set and the query predicate line up.

**Persistence: `localStorage`, not a backend preference table.** The filter state (`types`, `actorId`, `from`/`to`) is small, client-only, per-browser state — a new backend user-preferences table/endpoint would be disproportionate for one screen's filter memory. Stored under a single key (`founder-feed-filters`), read on mount to seed the query, written on every successful apply/clear. If parsing fails or nothing is stored, falls back to the default (Todo / Todos / Hoy). This does mean the preference is per-browser, not per-admin-account across devices — acceptable since the founder app today has effectively one admin user.

**Grouping: pure client-side transform, keyed on `(type, actorId)` adjacency.** Backend stays untouched for this part — grouping only needs to look at events already fetched and rendered in the same order the feed already produces (newest-first, paginated). Implemented as a second pass over `groupByDay`'s output: within each day group, fold consecutive events whose `type` and `actorId` match into a `GroupedRun` wrapper; render `FeedCard`/`TaskFeedCard` as today for runs of length 1, and a new collapsible summary row for runs of length ≥ 2. A run never crosses a day boundary (day headers are a natural break); it MAY span a "load more" page fetch, since the flattened list is one continuous newest-first stream and pagination is just how it's fetched, not a meaningful UI break.

**Grouping threshold: 2, not something higher.** Matches the approved mockup (5 payments collapse); the general rule is "any 2+ consecutive same-type-same-actor events group" — simplest rule, no magic number to tune.

**Alerts/tasks-with-widgets are never grouped.** `task.due`/`task.needs_input` cards with a live action widget keep their own row even if adjacent — collapsing an actionable card into a summary would hide the confirm/skip affordance. The grouping pass explicitly skips events where `isTaskEvent(event)` is true, same predicate `FeedScreen.tsx` already uses to pick `TaskFeedCard`.

## Risks / Trade-offs

- **[Risk] Popup replaces an always-visible affordance with a hidden one** → the filter icon must be clearly discoverable (labelled tooltip, matches sparkles icon's existing pattern which is already icon-only) and the chip row keeps active state visible without reopening.
- **[Risk] Grouping could feel like data loss** → expand always available, and the summary row explicitly states the count and actor so nothing is silently hidden.
- **[Risk] `actorId` single-select doesn't cover "compare two collectors"** → acceptable per approved mockup; multi-actor is a future extension, not required by issue #131.
- **[Trade-off] Grouping computed on every render pass** → cheap (single linear scan over an already-small page of ≤100 events), no memo pitfalls beyond the existing `useMemo` around `groupByDay`.

## Migration Plan

No data migration. `actorId` is a new optional field on an existing input schema (backward compatible — omitted defaults to unfiltered, same as today). Ship behind no flag; this is a UI-visible change to the founder feed only, reviewed via Pencil before build.
