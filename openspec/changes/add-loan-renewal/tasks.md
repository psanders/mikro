## 0. Design gate

- [x] 0.1 Pencil: customer profile panel, renewal feed card (all statuses), renewal panel views (terms, contract, documents, finalize + NET_CHANGED re-confirm, cancel), Búsqueda solicitud row; update `renewalCards`, `cp/renewal-form-card`, "Préstamo renovado", loan search card
- [x] 0.2 Design sign-off from the user

## 1. Schema + common

- [x] 1.1 Prisma: `LoanRenewal`, `CustomerDocument.renewalId`; keep RENEWED/`renewedFromLoanId`/`closedAt`/`CustomerDocument.loanId`; hand-written migration with partial unique index (one open renewal per loan)
- [x] 1.2 Mirror in `test/integration/setup.ts` SCHEMA_SQL
- [x] 1.3 `common/schemas/loanRenewal.ts`: statuses, actions, `evaluateRenewalTransition`, block codes, ES/EN labels; both barrels (open-renewal uniqueness via a unique nullable `open_key` instead of a partial index, so Prisma sees no drift)
- [x] 1.4 Zod schemas: start, update terms, quote, generate contract, upload document, cancel, finalize(`confirmedNet`), list open; retire `renewLoanSchema`
- [x] 1.5 `updateCustomerSchema` widened; customer-document upload/get schemas; `BUSINESS_PHOTO` in the Zod type enum
- [x] 1.6 `loan.renewal.*` events + payload schemas (+ `business_events.renewal_id` join key); `loan.renewed` kept for old rows only
- [x] 1.7 `SEARCHABLE_APPLICATION_STATUSES`; `searchAllSchema` applications group

## 2. Apiserver

- [x] 2.1 start / update terms / quote / generate contract / upload document / cancel
- [x] 2.2 finalize (one tx, recompute, `NET_CHANGED`, ledger net, re-point documents)
- [x] 2.3 Roles: renewal, contract, documents → reviewerProcedure; delete document admin-only (`searchAll` follows with search; old `renewLoan` removed in phase 3)
- [x] 2.4 Customer-document upload/get/delete; `updateCustomer` widened
- [x] 2.5 `searchAll` applications (token name, phone digits, cédula, excludes DRAFT/ABANDONED); open to reviewers
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
