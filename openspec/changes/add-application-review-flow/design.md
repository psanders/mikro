## Context

The review pipeline today lives in `mods/common/src/schemas/application.ts` (`REVIEW_TRANSITIONS` + `resolveReviewTransition`), `mods/apiserver/src/api/applications/*` (`reviewApplication.ts`, `createConvertApplication.ts`, `createUploadSignedContract.ts`, …), and the mobile evaluator (`mods/mobile/app/(evaluator)`, `app/solicitud`). The founder desktop app (`mods/dashboard/src/founder`) shows the business event log as a feed, fed by tRPC procedures tagged `.meta({ event })` and mapped in `api/events/mappers.ts`. The final design is `pencil.pen` → board `EzobQ` → section `bBdhj` (screens: reviewer feed `QeyK3`, evidence `i7Umh`, edit `k4S97G`, approved `ZjqE9`, disbursement `DvlAW`, closed group `Dq5Zl`, admin decision `PYWaG`, detail panel `k71Rb`/`UbCzS`).

Constraints: no change to `mods/agents` or the WhatsApp nudge; SQLite (Prisma 7) with hand-kept integration `SCHEMA_SQL`; `mikro.json` is `.strict()`; the dashboard has no test runner today.

## Goals / Non-Goals

**Goals:** a correct, role-aware lifecycle enforced in one place; evidence captured and locked at the right moments; approved terms carried into the loan; a feed that shows each person only what needs them; the whole path covered by automated tests.

**Non-Goals:** mobile-web capture link and GPS (future); auto-assignment of the queue; changing DRAFT nudging/abandonment (CX phase); a mobile review experience.

## Decisions

### D1. Guarded transition table, no XState

State lives in the database and each transition is one mutation, so an interpreter adds nothing. The existing table becomes:

```ts
type Actor = { id: string; roles: Role[] };
type Rule = {
  from: Status[]; to: Status | "same";
  who: "reviewer" | "assignee" | "admin" | "reviewer-or-admin";
  requires?: (app: ApplicationForTransition, input: unknown, ctx: TransitionContext) => string | null; // reason or null
};
evaluateTransition(app, action, actor, input?, ctx?) → { ok: true; to: Status } | { ok: false; reason: TransitionBlock }
```

`TransitionBlock` is a small code union (`WRONG_STATUS`, `NOT_ALLOWED`, `NOT_ASSIGNEE`, `EVIDENCE_INCOMPLETE`, `RECOMMENDATION_REQUIRED`, `NOTE_REQUIRED`, `REASON_REQUIRED`, `TERMS_REQUIRED`, `CONTRACT_REQUIRED`), plus a Spanish label map for the UI. It is pure and table-tested, and the server maps a block to a tRPC `FORBIDDEN` (role/assignee) or `CONFLICT` (status/requirements).

| action           | from                                           | to               | who                                                                   | requires                                |
| ---------------- | ---------------------------------------------- | ---------------- | --------------------------------------------------------------------- | --------------------------------------- |
| promote          | DRAFT                                          | RECEIVED         | reviewer-or-admin                                                     | —                                       |
| assign           | RECEIVED, IN_REVIEW                            | IN_REVIEW        | self: reviewer-or-admin (RECEIVED only); other user / reassign: admin | assignee has REVIEWER or ADMIN          |
| sendToDecision   | IN_REVIEW                                      | PENDING_DECISION | assignee                                                              | evidence complete, recommendation       |
| returnToReviewer | PENDING_DECISION                               | IN_REVIEW        | admin                                                                 | note                                    |
| approve          | PENDING_DECISION                               | APPROVED         | admin                                                                 | approvedAmount, approvedTermWeeks       |
| reject           | IN_REVIEW (assignee), PENDING_DECISION (admin) | REJECTED         | as noted                                                              | reason (enum); note required when OTHER |
| withdraw         | APPROVED                                       | ABANDONED        | assignee or admin                                                     | —                                       |
| convert          | APPROVED                                       | CONVERTED        | assignee or admin                                                     | signed contract stored                  |

