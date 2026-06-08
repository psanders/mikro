## 1. Data model (Prisma)

- [x] 1.1 Remove `REFERRER` from the `Role` enum; remove `Customer.referredById` and the `User`↔`ReferredBy` relation (and `User.referredCustomers`)
- [x] 1.2 Generate + apply the migration: drop `referred_by_id` from `customers`, and delete any `user_roles` rows with `role = 'REFERRER'` (trim unrelated drift); run `db:generate`; client builds

## 2. Schemas + types (@mikro/common)

- [x] 2.1 Remove `REFERRER` from `roleEnum`; remove `referredById` from `createCustomerSchema`/`updateCustomerSchema` and from `convertApplicationSchema`
- [x] 2.2 Delete `listCustomersByReferrerSchema`, `listLoansByReferrerSchema`, `listPaymentsByReferrerSchema`, `exportCustomersByReferrerSchema` and their exported types/barrels
- [x] 2.3 Update `DbClient` (drop `referredById` from customer create/update + `findMany` filters) and `Customer` type; build `@mikro/common`

## 3. apiserver

- [x] 3.1 Delete `createListCustomersByReferrer`, `createListLoansByReferrer`, `createListPaymentsByReferrer`, `createExportCustomersByReferrer` + barrel exports
- [x] 3.2 Remove the `listCustomersByReferrer`/`listLoansByReferrer`/`listPaymentsByReferrer`/`exportCustomersByReferrer` tRPC procedures from `protected.ts`
- [x] 3.3 Drop `REFERRER` from `VALID_ROLES` (`context.ts`); remove `referredById` from `createConvertApplication` and customer create/update; remove referrer handling in export-all/export-collector reports; typecheck apiserver

## 4. AI agents

- [x] 4.1 Remove the "¿quién te refirió?" step + `listUsers(role=REFERRER)` usage from the onboarding flow (`joan`/`maria` scripts), the `referredById` param on the `createCustomer` tool, and the `exportCustomersByReferrer` tool (definitions/executor/index/types)
- [x] 4.2 Remove `REFERRER` from `createMessageRouter` primary-role logic + `constants.ts`; update eval fixtures (`similarityJudge`) and sample a conversation; build `@mikro/agents`

## 5. CLI (@mikro/ctl)

- [x] 5.1 Remove the `customers/loans/payments listByReferrer` commands and their registration
- [x] 5.2 Remove referrer prompts in `customers create` and `users create|update`, the `REFERRER` option in role prompts, and referrer grouping in `reports/customers` + `exportUtils`; build `@mikro/ctl`

## 6. Dashboard + seed

- [x] 6.1 Remove `REFERRER` from dashboard role labels (`Layout.tsx`) and any referrer affordance in `ClientesPage`
- [x] 6.2 Remove `REFERRER` role assignments and `referredById` from `seed.ts`

## 7. Verify

- [x] 7.1 `npm run typecheck` / `build` clean across `common`, `apiserver`, `agents`, `ctl`, `dashboard`
- [x] 7.2 Grep confirms no remaining `referredBy` / `ByReferrer` / `REFERRER` / `referidor` references (outside archived migrations)
- [ ] 7.3 Against the running stack: create a customer (dashboard convert + agent onboarding) with no referrer; the removed procedures/commands are gone
