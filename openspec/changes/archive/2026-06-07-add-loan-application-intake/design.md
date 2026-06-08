## Context

The public form at `site/src/pages/SolicitudPage.tsx` is already live and posts JSON to a Google Apps Script endpoint. It fires a partial POST on every section toggle (`{ ...form, sessionId, partial: true, lastSection }`) and a final POST on submit (`{ ...form, sessionId, partial: false }`), all keyed by a client-generated `sessionId`. The wire payload uses Spanish camelCase keys (`nombre`, `montoSolicitado`, `plazo`, …), and `tipoNegocio`/`provincia` already arrive as enum-style values (`COLMADO`, `PUERTO_PLATA`).

The apiserver (Express 5 + tRPC v11 + Prisma) already has a config-driven CORS middleware that echoes allowed origins, and an API-function factory pattern (`createXxx(db)` returning a validated function). This change reuses those patterns rather than introducing new ones.

This is Phase 1 of a 4-phase epic (intake → review+AI → conversion+signing → dashboard UI). Decisions here are constrained by what later phases need.

## Goals / Non-Goals

**Goals:**

- A `LoanApplication` table that captures every submission on a stable English schema + a `rawData` JSON buffer
- A public endpoint that accepts the form's existing contract with zero/minimal form changes, upserting by `sessionId`
- Internal read procedures so the Phase 4 dashboard can list/inspect applications
- Define the full status enum now so later phases add only transitions, not migrations

**Non-Goals:**

- AI evaluation, human review/approval, contract signing, conversion to Customer/Loan (Phases 2–3)
- The dashboard UI (Phase 4)
- Rewriting the form's field names or UX (only repoint the submission URL + response handling)
- Authentication on the public endpoint (it is intentionally public)

## Decisions

### Upsert by `sessionId`, one row per session

The form streams many POSTs per session (partials, then final). Each maps to **one** `LoanApplication` identified by a unique `sessionId`. Each POST re-normalizes the full payload and updates the row. `partial:false` sets status `RECEIVED`; `partial:true` keeps/sets `DRAFT` and records `lastSection`. This means a session that completes naturally lands in `RECEIVED` with the latest data, and abandoned sessions remain `DRAFT` for follow-up.

Rationale vs. insert-per-POST: the form has no server-assigned ID before submitting, and we want partial leads coalesced, not duplicated.

### Stable English fields + `rawData` JSON

The model stores a curated set of stable, English-named columns the pipeline depends on (name, phone, idNumber, requestedAmount, requestedTermWeeks, purpose, province, …) **plus** a `rawData Json` column holding the entire normalized payload. If the form adds/renames fields, only `rawData` and the normalizer change — the pipeline and downstream phases keep working. `businessType`/`province` are stored as strings (the form already sends enum-style tokens) but kept as `String` (not Prisma enums) so a new form option never breaks a write.

### Form posts English field keys

`SolicitudPage.tsx` is updated so its React state keys / `name=` attributes are English (`firstName`, `requestedAmount`, …), making the wire payload match the stable columns 1:1. Only the keys change — user-visible Spanish labels, options, and enum tokens (`COLMADO`, `PUERTO_PLATA`) are untouched. Since we now own both ends of the contract (we cut the Google path entirely), there is no reason to carry a translation layer. The historical `mikro.csv` (Spanish Sheet headers) is a separate optional backfill with its own mapping, unaffected by this.

### Normalizer is pure, parse-only, and lives in `@mikro/common`

`normalizeApplication(raw)` is a pure function (no DB) that **parses** formatted values and **splits** stable columns from the `rawData` buffer — no key translation. Parsing: currency string `"50,000"` → `Decimal(50000)`, `"18 semanas"` → `18`, phone `"(829) 871-7987"` → E.164 `+18298717987`, ISO date string → `Date`. The stable columns are a subset of form fields; everything (including unmapped fields like spouse/reference/housing) is preserved in `rawData`. Living in `@mikro/common` keeps it unit-testable. Parsing is **best-effort and lenient**: a partial submission missing most fields still normalizes (missing → null), because partials must be accepted.

### Public REST endpoint, not tRPC

Intake is a plain `POST /v1/applications` (not a tRPC procedure) because the caller is an anonymous public website, not a typed tRPC client. It mounts before the tRPC middleware, parses JSON with a small body cap (applications are tiny — a few KB), applies a simple in-memory rate limit keyed by IP, and always responds `{ result: "ok" }` to match what the form already expects. Validation failures are logged but still return `ok` to avoid leaking schema details publicly and to keep partial autosaves silent.

### Reserved conversion FKs, unused this phase

`customerId` and `loanId` are added as **nullable** columns now (no relations enforced yet) so Phase 3 conversion can populate them without a second migration. The full `ApplicationStatus` enum is defined now for the same reason.

## Risks / Trade-offs

- **Public unauthenticated endpoint = abuse surface** → Mitigate with body-size cap, in-memory IP rate limit, and lenient validation that never executes anything from the payload. Production hardening (WAF, captcha) is noted as a follow-up, not built here.
- **Always returning `{ result: "ok" }` hides real errors** → We log every normalization/DB failure server-side with the `sessionId`; the form UX intentionally shouldn't surface internal errors for autosaves. The final submit still returns `ok` only after a successful upsert; DB failure returns a 500 so the form can show its connection-error message.
- **`businessType`/`province` as free strings** → Loses DB-level enum validation, but protects writes against form drift; the dashboard maps known tokens to labels and shows unknowns verbatim.
- **CSV is not migrated automatically** → Historical Sheet rows stay out unless we run the optional backfill; acceptable since live capture is the priority.

## Open Questions

- Should the partial-autosave POSTs be debounced server-side or is per-toggle write volume acceptable? (Assume acceptable for now — low traffic.)
- Does the production apiserver already terminate TLS / sit behind a proxy that sets `X-Forwarded-For`? The rate-limit IP key may need to read that header in production. (Use `req.ip` with Express `trust proxy` left to deployment config.)
