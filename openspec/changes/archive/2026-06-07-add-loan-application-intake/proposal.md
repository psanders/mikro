## Why

Mikro's public website has a live multi-step loan application form (`site/src/pages/SolicitudPage.tsx`) that currently posts to a Google Apps Script → Google Sheet. That path is opaque, off-platform, and disconnected from Mikro's data model — applications never enter the system, so they can't be reviewed, evaluated, or converted into customers/loans. This is Phase 1 of the loan origination pipeline epic: bring application intake in-house onto a stable data model.

The guiding principle: **the form is volatile, Mikro's core is stable.** We store a small set of stable, English-named extracted fields plus a `rawData` JSON blob holding the full submission. The pipeline operates on the stable fields; `rawData` is the audit trail and the buffer against form drift.

## What Changes

- Add a `LoanApplication` Prisma model and an `ApplicationStatus` enum covering the full lifecycle (`DRAFT`, `RECEIVED`, `AI_REVIEWED`, `IN_REVIEW`, `APPROVED`, `REJECTED`, `SIGNED`, `CONVERTED`, `ABANDONED`). Only `DRAFT`/`RECEIVED` are exercised in this phase; the rest are reserved so later phases add transitions without schema churn.
- Update `site/src/pages/SolicitudPage.tsx` to use **English field keys** on the wire (the user-visible Spanish labels/options are unchanged — only the React state keys / `name=` attributes), so the form's payload matches our stable columns 1:1.
- Add a lenient zod schema for the incoming form payload (must accept partial/incomplete submissions) and a `normalizeApplication(raw)` function that **parses** the formatted values (currency string → Decimal, "18 semanas" → 18, phone → E.164, date string → Date) and **splits** stable columns from the `rawData` buffer. No language translation needed.
- Add a **public, unauthenticated** REST endpoint (`POST /v1/applications`) that accepts the form's existing JSON contract, normalizes it, and **upserts by `sessionId`** — `RECEIVED` when `partial:false`, `DRAFT` when `partial:true`. Includes body-size cap, basic rate limiting, and CORS for the public site origin.
- Add internal **protected** tRPC procedures `listApplications` (status filter + pagination) and `getApplication` (by id or sessionId) — the read path the Phase 4 dashboard will consume.
- Repoint the form from the Google endpoint to the new apiserver endpoint via a new env var, keeping the `{ result: "ok" }` response handling.

## Capabilities

### New Capabilities

- `loan-application-model`: The `LoanApplication` data model, status lifecycle enum, and the normalization from raw form payload to stable English fields + `rawData`
- `loan-application-intake`: The public intake endpoint (upsert-by-session, partial/complete handling, safeguards) and the internal read procedures

### Modified Capabilities

- `api-cors`: The public site origin must be allowed for the new unauthenticated intake endpoint

## Impact

- `mods/apiserver/prisma/schema.prisma` — new enum + model + migration
- `mods/common/src/schemas/` — new application schema, normalizer, DTO types
- `mods/apiserver/src/` — public REST route + internal tRPC procedures + API functions
- `mods/common/src/config.ts` + apiserver CORS — allow the public site origin
- `site/src/pages/SolicitudPage.tsx` + site env — rename field keys to English and repoint form submission
- No changes to `Customer`/`Loan` models in this phase (conversion is Phase 3)
- Out of scope: AI evaluation (Phase 2), human review transitions (Phase 2), contract PDF upload + `SIGNED` (Phase 3), conversion to Customer + Loan (Phase 3), dashboard UI (Phase 4). Optional/separate: a one-off `mikro.csv` backfill script.