"Reviewer" means a user with the REVIEWER or ADMIN role. An admin who is also the assignee can do everything (the founder holds both roles). Separation of duties (the approver must differ from the assignee) is deliberately **not** enforced; with a one-person admin team it would block every approval. It can be added later as a single `requires` guard.

### D2. Data model

`LoanApplication` gains `assignedReviewerId`, `assignedAt`, `reviewerRecommendation` (text; `recommendation` is already the score engine's column), `sentToDecisionAt`, `decidedById`, `decidedAt`, `decisionNote`, `rejectionReason` (`ApplicationRejectionReason`: `OUT_OF_COVERAGE_AREA`, `PAYMENT_CAPACITY`, `DOCUMENTS`, `OTHER`), `approvedAmount`, `approvedTermWeeks`, `aiSummary`, `aiSummaryAt`. It drops `reviewedById`, `reviewedAt`, `reviewNote`.

New `ApplicationDocument { id, applicationId, kind: BUSINESS_PHOTO | OTHER, filename, originalName, mimeType, size, sha256, label?, uploadedById, createdAt }`. Files use the existing content-addressed storage (`applications/storage.ts`, `<sha256>.<ext>`). ID front/back stay as columns: they are the two fixed slots.

The `ApplicationStatus` enum drops `SIGNED` and adds `PENDING_DECISION`.

### D3. Migration (data first, then columns)

1. Add the new columns and table.
2. `assignedReviewerId = reviewedById` where status is `IN_REVIEW`.
3. For decided rows (`APPROVED`, `SIGNED`, `CONVERTED`, `REJECTED` with a reviewer): `decidedById = reviewedById`, `decidedAt = reviewedAt`, `decisionNote = reviewNote`, and `assignedReviewerId = reviewedById` (best available).
4. `REJECTED` + `reviewNote = 'OUT_OF_COVERAGE_AREA'` → `rejectionReason = OUT_OF_COVERAGE_AREA`, `decisionNote = NULL`. Other `REJECTED` → `rejectionReason = OTHER`.
5. `SIGNED` → `APPROVED`. The contract columns are untouched, so these can convert right away.
6. `APPROVED` rows get `approvedAmount = requestedAmount`, `approvedTermWeeks = requestedTermWeeks` (the pre-existing implicit approval).
7. Drop the old columns (SQLite table rebuild, as Prisma generates).

Checked with `prisma migrate` on a copy of prod before release.

### D4. Evidence completeness and locking

Complete = `idFrontFilename` and `idBackFilename` present, AND BUSINESS_PHOTO count ≥ `applications.minBusinessPhotos` (optional config, default 3). The recommendation is a separate requirement of `sendToDecision`, so the UI can name each missing piece. Uploads, deletes, `updateApplication`, and recommendation edits are allowed only when `status = IN_REVIEW` and the caller is the assignee (admins may act as assignee only if assigned). Locking needs no flag: it follows from status, since `PENDING_DECISION` blocks writes and `returnToReviewer` puts it back in `IN_REVIEW`.

Upload logic lives in `api/applications/evidence/` as plain functions (`storeApplicationDocument`, `removeApplicationDocument`) taking an already-authorized actor. The future token-authenticated capture route calls the same functions.

### D5. Conversion uses the approved decision

`convertApplication` accepts an optional `accountId` (defaulting to config `accounting.disbursementAccountId`), which must be an active account. It requires `principal === approvedAmount`; a different amount is a new decision, so the admin returns and re-approves. Term and frequency stay caller-supplied, as today, because weeks do not map 1:1 to every frequency. The approved term is shown as guidance and printed on the contract. BUSINESS_PHOTO and OTHER documents copy into `CustomerDocument` by reference, like ID and contract; this needs new `CustomerDocumentType` values `BUSINESS_PHOTO` and `OTHER`.

### D6. Events and role-scoped feed

New `.meta({ event })` tags on the new procedures. `application.received` is written directly (not via middleware) by the intake paths when a row becomes RECEIVED: `createUpsertApplication` (final submit), `createPromoteApplication`, and `createSubmitApplicationFromFlow`. The system out-of-area rejection writes `application.rejected` with the system actor.

The feed query gains `scope: "mine"`, resolved server-side from the caller's roles:

- REVIEWER: `application.received` for rows still RECEIVED, plus every application event whose application is assigned to the caller.
- ADMIN: `application.sent_to_decision` for rows still PENDING_DECISION, plus events of applications the caller decided.
- Both roles: the union.

Other event types keep today's visibility (admins see all business events; reviewers see only application events). Each application event carries `applicationId` and the application's **current** status (joined at read time) so the client can show the live state and the correct card treatment.

"Cerradas" grouping: rows whose application is currently CONVERTED, REJECTED or ABANDONED fold into one per-day group row. This is a client-side pass like `groupFeedRuns`, over already-scoped data, because the day buckets are a client concern.

### D7. AI summary

`summarizeApplication(app, createModel?)` follows the `explainLoanHealth` pattern: with no model it returns null and nothing breaks. It runs on `application.received` and after a successful `updateApplication`, fire-and-forget with logging, and stores `aiSummary`/`aiSummaryAt`. The model factory is the apiserver's existing `createModel` from copilot deps; `mods/agents` is untouched. Tests stub the model.

### D8. Side panel everywhere

One `SidePanel` primitive (600 px, right, scrim, optional back crumb, pinned footer, Esc/scrim closes, focus trap) hosts `ApplicationPanel` views and the Tareas task form. The inline admin decision stays on the card. There is no modal component left in `founder/`.

### D9. Reviewer access to the founder app

`App.tsx` currently admits only ADMIN. It becomes: ADMIN → full shell; REVIEWER-only → feed only (search, Tareas, Reportes and copilot expose non-application data); others → `AccessScreen`. The backend already guards with `reviewerProcedure` / `adminProcedure`, and the UI change is cosmetic on top of that.

### D10. End-to-end tests

- **Unit (common):** the table-driven `evaluateTransition` test. It enumerates every `Status` × action × actor kind and fails when a status or action has no expectation (exhaustiveness via `satisfies Record<…>`).
- **Integration (apiserver, SQLite):** `applicationLifecycle.test.ts` drives the tRPC caller through the full happy path, send-back, the reject paths, withdraw, forbidden roles, evidence locking, the abandon guard, and event emission; it asserts the ledger WITHDRAWAL on the chosen account and the CustomerDocument copies.
- **E2E (dashboard):** Playwright against `vite` (web build, Tauri APIs guarded) plus an apiserver started on a temp SQLite file with `scripts/seed-e2e.mjs` (deterministic users: admin, reviewer; applications in every status). Specs cover the reviewer journey, admin decide/return, convert → Cerradas, reviewer scoping, and the Tareas panel. Root script `test:e2e:dashboard`; CI workflow `e2e-dashboard.yaml` on PRs touching `mods/dashboard`, `mods/apiserver`, `mods/common`.

## Risks / Trade-offs

- **Big-bang release (mobile removal + API break):** a phone running an old evaluator build hits removed procedures. Mitigation: the evaluator was internal-only; the error text tells the user to use the desktop app, and the release notes say so.
- **Migration on prod SQLite:** a column drop means a table rebuild. Mitigation: `VACUUM INTO` backup first (as on 2026-09-18), rehearse on a snapshot, `migrate deploy` only (never `db push`).
- **No separation of duties:** accepted for team size (D1).
- **AI summary cost/latency:** async, optional, one call per receive/edit.
- **Playwright adds a dependency:** pure JS runner, but browsers download in CI. AGENTS.md lockfile/platform rules apply; run `check-lockfile-platforms.mjs`.

## Migration Plan

Merge → release (apiserver + dashboard + mobile together) → the deploy runs `migrate deploy`, preceded by a backup. Rollback is restore-from-backup (the migration is not reversible, because columns are dropped); the previous app versions then work against the restored DB.

## Open Questions

None blocking. Future: the capture link, GPS evidence, separation of duties, queue auto-assignment.
