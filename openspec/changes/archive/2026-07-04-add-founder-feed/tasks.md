# Tasks: add-founder-feed

## 1. Event log foundation (apiserver + common)

- [x] 1.1 Add `BusinessEvent` Prisma model (uuid id, type, occurredAt, actorId/actorName, customerId/customerName, loanId, applicationId, amount?, summary, payload String; indexes on (occurredAt, id), type, customerId) and commit migration via `prisma migrate dev --name add_business_event_log`
- [x] 1.2 Add `mods/common/src/schemas/businessEvent.ts`: event type union, per-type payload zod schemas, feed/search/export input schemas (cursor for feed; offset/limit for search); export from `@mikro/common`
- [x] 1.3 Implement `recordEvent` helper in `mods/apiserver/src/api/events/` — takes a tx/client, validates payload against the per-type schema, writes the row (no update/delete surface anywhere)

## 2. Event producers (tRPC boundary — middleware + meta + mappers)

- [x] 2.1 Event middleware: reads `.meta({ event })`, runs registered mapper on `(input, result, ctx)` after resolver success, writes via `recordEvent`; write failure logged loudly, never fails the request. Mutation factory functions stay unmodified (revert any in-function producer edits)
- [x] 2.2 Central mapper registry `src/api/events/mappers.ts` — one pure mapper per catalog type (Spanish summaries, payload shaping, policyException flag on approvals); test asserts every catalog type has a mapper
- [x] 2.3 Annotate procedures: payment create/reverse, application approve/reject/sign/convert/delete, loan status update, customer create
- [x] 2.4 `application.deleted` snapshot: `createDeleteApplication` returns the deleted row (only permitted mutation-function change); mapper serializes it JSON-safe

## 3. Feed, restore, search, export procedures

- [x] 3.1 `listFeedEvents` admin query: reverse-chronological, opaque (occurredAt,id) cursor, type/date filters (documented convention exception vs offset/limit)
- [x] 3.2 `restoreApplication` admin mutation: recreate from deletion-event snapshot, 30-day window, structured conflict errors, records `application.restored`
- [x] 3.3 `searchAll` admin query: grouped customers/loans/events results, per-group caps
- [x] 3.4 `exportAuditLog` admin query: month-scoped CSV of the event log (headers-only when empty)

## 4. Dashboard components (Storybook-first)

- [x] 4.1 `FeedCard` compact + expanded variants with stories covering the v1 catalog types, incl. amber exception and red deletion (with/without Restaurar) treatments per Pencil board section `zmif2`
- [x] 4.2 Day-group header, feed empty/error states, and search result-row components with stories

## 5. Founder app (separate entry, Pencil-faithful — REOPENED 2026-07-04 after user rejected the ops-shell integration)

- [x] 5.1 Revert all bolt-ons to the ops shell (App.tsx routes under Layout, NavSidebar items, landing changes); ops app back to pre-change behavior except admin post-login redirect to `/founder`
- [x] 5.2 `FounderShell` + routes `/founder`, `/founder/buscar`, `/founder/reportes` outside the ops Layout, admin-gated; visuals exactly per Pencil exports (slim dark icon rail, header with inert copilot sparkles button)
- [x] 5.3 Feed screen at `/founder` matching Pencil: day-grouped cursor feed, compact/expandable cards per catalog treatments, Restaurar wiring, subject links
- [x] 5.4 Búsqueda screen at `/founder/buscar` matching Pencil: single input, CLIENTES/PRÉSTAMOS/EN EL FEED groups, empty state
- [x] 5.5 Reportes screen at `/founder/reportes` matching Pencil: catalog list, month picker, CSV download
- [x] 5.6 Stories updated for the restyled feed components

## 7. Seed data

- [x] 7.1 Seed script exercising real tRPC mutations via createCaller (customers, payments, approval/rejection, deletion) so the feed shows realistic events end-to-end — `mods/apiserver/scripts/seed-feed-events.mjs`; 19 events across 6 types in dev DB

## 6. Tests and gates

- [x] 6.1 Tests per annotated procedure: successful call writes its event; failed mutation writes nothing; event-write failure is logged and does not fail the request; recordEvent payload schema-validation failure produces structured error and no row
- [x] 6.2 Unit tests for feed cursor (contiguous pages under concurrent inserts), restore (success / expired window / unique conflict), search grouping, CSV export (incl. empty month)
- [x] 6.3 Non-admin authorization rejection tests for feed/search/export/restore
- [x] 6.4 Repo gates green: lint, typecheck, tests across apiserver/common/dashboard; e2e noted skipped (no dashboard e2e harness). Pre-existing unrelated failures noted: dashboard `src/server-stub.ts` lint, apiserver "Chat Integration" test.
