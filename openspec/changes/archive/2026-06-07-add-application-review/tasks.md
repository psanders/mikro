## 1. REVIEWER role

- [x] 1.1 Add `REVIEWER` to the Prisma `Role` enum (`schema.prisma`)
- [x] 1.2 Add `REVIEWER` to `roleEnum` in `mods/common/src/schemas/user.ts`
- [x] 1.3 Add `REVIEWER` to `VALID_ROLES` in `mods/apiserver/src/trpc/context.ts`

## 2. Data model (Prisma)

- [x] 2.1 Add to `LoanApplication`: `reviewedById` String? (`@map("reviewed_by_id")`), `reviewedAt` DateTime? (`@map("reviewed_at")`), `reviewNote` String? (`@map("review_note")`)
- [x] 2.2 Generate + apply the migration (trim the unrelated `mora_rate` loans/payments drift, as before; the `Role` enum addition is no-op SQL on SQLite); run `prisma generate`; confirm client builds

## 3. Schemas + transition helper (@mikro/common)

- [x] 3.1 Add review mutation input schemas: `claimApplicationSchema`, `approveApplicationSchema`, `rejectApplicationSchema`, `reopenApplicationSchema` — each identifies the application by `id` or `sessionId` (reuse the existing id-or-sessionId refinement); `rejectApplicationSchema` requires a non-empty `reason`; approve/reopen take an optional `note`
- [x] 3.2 Add a pure `assertReviewTransition(from, to)` helper (or `canReviewTransition`) enumerating the allowed transitions (RECEIVED→IN_REVIEW; RECEIVED|IN_REVIEW→APPROVED; RECEIVED|IN_REVIEW→REJECTED; APPROVED|REJECTED→IN_REVIEW); export it + input types
- [x] 3.3 Extend the `DbClient` `loanApplication` interface with an `update({ where: { id }, data })` method; extend `LoanApplicationWriteData`/the review path with `reviewedById`/`reviewedAt`/`reviewNote`; extend the `LoanApplication` type with the three columns; build `@mikro/common`

## 4. Review API + mutations (@mikro/apiserver)

- [x] 4.1 Add a `reviewerProcedure` in `trpc.ts` (mirror `adminProcedure`) that allows callers whose roles include `ADMIN` or `REVIEWER`, else `FORBIDDEN`
- [x] 4.2 Add API functions in `api/applications/`: `createClaimApplication`, `createApproveApplication`, `createRejectApplication`, `createReopenApplication` — each loads the app (by id or sessionId), validates the transition via the helper (throw a clear error naming current+attempted status on failure), and updates `status` + `reviewedById` + `reviewedAt` + `reviewNote`
- [x] 4.3 Register reviewer-gated tRPC mutations `claimApplication`, `approveApplication`, `rejectApplication`, `reopenApplication` in `protected.ts` using `reviewerProcedure`, passing `ctx.userId` as the reviewer
- [x] 4.4 Export the new API functions from `api/applications/index.ts` and `api/index.ts`
- [x] 4.5 Tighten read access: switch `listApplications`/`getApplication` from `protectedProcedure` to `reviewerProcedure` (applications carry applicant PII; reviewers/admins only)

## 5. Verify

- [x] 5.1 `npm run build`/`typecheck` clean across `common` and `apiserver`
- [x] 5.2 Against a running apiserver (ADMIN or REVIEWER token): claim a `RECEIVED` app → `IN_REVIEW` with reviewer set; approve → `APPROVED`; reject another with a reason → `REJECTED` + reason in `reviewNote`; reopen an approved/rejected → `IN_REVIEW`
- [x] 5.3 Invalid transition (e.g. approve a `DRAFT`) returns a clear error; reject without a reason fails validation
- [x] 5.4 A caller without ADMIN/REVIEWER (e.g. COLLECTOR-only) is forbidden; an unauthenticated caller is unauthorized
- [x] 5.5 `listApplications`/`getApplication` reject a non-reviewer (COLLECTOR-only) with FORBIDDEN and an unauthenticated caller with UNAUTHORIZED; a reviewer succeeds
