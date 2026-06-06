# Project Context

> Background and conventions for Mikro. OpenSpec reads this to ground change proposals.
> Keep it concise and current — it is constraints, not documentation.

## Purpose

Mikro (Mikro Créditos) is a micro-lending platform: loan origination and
servicing, installment collection, past-due (mora) accrual, and a small
self-contained accounting module. Domain language is Spanish (Dominican
Republic); currency is DOP. Money is handled with care — see "Domain rules".

## Tech Stack

- **Language**: TypeScript (strict, ESM — `"type": "module"`), `target`/`module` ES2022, `moduleResolution: bundler`.
- **Runtime**: Node.js >= 22 (`.nvmrc` pins 22).
- **Monorepo**: npm workspaces + Lerna (`mods/*`, `site`). Package manager `npm@11`.
- **API**: tRPC over Express (`@mikro/apiserver`).
- **Persistence**: Prisma with the better-sqlite3 adapter; schema at `mods/apiserver/prisma/schema.prisma`.
- **Validation**: zod everywhere (shared across server, CLI, agents).
- **Agents**: LangChain with Anthropic / Google GenAI / OpenAI providers.
- **CLI**: `mikro` binary (`@mikro/ctl`), tRPC client; commands prompt interactively when flags are omitted.
- **Mobile**: Expo / Expo Router / React Native, react-query + tRPC client, expo-sqlite, BLE printing, Storybook RN.
- **Tooling**: ESLint (flat config) + Prettier, Husky + lint-staged pre-commit.

## Monorepo Structure

| Package            | Path             | Role                                                       |
| ------------------ | ---------------- | ---------------------------------------------------------- |
| `@mikro/common`    | `mods/common`    | Shared utilities and types (zod). Depended on by the rest. |
| `@mikro/apiserver` | `mods/apiserver` | tRPC API, webhooks, admin, Prisma data layer, accounting.  |
| `@mikro/ctl`       | `mods/ctl`       | `mikro` CLI (tRPC client, interactive prompts).            |
| `@mikro/agents`    | `mods/agents`    | AI agents (LangChain, multi-provider) + eval harness.      |
| `@mikro/mobile`    | `mods/mobile`    | Expo / React Native app.                                   |
| `site`             | `site`           | Web site/front end.                                        |

## Conventions

- ESM only — use `import`, include file extensions where the resolver needs them; no CommonJS.
- Validate inputs/outputs with zod; share schemas via `@mikro/common` rather than redefining.
- New API surface goes through tRPC routers in `@mikro/apiserver`; the CLI/mobile consume it via tRPC clients — don't bypass the API.
- Schema changes go through Prisma migrations (`npm run db:migrate`), not manual SQL.
- Config is read from `mikro.json` (see `mikro.json.example`); secrets/keys are not committed.
- CLI commands accept flags but should remain runnable interactively (prompt when a flag is omitted).
- Lint/format are enforced on commit (lint-staged) — keep changes clean.

## Domain Rules (money-sensitive — change carefully)

- **Auth**: per-user Bearer JWTs only; no shared credential. Tokens expire (`jwtExpiresIn`, default 30d). `adminProcedure` exists and is being applied per-route.
- **Mora (past-due fee)**: daily-prorated, capped by policy; on collection, cash is allocated **mora-first** (may produce linked `LATE_FEE` + `INSTALLMENT` payment rows). Mora previews/auto-split net out already-collected, non-reversed `LATE_FEE` for the current cycle to avoid double-billing. Policy defaults live under `loans` in `mikro.json`; optional per-loan `moraRate` override.
- **Payments**: reversals and receipts must stay consistent across linked rows; partial (`PARTIAL`) rows are counted in cash-total reports, so completing a cuota with a follow-up payment does not require reversing the earlier partial.
- **Accounting**: API-first (tRPC) with a prompt-driven CLI; shares only auth with the rest of the app. Mora is **not** auto-posted to the accounting ledger. See `ACCOUNTING.md`.

## Key Commands

- Build: `npm run build` (lerna) · Test: `npm test` · Typecheck: `npm run typecheck` · Lint: `npm run lint`
- API server: `npm start` · Mobile: `npm run start:mobile` · Site: `npm run start:site`
- DB: `npm run db:migrate` · `npm run db:seed` · `npm run db:studio`
- Agents eval: `npm run agents:eval`

## Notes

- README.md and ACCOUNTING.md hold deeper domain detail; this file is the summary OpenSpec should rely on.
- Outstanding guardrails (see README TODO): cap payments at loan amount, enforce per-frequency amounts, partial-payment support, tighter per-route authorization.
