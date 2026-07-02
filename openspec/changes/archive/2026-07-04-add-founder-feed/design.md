# Design: add-founder-feed

## Context

The Founder Dashboard direction is fully explored in Pencil (board `EzobQ` "Feed en vivo"): a chronological feed of business events as the desktop home, universal search, a light reports list, and (later) a copilot. Architecture is locked: **the apiserver event log is the single source of truth and stores everything in the feed forever**; any local cache is disposable; reports are exports of the log.

Current state of the code this lands on:

- `mods/apiserver`: Prisma on SQLite, uuid string PKs, **no soft deletes** (hard deletes with cascades), **no audit/event model**, **no event bus**. Mutations live in `src/api/<domain>/create<Verb><Noun>.ts` factory functions taking `DbClient`, called from a flat `trpc/routers/protected.ts`. One precedent for post-mutation side effects: `onPaymentCreated` callback in `createCreatePayment.ts` (fires after `$transaction`, wired to QCobro resync).
- `mods/dashboard`: React Router pages in `src/pages/*.tsx` behind `RequireAuth` + `Layout`, tRPC + react-query, Tailwind v4, Storybook stories colocated in `src/components/ui/*.stories.tsx`. Tauri shell has **no SQLite plugin** today.
- Roles: `ADMIN`, `COLLECTOR`, `REVIEWER` only. Zod schemas centralized in `@mikro/common` (`mods/common/src/schemas`).

## Goals / Non-Goals

**Goals:**

- Permanent, append-only `BusinessEvent` record written **in the same transaction** as each business mutation.
- Feed, search, and reports screens per the Pencil board, gated to founders.
- Deletion events capture a full snapshot so deleted records can be restored from the log.

**Non-Goals:**

- Copilot dock and `mikro-mcp` (follow-up change; this log is its substrate).
- Tauri SQLite speed cache (follow-up; react-query caching is the v1 "fast enough". The cache is never authoritative, so deferring it loses speed, not correctness).
- Synthetic event producers that need schedulers or detectors: daily-close digest, mora escalation, rule alerts, anomaly detection. The event schema accommodates them; nothing produces them yet.
- PDF report rendering (first report ships as CSV/Excel-compatible export).
- Backfilling history from before the feature ships (feed starts at deploy time; pre-existing data is reachable via search, not the feed).

## Decisions

1. **Events are captured at the tRPC boundary, not inside mutation functions.** (Revised 2026-07-02 with the user: the original in-transaction design put ~15 lines of feed logic inside each of 8 clean mutation files.) Procedures that produce events declare it with `.meta({ event: "<type>" })`; a single middleware runs after the resolver succeeds, looks up a mapper in a central registry (`src/api/events/mappers.ts`), builds the event from `(input, result, ctx)` — actor from `ctx`, Spanish summary and payload shaped by the mapper — and writes it via `recordEvent`. Mutation functions stay untouched (one exception: `createDeleteApplication` returns the deleted row so the mapper can snapshot it). All write paths go through tRPC (dashboard and mobile), so the boundary sees every mutation.
   - Trade-off accepted: the event is written immediately after the mutation commits, not inside its transaction — the loss window is a process crash between commit and event write (same process, same SQLite file, milliseconds). An event-write failure after a committed mutation is logged loudly, never surfaced as a mutation error. If a specific event ever needs ledger-grade atomicity, that one producer can move in-transaction without changing the architecture.
   - Alternatives rejected: in-transaction calls in every mutation (the pollution being avoided); Prisma client extensions (see CRUD, not business intent; no actor in scope); wrapping resolvers in an outer transaction from middleware (Prisma tx clients cannot nest `$transaction`; existing mutations use it internally); a message broker — see NATS note below.
   - **NATS/bus deferred, seam kept**: `recordEvent` is the single choke point (an `EventSink` in spirit). A broker earns its place only when push-based consumers exist (e.g. `mikro-mcp` subscriptions); today it would add droplet infra, JetStream durability config, and a DB projection we'd still need for feed queries.
