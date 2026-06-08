## Context

Referrals span six areas: Prisma (`Role.REFERRER`, `Customer.referredById` + relations), `@mikro/common` (roleEnum, customer/convert schemas, four `*ByReferrer` schemas, `DbClient`), apiserver (four API fns + tRPC procedures, `VALID_ROLES`, conversion/customer handling), the AI agents (onboarding asks for a referrer and assigns it on `createCustomer`), the CLI (referrer commands + prompts + report grouping), and the dashboard (role labels). A grep finds ~45 implicated files.

## Goals / Non-Goals

**Goals:**

- Remove the referrer concept end to end so the model, API, agents, CLI, and UI no longer reference it.
- Keep the build green and the onboarding conversation natural after the referrer step is removed.

**Non-Goals:**

- Any replacement attribution/acquisition tracking.
- Backfilling or preserving historical referrer data (it is dropped).

## Decisions

### Order of operations (bottom-up)

Change in dependency order so the build never dangles: (1) Prisma schema + migration; (2) `@mikro/common` schemas/types; (3) apiserver API fns + tRPC + context; (4) agents; (5) ctl; (6) dashboard; (7) seed. Each layer compiles before the next.

### Migration drops the column and enum value

SQLite stores enums as TEXT, so removing `REFERRER` from the `Role` enum is a schema-only change (no SQL). Dropping `Customer.referredById` is a real `ALTER TABLE` (table rebuild on SQLite). Any `user_roles` rows with `role = 'REFERRER'` should be deleted in the migration so no orphan role strings remain. As with prior migrations, trim any unrelated drift the generator includes.

### Agent onboarding rework is the delicate part

`joan`/`maria` currently ask "¿quién te refirió?" and call `listUsers(role=REFERRER)` then pass the id to `createCustomer`. Remove that turn from the scripts and the `referredById` tool param, so the bot goes straight from identity/business questions to creating the customer. Review the surrounding prompt text so the flow still reads coherently (no dangling reference to a referrer). This is the highest-risk edit — verify with the agent eval/sample conversations if available.

### Removals are hard deletes, not deprecations

The `*ByReferrer` procedures/commands are deleted outright (no internal consumers). This is breaking but intended; the proposal flags it.

## Risks / Trade-offs

- **Agent conversation regressions** → The onboarding script changes could read awkwardly or break eval expectations (`similarityJudge` references "REFERRER"). Mitigate by updating eval fixtures and sampling a conversation after the change.
- **Migration data loss** → `referredById` is dropped intentionally; call it out so it's a conscious choice, not a surprise.
- **Wide diff, merge risk** → ~45 files; do it as one focused change, build per layer, and avoid touching unrelated code.
- **Generated Prisma client churn** → Regenerate + run the ESM fix (`db:generate`) after the schema change, as in prior migrations.

## Open Questions

- Should `user_roles` rows currently holding `REFERRER` be deleted (recommended) or left as inert strings? (Plan: delete them in the migration.)
- Are there any external/automation consumers of the `*ByReferrer` tRPC procedures or CLI commands? (Assumed none internally.)
