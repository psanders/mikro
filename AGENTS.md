# AGENTS.md

## Overview

Mikro Créditos: microlending platform for the Dominican Republic (colmado/informal
borrowers). npm-workspaces + Lerna monorepo: `apiserver` (Express + tRPC + Prisma/SQLite,
WhatsApp webhooks, AI agents José/CX), `agents` (LLM agents + tools), `common` (shared Zod
schemas, loan/mora math, PDFs), `ctl` (operator CLI), `dashboard` (founder/Ops back-office,
Tauri desktop + web), `mobile` (Expo collectors app), `score` (bureau facts, policy engine,
Mikro Decisión Chrome extension), `site` (mikro.do). Users: founder/ops staff, collectors,
applicants via WhatsApp and the website.

## Commands

- Install: `npm ci` at root (one lockfile for all workspaces; never `npm install` inside a workspace).
- Build: `npm run build` · Typecheck: `npm run typecheck` · Lint: `npm run lint` · Format: `npm run format:check`
- Tests: `npm test` (all) · one package: `npm test -w @mikro/<pkg>`
- apiserver integration: `npm run test:integration`
- Dashboard e2e (Playwright, builds apiserver first): `npm run test:e2e:dashboard`
- Mobile e2e (Maestro, needs a simulator): `npm run test:e2e`
- Default Verify per area:
  - common / agents / score / apiserver: `npm run typecheck -w @mikro/<pkg> && npm test -w @mikro/<pkg>`
    (apiserver also `npm run test:integration` when touching DB or routers)
  - dashboard: `npm run typecheck -w @mikro/dashboard && npm run test:e2e:dashboard` (no unit tests exist)
  - mobile: `npm run typecheck -w @mikro/mobile && npm test -w @mikro/mobile && npx expo prebuild --platform all --no-install`
  - ctl: `npm run typecheck -w @mikro/ctl` (no tests)
  - site: `npm run build:site`
  - Any `package.json` change: `npm ci --ignore-scripts && node .scripts/check-lockfile-platforms.mjs`

## Conventions

Profile: typescript
Overrides:

- Shared Zod schemas live in `mods/common/src/schemas/` and are exported twice
  (`schemas/index.ts` and `common/src/index.ts`); add both or consumers miss it.
- `mods/dashboard` (React/Vite/Tauri) and `mods/mobile` (Expo/React Native, jest) follow
  their own React style, not the validated-function pattern; mobile tests use jest, not mocha.
- Integration tests build the DB from a hand-maintained `SCHEMA_SQL`, separate from
  `prisma/migrations`; a schema change updates both.

## Areas

| Area label      | Paths                                            | Experts                                                  |
| :-------------- | :----------------------------------------------- | :------------------------------------------------------- |
| area: apiserver | mods/apiserver                                   | software-architect, database-engineer, security-engineer |
| area: agents    | mods/agents, agents.yaml, autopilot*.yaml        | security-engineer, qa-engineer                           |
| area: common    | mods/common                                      | software-architect, qa-engineer                          |
| area: dashboard | mods/dashboard                                   | ux-designer, visual-designer                             |
| area: mobile    | mods/mobile, eas.json                            | ux-designer, release-engineer                            |
| area: score     | mods/score                                       | security-engineer, qa-engineer                           |
| area: ctl       | mods/ctl                                         | technical-writer                                         |
| area: site      | site                                             | visual-designer, technical-writer                        |
| area: designs   | designs                                          | visual-designer                                          |
| area: ci        | .github, .scripts, lerna.json, package-lock.json | release-engineer, security-engineer                      |

## Compatibility

Breaking here means:

- `mikro.json` schema (`mods/common/src/config.ts`, `.strict()`): an unknown key crashes
  boot, rollbacks included. A new key ships only after the release that reads it is live.
- Prisma schema (`mods/apiserver/prisma`): every change ships a migration; container runs
  `prisma migrate deploy` at boot.
- tRPC routers (`mods/apiserver/src/trpc/routers`): consumed by installed desktop dashboards
  and store mobile builds that lag the server. Removing/renaming a procedure or tightening
  input breaks them silently (disabled buttons).
- Mobile native surface: changes to native config change the `fingerprint` runtime and
  need a store build; OTA updates only reach matching fingerprints.