2. **One wide table, typed payloads.** Single `BusinessEvent` model: `id` (uuid), `type` (dotted string, e.g. `payment.collected`), `occurredAt`, `actorId` + denormalized `actorName`, nullable denormalized refs (`customerId`, `customerName`, `loanId`, `applicationId`), `amount` (nullable, same numeric convention as `Payment.amount`), `summary` (human one-liner, Spanish — what the compact card shows), `payload` (JSON **stored as String** — Prisma has no `Json` type on SQLite). Denormalized names make cards render without joins and keep meaning even if the referenced row is later deleted. Indexes: `(occurredAt, id)`, `type`, `customerId`. Alternative (table-per-event-type) rejected: the feed is one chronological stream; one table keeps the query trivial.
3. **Append-only by construction.** The API surface exposes no update or delete for events. Reversals/corrections are new events (matching the existing `Payment.REVERSED` / `AccountingTransaction.reversalOf` pattern).
4. **Cursor pagination for the feed**, not the repo's offset/limit convention. Offset pagination over a stream that grows at the head duplicates/skips rows between pages. Cursor = `(occurredAt, id)` tuple encoded as an opaque string. Documented as a deliberate convention exception; search and reports keep offset/limit.
5. **v1 event catalog = annotating the tRPC procedures that exist today:** `payment.collected`, `payment.reversed`, `application.approved`, `application.rejected`, `application.signed`, `application.converted` (loan created), `application.deleted`, `application.restored`, `loan.status_changed`, `customer.created`. Each is an event meta annotation on the corresponding procedure in `protected.ts` plus a mapper in the central registry; the mutation factory functions are not modified.
6. **Restore from the log.** `application.deleted` events store a full JSON snapshot of the `LoanApplication` row in `payload`. A `restoreApplication` mutation re-creates the row from the snapshot (new event `application.restored`), allowed within 30 days of deletion. Conflicts (e.g. reused unique `sessionId`) fail with a structured error rather than clobbering. Only applications get restore in v1 — they are the only hard-deleted business entity today.
7. **Founder = ADMIN.** No new role. Feed/search/report procedures use `adminProcedure`. Introducing a `FOUNDER` role is trivial later if admins must be split.
8. **Dashboard shell: additive routes, feed is the admin home.** New pages `FeedPage`, `BusquedaPage`, `ReportesPage`; nav gains Feed/Búsqueda/Reportes entries (admin-only); admins land on `/feed` by default. Existing ops pages and non-admin landing are untouched — collector/reviewer workflows keep working until the copilot change absorbs them.
9. **Storybook-first cards.** `FeedCard` (compact + expanded variants per event type, amber tint for exceptions, red tint for deletions with Restaurar) built and reviewed in Storybook before page wiring, matching the 12-specimen catalog on the board (section `zmif2`).
10. **First report = Registro de auditoría**: month-scoped CSV export of the event log via a tRPC procedure returning the file content (dashboard triggers download). The reports screen lists a catalog so future recurring reports slot in without redesign.

## Risks / Trade-offs

- [Missed producer ⇒ silent feed gap] → v1 catalog is enumerated in the spec; a test asserts every catalog type has a registered mapper, and each annotated procedure has a test asserting a successful call writes its event.
- [Post-commit write ⇒ rare lost event on crash] → accepted for feed semantics (documented above); event-write failures are loudly logged, and any single event type can be promoted to in-transaction later if it needs ledger-grade guarantees.
- [Payload-as-String drifts per event type] → one zod schema per event type in `@mikro/common` (`business-event.ts`); producers and the dashboard both parse through it.
- [Restore hits unique-constraint or FK conflicts] → restore validates before writing and returns a structured error; spec has an explicit failure scenario.
- [Event volume growth on SQLite] → rows are small and indexed by time; the feed reads a page at a time. Revisit storage only with real numbers; "forever" retention is the requirement, not a risk to design away.
- [Cursor pagination deviates from repo convention] → documented here and in the router comment; contained to the feed endpoint.

## Migration Plan

One committed Prisma migration (`prisma migrate dev --name add_business_event_log`) per AGENTS.md — never `db push`. Purely additive (new table), so deploy is forward-only and rollback is dropping the table. Feed starts empty at deploy; no backfill.

## Open Questions

- None blocking. (Deferred by decision: SQLite cache, copilot, synthetic producers, PDF reports, backfill.)
