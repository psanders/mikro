## 0. Design gate

- [ ] 0.1 Pencil: customer profile panel, renewal feed card (all statuses), renewal panel views (terms, contract, documents, finalize + NET_CHANGED re-confirm, cancel), Búsqueda solicitud row; update `renewalCards`, `cp/renewal-form-card`, "Préstamo renovado", loan search card
- [ ] 0.2 Design sign-off from the user

## 1. Schema + common

- [ ] 1.1 Prisma: `LoanRenewal`, `CustomerDocument.renewalId`; keep RENEWED/`renewedFromLoanId`/`closedAt`/`CustomerDocument.loanId`; hand-written migration with partial unique index (one open renewal per loan)
- [ ] 1.2 Mirror in `test/integration/setup.ts` SCHEMA_SQL
- [ ] 1.3 `common/schemas/loanRenewal.ts`: statuses, actions, `evaluateRenewalTransition`, block codes, ES/EN labels; both barrels
- [ ] 1.4 Zod schemas: start, update terms, quote, generate contract, upload document, cancel, finalize(`confirmedNet`), list open; retire `renewLoanSchema`
- [ ] 1.5 `updateCustomerSchema` widened; customer-document upload/get schemas; `BUSINESS_PHOTO` in the Zod type enum
- [ ] 1.6 `loan.renewal.*` events + payload schemas; keep `loan.renewed`
- [ ] 1.7 `SEARCHABLE_APPLICATION_STATUSES`; `searchAllSchema` applications group

## 2. Apiserver

- [ ] 2.1 start / update terms / quote / generate contract / upload document / cancel
- [ ] 2.2 finalize (one tx, recompute, `NET_CHANGED`, ledger net, re-point documents)
- [ ] 2.3 Roles: renewal, contract, documents, `searchAll` → reviewerProcedure; delete document admin-only; remove `renewLoan`
- [ ] 2.4 Customer-document upload/get/delete; `updateCustomer` widened
- [ ] 2.5 `searchAll` applications (token name, phone digits, cédula, excludes DRAFT/ABANDONED)
- [ ] 2.6 Feed: generalize `application.` prefix, join renewal state, reviewer scoping, `listOpenRenewalEvents`

## 3. Copilot + ctl

- [ ] 3.1 `openRenewalForm` starts/returns a renewal; dock opens the panel; remove `RenewalFormCard`
- [ ] 3.2 `loans:renew` starts a renewal; cancel/finalize subcommands

## 4. Dashboard

- [ ] 4.1 Búsqueda for reviewers; "Ver perfil"/"Renovar" open panels
- [ ] 4.2 Panel context: customer + renewal kinds
- [ ] 4.3 `CustomerPanel` (edit, documents, loans, applications) + shared file drop zone
- [ ] 4.4 `LoanRenewalFeedCard` + `RenewalPanel` views; typeConfig, filters, FeedScreen wiring
- [ ] 4.5 Application search rows open the application panel (read-only where no action)
- [ ] 4.6 Stories

## 5. Tests

- [ ] 5.1 Unit: transition matrix; lifecycle functions; net 7,500 example; NET_CHANGED; contract excludes owed; search helpers
- [ ] 5.2 Integration: happy path, rollback, cancel, concurrency, partial index, role matrix, search statuses
- [ ] 5.3 E2E as reviewer: search → profile → renew → contract → signed → finalize; cancel; application search; admin smoke

## 6. Housekeeping

- [ ] 6.1 Sync specs to shipped behavior; Pencil in sync; ship checkpoint; ctl docs