- Env vars at startup: `DATABASE_URL`, `MIKRO_CONFIG_FILE`, `MIKRO_VERSION`; boot also requires
  `keys/private.pem` + `keys/public.pem`.
- `ctl` command names and flags (`mikro <topic>:<command>`), used in ops runbooks.
- WhatsApp webhook contract (Meta Cloud API payloads; Chatwoot echo).
- `site` builds from `common/src/utils/calculateLoan.ts`, `loanCalculatorConstants.ts`,
  `schemas/applicationForm.ts`; changing them changes the public website.

## Risk hotspots

- `mods/apiserver/prisma/**`, integration `SCHEMA_SQL`: data loss / boot failure; prod
  migrations were silently drifting until 2026-09-18.
- `mods/common/src/config.ts`: strict schema; caused the 2026-09-18 outage.
- Money math: `mods/common/src/utils/{paymentSplit,calculatePaymentStatus,calculateLoan}.ts`,
  `mods/apiserver/src/api/payments/`, `mods/apiserver/src/accounting/`: mora, receipts, ledger;
  history of phantom-mora and balance bugs.
- `mods/apiserver/src/api/applications/` (most fix commits since April) and
  `mods/dashboard/src/founder/copilot/`: guarded application lifecycle and conversion
  (auto-disbursement).
- `mods/agents/`, `mods/apiserver/src/api/jose/`: read untrusted WhatsApp text; can send
  messages to customers.
- `mods/apiserver/src/trpc/routers/protected.ts`: auth boundary.
- `.github/workflows/{release,publish-apiserver,deploy-apiserver,build-*}.yaml`, `Dockerfile`:
  release and deploy.

## Release

- Every push to `main` touching `mods/**`/lockfile runs `release.yaml`: Lerna bumps from
  conventional commits (feat → minor, fix → patch), writes CHANGELOG, tags `vX.Y.Z`.
  Dashboard/CI-only changes need `workflow_dispatch` with `force_release`.
- Tag → `publish-apiserver` (ghcr.io/psanders/mikro) → `deploy-apiserver` (droplet + smoke test).
  Tag also builds dashboard (Tauri, attached to the Release) and iOS; Android APK builds on
  main pushes touching mobile.
- Squash-merge with conventional-commit titles. Merge one PR at a time; wait for `release.yaml` before the next merge (each merge cuts a release).
- Prod `agents.yaml` is a manual copy on the droplet; changing it in the repo doesn't deploy it.

## Expert notes

### database-engineer

- SQLite via Prisma; client generated into `mods/apiserver/src/generated/prisma`.
- If a DB got a change via `db push`, reconcile with `prisma migrate resolve --applied`.

### release-engineer

- A workspace package the apiserver imports needs a `tsconfig` `references` entry and a
  `COPY` in `mods/apiserver/Dockerfile` (current: common, agents, score).
- Desktop dashboard updates via Tauri updater; v3.1.0 shipped no desktop build (skew risk).

### security-engineer

- WhatsApp WABA fans out to the Mikro app and Chatwoot separately; webhook callback URL is
  config on Meta's side, not in the repo.

### visual-designer

- Pencil (`designs/*.pen`) is the source of truth for Ops dashboard and apps; edit only via
  the Pencil MCP. Shared components/variables live only in `designs/mikro.lib.pen`
  (refs `ui:<id>`, `$ui:<name>`, dark theme axis `ui:mode`). One board per area, numbered
  sections, one canonical frame per screen + a table for states. Root `pencil.pen` is gone.
- Pen.app: a changed lib component shows in importing files only after restart. Save via
  File ▸ Save with the file's window focused, confirm mtime changed; close Pen before
  switching branches (it can overwrite disk with a stale copy).

## Decisions

- 2026-10-21: No evaluator mobile app; evaluation lives in Ops (dashboard). Mobile is collectors only.
- 2026-10-21: Designs are guidance: one canonical frame + table per screen, no state catalogs.
- 2026-09: Staff Chatwoot replies are not captured in CX transcripts (PR #303).
- 2026-07-04: iOS builds run `eas build --local` on GitHub macOS runners, not EAS cloud.
- Merged branches are deleted (local + remote) once `git merge-base --is-ancestor <b> origin/main` passes.
