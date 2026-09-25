## Why

Loan applications are reviewed in the mobile evaluator app, with a pipeline that lets one person claim, approve and convert without a second look, overloads a single `reviewedById` column for every step, has no place for business photos, doesn't save the terms that were approved, and auto-abandons submitted applications nobody claimed within ~8 h. The Ops app already has a live feed of business events; the review work belongs there, split by role: reviewers gather evidence, an admin decides, and closed applications get out of the way.

The design is final in `pencil.pen`, section 08 of the Founder Dashboard board (`EzobQ` → `bBdhj`).

## What Changes

- The founder app becomes the **Ops app** (`/ops`; `/founder` redirects): admins and reviewers now share it, each seeing what concerns them.

- **BREAKING** Application lifecycle becomes `DRAFT → RECEIVED → IN_REVIEW → PENDING_DECISION → APPROVED → CONVERTED`, with exits `REJECTED` and `ABANDONED`. `SIGNED` is removed: existing SIGNED rows migrate to `APPROVED` (their contract stays attached).
- **BREAKING** Review actions become `assign` (replaces `claim`; covers "take it myself", admin assign and admin reassign), `sendToDecision`, `returnToReviewer`, `approve`, `reject`, `withdraw`, `convert`. `reopen` and `sign` are removed.
- One shared, pure transition table with roles and guards (`evaluateTransition`) in `@mikro/common`, used by the server to authorize and by the UI to show why an action is unavailable. No new state-machine dependency.
- Decisions are admin-only: approve (with the approved amount and term), return to reviewer (note required), reject (reason from a fixed list). Reviewers reject from IN_REVIEW with a reason. The system keeps rejecting out-of-area intake (`OUT_OF_COVERAGE_AREA`).
- IN_REVIEW is the evidence step: ID front/back (fixed slots, existing columns), business photos (new `ApplicationDocument`, minimum from config, default 3), optional other documents, and a reviewer recommendation. Only the assigned reviewer edits data or uploads, and only in IN_REVIEW; evidence is locked at `sendToDecision` and reopens on return.
- Conversion requires APPROVED + signed contract, uses the approved amount as principal, and lets the caller pick the disbursement account (config `accounting.disbursementAccountId` becomes the default). Business photos are copied into `CustomerDocument` like ID and contract already are.
- **BREAKING** `reviewedById`/`reviewedAt`/`reviewNote` are replaced by `assignedReviewerId`, `decidedById`, `decidedAt`, `decisionNote`, `rejectionReason`, `reviewerRecommendation`, `approvedAmount`, `approvedTermWeeks`, `sentToDecisionAt`, plus a stored `aiSummary`. Data migrates.
- New feed events: `application.received`, `.assigned`, `.sent_to_decision`, `.returned`, `.approved`, `.rejected`, `.withdrawn`, `.converted` (`application.signed` removed). The feed is role-scoped: reviewers see the RECEIVED queue and their own applications, admins see what awaits their decision and what they decided; a user with both roles sees both. Closed applications collapse into a per-day "Cerradas" group.
- The Ops app opens to REVIEWER users (scoped shell). Every application view and action lives in one right side panel (detail, edit, evidence, disbursement, assign); the admin decision is inline on its card. The Tareas "Nueva tarea" modal moves to the same side panel, so the Ops app has no popups.
- Follow-up timers: the ABANDON job no longer abandons RECEIVED applications. The WhatsApp nudge is unchanged.
- **BREAKING** The mobile evaluator (queue, detail, edit, contract, convert screens, and evaluator navigation) is removed in the same release. The collector app is unchanged.
- New Playwright end-to-end suite for the Ops app, run against a real apiserver on a seeded SQLite database, plus a full-lifecycle apiserver integration test.

## Capabilities

### New Capabilities

- `application-evidence`: ID slots, business photos, other documents, completeness rule, and locking.
- `ops-application-flow`: application cards, role-scoped feed, "Cerradas" group, side panel views, inline admin decision, reviewer access to the Ops app.
- `dashboard-e2e`: the Playwright suite, its seeded backend, and the CI job.

### Modified Capabilities

- `loan-application-review`: new actions, roles, guards, and the shared transition table.
- `loan-application-model`: status enum without SIGNED + PENDING_DECISION; the new decision/assignment columns replace the review audit columns.
- `loan-application-signing`: uploading the signed contract no longer changes status.
- `loan-application-conversion`: converts from APPROVED with a contract; account choice; approved principal.
- `loan-application-edit`: edits restricted to the assigned reviewer in IN_REVIEW.
- `loan-application-follow-up-timers`: ABANDON never touches RECEIVED.
- `business-event-log`: the application lifecycle event set.
- `founder-tasks`: the task create/edit form renders in the side panel.
- `mobile-evaluator-access`, `mobile-evaluator-review-flow`: removed.

## Impact

- `mods/common`: `schemas/application.ts` (enums, inputs, transition table), config (`applications.minBusinessPhotos`, optional, default 3), barrel exports.
- `mods/apiserver`: Prisma schema + migration (data moves, SIGNED → APPROVED), `api/applications/*`, `trpc/routers/protected.ts`, `api/events/mappers.ts`, feed query, `follow-up/createHandleAbandonJob.ts`, AI summary, integration `SCHEMA_SQL`, tests.
- `mods/ctl`: applications commands and the ad-quality report status sets.
- `mods/dashboard`: founder shell/access, feed cards, `SidePanel`, `ApplicationPanel`, `TaskFormModal` → panel, Storybook, Playwright.
- `mods/mobile`: evaluator code removed.
- **Not touched:** `mods/agents` (routing, José, WhatsApp handlers, agents.yaml), the WhatsApp nudge sender and template, prospect routing (`getApplicationByPhone` still reads DRAFT vs not-DRAFT).
- **Deploy:** apiserver, dashboard and mobile ship in one release. `applications.minBusinessPhotos` is optional, so no `mikro.json` change is needed at deploy; if set, add it only after this version is live (the config schema is `.strict()`).
- **Future (not in this change):** a tokenized mobile-web capture link, sent to the customer or a street collector, capturing GPS and photos into the same evidence storage.

### Retired Capabilities

- `mobile-evaluator-access` and `mobile-evaluator-review-flow`: the mobile evaluator app is removed, so these capability specs are deleted outright (every requirement was removed).
