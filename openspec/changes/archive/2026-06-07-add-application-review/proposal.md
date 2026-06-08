## Why

Applications now arrive and are scored automatically, but nothing lets a human act on them. The score is advisory; an operator still has to decide. This is Phase 2b of the loan origination pipeline: the human review/decision layer — claim, approve, reject, and undo — that moves an application from `RECEIVED` toward a decision before signing and conversion.

## What Changes

- **Review audit columns on `LoanApplication`** — `reviewedById` (the deciding admin), `reviewedAt`, and `reviewNote` (rejection reason or approval note).
- **A new `REVIEWER` role** — added to the `Role` enum (Prisma + `@mikro/common` + the apiserver's accepted-roles list). Users can hold it alongside other roles (roles are many-to-one).
- **Reviewer-gated mutations** (allowed for `ADMIN` or `REVIEWER`, via a new `reviewerProcedure`):
  - `claimApplication` — `RECEIVED → IN_REVIEW` (records the reviewer)
  - `approveApplication` — `RECEIVED|IN_REVIEW → APPROVED` (optional note)
  - `rejectApplication` — `RECEIVED|IN_REVIEW → REJECTED` (required reason)
  - `reopenApplication` — `APPROVED|REJECTED → IN_REVIEW` (undo a decision)
- **Transition validation** — each mutation checks the current→next transition and throws a clear error on an invalid one (e.g. cannot approve a `DRAFT` or a `CONVERTED` row).
- The human decision is authoritative: the advisory score (including `OUT_OF_ZONE`/`CRITICAL_BUSINESS`) is surfaced but never hard-blocks a decision.

### Defaults chosen (vetoable)

- Review is permitted for **`ADMIN` or `REVIEWER`** (new `reviewerProcedure`).
- Decisions may be made **directly from `RECEIVED`** or after claiming (`IN_REVIEW`).
- `APPROVED`/`REJECTED` are **reversible** via `reopenApplication`.
- The **latest decision is stored on the row** (not a separate append-only log).

## Capabilities

### New Capabilities

- `loan-application-review`: The reviewer (ADMIN/REVIEWER) transitions (claim/approve/reject/reopen), their validation, and the recorded decision; the `REVIEWER` role

### Modified Capabilities

- `loan-application-model`: `LoanApplication` gains review audit columns (`reviewedById`, `reviewedAt`, `reviewNote`)
- `loan-application-intake`: the read procedures (`listApplications`/`getApplication`) are tightened from any authenticated user to reviewers (ADMIN/REVIEWER), since applications carry applicant PII

## Impact

- `mods/apiserver/prisma/schema.prisma` — `REVIEWER` added to the `Role` enum; review columns on `LoanApplication` + migration
- `mods/common/src/` — `REVIEWER` in `roleEnum`; review mutation input schemas, a transition-validation helper, `DbClient.loanApplication.update`, extended `LoanApplication` type
- `mods/apiserver/src/` — `REVIEWER` in the accepted-roles list (`context.ts`), a new `reviewerProcedure`, review API functions + reviewer-gated tRPC mutations
- Out of scope: signed-PDF upload + `SIGNED` and conversion to Customer+Loan (Phase 3), dashboard UI (Phase 4), an append-only review event/audit log (latest decision on the row for now; event log a possible later enhancement), notifications, and any auto-decisioning
