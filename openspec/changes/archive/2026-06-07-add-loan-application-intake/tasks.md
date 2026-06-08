## 1. Data model (Prisma)

- [x] 1.1 Add the `ApplicationStatus` enum to `mods/apiserver/prisma/schema.prisma` with values `DRAFT`, `RECEIVED`, `AI_REVIEWED`, `IN_REVIEW`, `APPROVED`, `REJECTED`, `SIGNED`, `CONVERTED`, `ABANDONED` (with `@@map("application_statuses")`)
- [x] 1.2 Add the `LoanApplication` model: `id` (uuid), `sessionId` (unique, mapped `session_id`), `status` (default `DRAFT`), `lastSection` (nullable), stable English fields (`firstName`, `lastName`, `phone`, `idNumber`, `dateOfBirth` DateTime?, `maritalStatus`, `businessType`, `businessName`, `requestedAmount` Decimal?, `purpose`, `requestedTermWeeks` Int?, `province`, `homeAddress`), `rawData` Json, nullable `customerId`/`loanId` (reserved), `submittedAt` DateTime?, `createdAt`, `updatedAt`; index `status` and `sessionId`; `@@map("loan_applications")`
- [x] 1.3 Generate the Prisma migration and run `prisma generate`; confirm the client types build (migration trimmed to only create `loan_applications` — the auto-generated `mora_rate` Float→Decimal rebuild of loans/payments was pre-existing drift, left out of scope)

## 2. Schema + normalizer (@mikro/common)

- [x] 2.1 Define the canonical English field-key set (firstName, lastName, phone, idNumber, dateOfBirth, maritalStatus, businessType, businessName, requestedAmount, purpose, requestedTermWeeks, province, homeAddress, + the rawData-only fields: spouse/reference/housing/business-detail) — this is the shared contract for both the form rename (task 5.1) and the schema; add a lenient zod schema (`applicationPayloadSchema`) accepting `sessionId`, `partial`, `lastSection` + all content fields optional
- [x] 2.2 Implement pure `normalizeApplication(raw)` that parses formatted values (currency `"50,000"` → `50000`, `"18 semanas"` → `18`, phone `"(829) 871-7987"` → E.164, date string → `Date`) and splits stable columns from `rawData`; all provided fields preserved under `rawData`; missing → null. No key translation
- [x] 2.3 Export the `LoanApplication` DTO types and the normalizer/schema from `@mikro/common` (added `types/application.ts`, `loanApplication` to `DbClient`; no test setup in `common`, so no unit tests added)
- [x] 2.4 Confirm `@mikro/common` builds (`npm run build -w @mikro/common`)

## 3. Public intake endpoint (@mikro/apiserver)

- [x] 3.1 Add an API function `createUpsertApplication(db)` that takes a normalized application + `partial` flag and upserts by `sessionId`, setting status `RECEIVED` (complete) or `DRAFT` (partial) and `submittedAt` on completion
- [x] 3.2 Mount `POST /v1/applications` in `mods/apiserver/src/index.ts` before the tRPC middleware: dedicated `express.json()` with a small body cap, a simple in-memory IP rate limiter, normalize → upsert, always respond `{ result: "ok" }` on success; log failures with `sessionId`; return 500 only on a genuine DB error so the form's connection-error path still works
- [x] 3.3 Add the public site origin to `corsAllowedOrigins` default in `mods/common/src/config.ts` and document it in `mikro.json.example`

## 4. Internal read procedures (@mikro/apiserver)

- [x] 4.1 Add `createListApplications(db)` (status filter + limit/offset) and `createGetApplication(db)` (by id or sessionId) API functions with zod input schemas in `@mikro/common`
- [x] 4.2 Register protected tRPC procedures `listApplications` and `getApplication` in `mods/apiserver/src/trpc/routers/protected.ts`

## 5. Update + repoint the site form

- [x] 5.1 Rename the form's field keys to English in `SolicitudPage.tsx`: update `INITIAL_FORM` keys and each `name=` attribute to the canonical English keys from task 2.1 (leave Spanish labels/options/enum tokens untouched); the generic `set(name, value)` / `form[name]` access needs no other changes
- [x] 5.2 Add a new env var (`VITE_APPLICATIONS_URL`) and point the partial + final `fetch` calls at it (with `Content-Type: application/json`) instead of `GOOGLE_FORM_URL`, keeping the `{ result: "ok" }` handling; updated `.env.example` and local `.env`
- [x] 5.3 Confirm `site` builds (`npm run build -w site`)

## 6. Verify

- [x] 6.1 `npm run typecheck` / `build` clean across `common`, `apiserver`, and `site`
- [x] 6.2 Against a running apiserver: partial post → `DRAFT` row with `lastSection`; same `sessionId` complete post → same row promoted to `RECEIVED` with `submitted_at`; parsing verified (phone→`+18298717987`, amount→`50000`, term→`18`, date parsed); a second `sessionId` created a separate `DRAFT` row
- [x] 6.3 Unauthenticated `listApplications` rejected with `UNAUTHORIZED` (401). Authenticated success path not exercised here (no test credentials); procedures compile + are registered, and the rows are confirmed present in the DB — the dashboard (Phase 4) will exercise the authenticated read
- [x] 6.4 Verified: preflight + POST from the allowed site origin (`http://localhost:5173`) carry the `Access-Control-Allow-Origin` echo + `Vary: Origin`; a disallowed origin gets no allow header
