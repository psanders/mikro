# Proposal: add-founder-feed

## Why

Founders currently have no single place to see the business as it happens — payments, approvals, signed contracts, and deletions are scattered across the ops dashboard's section screens, and nothing records deletions or edits at all. The Founder Dashboard direction (explored and locked in Pencil, board `EzobQ` "Feed en vivo") turns the desktop app's home into a chronological feed backed by a permanent, append-only business event log. That event log is also the foundation the upcoming copilot (`mikro-mcp`) needs for provenance, rules, and auditing — so it ships first.

## What Changes

- **New append-only event log in the apiserver** — the single source of truth for everything shown in the feed. Every business event (payment collected, application approved/rejected, contract signed, loan disbursed, client created, record deleted/restored, reminder sent, mora escalation, daily close digest) is written once and never deleted. Existing mutation paths are instrumented to publish events.
- **New feed home screen in the dashboard** — reverse-chronological cards, compact by default, manually expandable via chevron (no global switch). Cards carry type-specific detail and direct actions (e.g. "Restaurar" on deletion cards, "Ver solicitud" on exceptions). Slim icon rail: feed, exceptions, search, reports, profile.
- **New universal search screen** — one input that returns grouped results (clients, loans, feed events) with direct actions on each hit (register payment, WhatsApp, open profile).
- **New light reports screen** — a list of downloadable reports; no BI builder. First concrete report: "Registro de auditoría" (full month export of the event log). The screen's catalog is extensible for future recurring reports and copilot-generated files.
- **Dashboard shell rework for the founder view** — the feed becomes the home; existing ops screens stay reachable (collector/reviewer workflows are untouched until the copilot change absorbs them).
- Local SQLite speed cache for the feed (Tauri) is **explicitly deferred** to a follow-up change — the cache is never authoritative, so the feed is correct (just network-bound) without it.
- The copilot dock and `mikro-mcp` are **out of scope** — follow-up change consuming this event log.

## Capabilities

### New Capabilities

- `business-event-log`: apiserver capability — append-only recording of business events from all mutation paths, immutable retention, cursor-paginated feed query with type/date/actor filters, and restore handling for deletion events.
- `founder-feed`: dashboard feed home — chronological event cards, compact/expand interaction, per-type card content and actions, live updates on refresh.
- `founder-search`: universal search across clients, loans, and feed events with grouped results and inline actions.
- `founder-reports`: reports list screen with per-report period selection and file downloads; month event-log export as the first report.

### Modified Capabilities

- `ops-dashboard-shell`: navigation changes — icon rail with feed as the home route and entries for search and reports; existing ops sections remain accessible.

## Impact

- **apiserver** (`mods/apiserver`): new Prisma model + migration for events; new tRPC router (feed/search/report endpoints); event-publishing calls added inside existing mutation services (payments, applications, contracts, clients, deletions).
- **dashboard** (`mods/dashboard`): new pages (feed, search, reports), new card components (Storybook-first), shell/rail changes, routing.
- **No breaking API changes**; existing endpoints untouched apart from added event publication (side effect only).
- **Follow-up changes unlocked**: `mikro-mcp` copilot (consumes event log), Tauri SQLite feed cache, additional recurring reports, rule alerts / anomaly / daily-close event producers.
