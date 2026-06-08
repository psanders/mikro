## Why

Mikro is dropping referrals as a business concept — no more "who referred you?", no referrer role, no referrer-scoped reports. Today the concept is woven through the whole stack: a `REFERRER` role, `Customer.referredById`, three `*ByReferrer` query procedures, the WhatsApp onboarding flow that asks for and assigns a referrer, dedicated CLI commands, and seed data. Leaving it in is dead weight and confuses the model. This change removes it end to end.

## What Changes

- **Data model** — remove the `REFERRER` value from the `Role` enum and remove `Customer.referredById` (and the `User`↔referred-customers relation). Migration drops the column (existing referrer links are discarded).
- **Schemas/types (`@mikro/common`)** — drop `REFERRER` from `roleEnum`; remove `referredById` from `createCustomer`/`updateCustomer` and from `convertApplication`; delete `listCustomersByReferrer` / `listLoansByReferrer` / `listPaymentsByReferrer` / `exportCustomersByReferrer` schemas; update `DbClient` (drop `referredById` filters/relations).
- **apiserver** — delete the four `*ByReferrer` API functions + their tRPC procedures; drop `REFERRER` from `VALID_ROLES`; remove `referredById` handling in conversion and customer create/update.
- **AI agents** — remove the "¿quién te refirió?" step from the onboarding flow (joan/maria), the `listUsers(role=REFERRER)` usage, the referrer tool param on `createCustomer`, and the `exportCustomersByReferrer` tool. New customers are created without a referrer.
- **CLI (`@mikro/ctl`)** — remove the `customers/loans/payments listByReferrer` commands, the referrer prompts in `customers create` / `users create|update`, and referrer grouping in the customers report.
- **Dashboard** — drop `REFERRER` from role labels and any referrer UI affordance.
- **Seed** — remove `REFERRER` role assignments and `referredById` seed data.

## Capabilities

### New Capabilities

- `no-referrals`: Asserts the end state — no referrer role, field, procedures, agent step, or CLI commands

### Modified Capabilities

- _None with existing spec requirements_ (the removal is a cross-cutting refactor; the end state is captured by `no-referrals`)

## Impact

- ~45 files across `mods/apiserver`, `mods/common`, `mods/agents`, `mods/ctl`, `mods/dashboard`, plus `schema.prisma` + a migration and `seed.ts`
- **Breaking**: the `*ByReferrer` tRPC procedures and CLI commands are removed; any external caller relying on them breaks (none known internally)
- **Data loss**: `referredById` values are dropped by the migration (intentional)
- **Agent UX change**: onboarding no longer asks who referred the applicant — needs a quick review of the joan/maria conversation scripts so the flow still reads naturally
- Out of scope: replacing referrals with any new acquisition-attribution mechanism
