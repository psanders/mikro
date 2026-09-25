# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [3.1.0](https://github.com/psanders/mikro/compare/v3.0.0...v3.1.0) (2026-09-25)

**Note:** Version bump only for package @mikro/agents

# [3.0.0](https://github.com/psanders/mikro/compare/v2.6.1...v3.0.0) (2026-09-25)

### Features

- application review in the Ops app (assign → decision → convert) ([#291](https://github.com/psanders/mikro/issues/291)) ([e5fc733](https://github.com/psanders/mikro/commit/e5fc733cf1b2af6b3e4c52118841601fab168980)), closes [#290](https://github.com/psanders/mikro/issues/290)

### BREAKING CHANGES

- the mobile app no longer reviews applications.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019CNF3yXgznaHMZr4aSpPGV

- test(ops): Playwright end-to-end suite against a real apiserver

mods/dashboard/e2e: prepare.mjs builds a throwaway backend (receipt keys,
prisma migrate deploy on a fresh SQLite file, deterministic seed via the real
review procedures: scripts/seed-e2e.mjs), then Playwright boots the apiserver
and the Vite web build. Specs: reviewer takes from the queue, uploads the
cédula slots and 3 photos, recommends and sends to decision; admin approves
with adjusted terms and returns another with a required note; reviewer
disburses from a configured account and the card moves to Cerradas; role
scoping (another reviewer's application and the admin tools are hidden);
Tareas form opens in the side panel; /founder redirects to /ops.

npm run test:e2e:dashboard runs it all; .github/workflows/e2e-dashboard.yaml
runs it on PRs touching dashboard/apiserver/common and uploads the report on
failure.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019CNF3yXgznaHMZr4aSpPGV

- fix(ops): keep a card open across its own changes; one primary per card

Cards are keyed and expanded by application, so after 'Tomar' the card lands
on the evidence step instead of collapsing. The recommendation's save button
is secondary (one primary action per card), an APPROVED application flags only
its assigned reviewer, and a reviewer sees pending cards as 'esperando al
admin'. Adds Storybook stories for SidePanel and the application building
blocks. The reviewer e2e spec asserts the card stays open.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019CNF3yXgznaHMZr4aSpPGV

- docs(openspec): tick verified tasks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019CNF3yXgznaHMZr4aSpPGV

- fix(ops): pluralize the installment frequency in the contract total

"10 cuotas semanals" → "10 cuotas semanales"; the summary appended an "s" to
the singular label. Found while recording the end-to-end walkthrough.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019CNF3yXgznaHMZr4aSpPGV

- fix(applications): regressions found rehearsing the migration on a prod copy

Rehearsed `prisma migrate deploy` on a copy of the production database and
compared every shared read query of the current release against this branch.
Money paths (loans, payments, ledger, customers, exports) are identical; these
are the application-flow regressions it surfaced:

- Open applications had no card: the feed draws an application at its newest
  event, and `application.received` is new, so the whole existing queue (and
  some in-review/approved rows) was invisible. The migration now backfills one
  received event per open application, dated at submission.
- Contracts signed before this flow (migrated SIGNED rows) could not be
  disbursed: they stored no contract terms, and one had no amount. The
  disbursement panel now asks for the terms from the signed paper (and the
  amount when none is on record), as the old flow did; `convert` accepts the
  operator's principal only for such pre-flow approvals.
- Old rejections whose note starts with the retired app's reason label map to
  PAYMENT_CAPACITY / DOCUMENTS instead of OTHER.
- "cuotas semanals" in the disbursement summary.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019CNF3yXgznaHMZr4aSpPGV

## [2.6.1](https://github.com/psanders/mikro/compare/v2.6.0...v2.6.1) (2026-09-22)

**Note:** Version bump only for package @mikro/agents

# [2.6.0](https://github.com/psanders/mikro/compare/v2.5.0...v2.6.0) (2026-09-22)

### Features

- **site:** step-by-step solicitud with progress; auto-reject out-of-area applications ([#288](https://github.com/psanders/mikro/issues/288)) ([18e4ed1](https://github.com/psanders/mikro/commit/18e4ed1014abd6302c1209f23eac0b7f9a3f3528))

# [2.5.0](https://github.com/psanders/mikro/compare/v2.4.0...v2.5.0) (2026-09-22)

### Features

- **agents:** add whatsapp.agentRepliesEnabled kill switch ([#287](https://github.com/psanders/mikro/issues/287)) ([33f64b2](https://github.com/psanders/mikro/commit/33f64b2750bab073dd13704eef331b59a38ff1ae))

# [2.4.0](https://github.com/psanders/mikro/compare/v2.3.1...v2.4.0) (2026-09-22)

**Note:** Version bump only for package @mikro/agents

## [2.3.1](https://github.com/psanders/mikro/compare/v2.3.0...v2.3.1) (2026-09-18)

### Bug Fixes

- **api:** empty QCobro portfolios that no customer matches anymore ([#285](https://github.com/psanders/mikro/issues/285)) ([30020d2](https://github.com/psanders/mikro/commit/30020d2072bdc7eb3264b3bf7fc27ee141c39dfb)), closes [fonoster/qcobro#191](https://github.com/fonoster/qcobro/issues/191) [fonoster/qcobro#191](https://github.com/fonoster/qcobro/issues/191)

# [2.3.0](https://github.com/psanders/mikro/compare/v2.2.0...v2.3.0) (2026-09-18)

**Note:** Version bump only for package @mikro/agents

# [2.2.0](https://github.com/psanders/mikro/compare/v2.1.1...v2.2.0) (2026-09-18)

**Note:** Version bump only for package @mikro/agents

# [2.1.0](https://github.com/psanders/mikro/compare/v2.0.5...v2.1.0) (2026-09-17)

**Note:** Version bump only for package @mikro/agents

## [2.0.4](https://github.com/psanders/mikro/compare/v2.0.3...v2.0.4) (2026-08-05)

**Note:** Version bump only for package @mikro/agents

## [2.0.3](https://github.com/psanders/mikro/compare/v2.0.2...v2.0.3) (2026-08-05)

**Note:** Version bump only for package @mikro/agents

## [2.0.2](https://github.com/psanders/mikro/compare/v2.0.1...v2.0.2) (2026-08-05)

**Note:** Version bump only for package @mikro/agents

## [2.0.1](https://github.com/psanders/mikro/compare/v2.0.0...v2.0.1) (2026-08-05)

**Note:** Version bump only for package @mikro/agents

# [2.0.0](https://github.com/psanders/mikro/compare/v1.42.0...v2.0.0) (2026-08-05)

**Note:** Version bump only for package @mikro/agents

# [1.42.0](https://github.com/psanders/mikro/compare/v1.41.1...v1.42.0) (2026-07-30)

**Note:** Version bump only for package @mikro/agents

## [1.41.1](https://github.com/psanders/mikro/compare/v1.41.0...v1.41.1) (2026-07-23)

**Note:** Version bump only for package @mikro/agents

# [1.41.0](https://github.com/psanders/mikro/compare/v1.40.2...v1.41.0) (2026-07-23)

**Note:** Version bump only for package @mikro/agents

## [1.40.1](https://github.com/psanders/mikro/compare/v1.40.0...v1.40.1) (2026-07-20)

**Note:** Version bump only for package @mikro/agents

# [1.40.0](https://github.com/psanders/mikro/compare/v1.39.8...v1.40.0) (2026-07-20)

**Note:** Version bump only for package @mikro/agents

## [1.39.8](https://github.com/psanders/mikro/compare/v1.39.7...v1.39.8) (2026-07-17)

**Note:** Version bump only for package @mikro/agents

## [1.39.6](https://github.com/psanders/mikro/compare/v1.39.5...v1.39.6) (2026-07-12)

**Note:** Version bump only for package @mikro/agents

# [1.39.0](https://github.com/psanders/mikro/compare/v1.38.0...v1.39.0) (2026-07-11)

**Note:** Version bump only for package @mikro/agents

# [1.38.0](https://github.com/psanders/mikro/compare/v1.37.2...v1.38.0) (2026-07-11)

**Note:** Version bump only for package @mikro/agents

## [1.37.2](https://github.com/psanders/mikro/compare/v1.37.1...v1.37.2) (2026-07-11)

**Note:** Version bump only for package @mikro/agents

## [1.37.1](https://github.com/psanders/mikro/compare/v1.37.0...v1.37.1) (2026-07-10)

**Note:** Version bump only for package @mikro/agents

# [1.37.0](https://github.com/psanders/mikro/compare/v1.36.0...v1.37.0) (2026-07-10)

**Note:** Version bump only for package @mikro/agents

# [1.36.0](https://github.com/psanders/mikro/compare/v1.35.5...v1.36.0) (2026-07-10)

**Note:** Version bump only for package @mikro/agents

## [1.35.5](https://github.com/psanders/mikro/compare/v1.35.4...v1.35.5) (2026-07-10)

**Note:** Version bump only for package @mikro/agents

## [1.35.3](https://github.com/psanders/mikro/compare/v1.35.2...v1.35.3) (2026-07-09)

**Note:** Version bump only for package @mikro/agents

## [1.35.2](https://github.com/psanders/mikro/compare/v1.35.1...v1.35.2) (2026-07-09)

**Note:** Version bump only for package @mikro/agents

## [1.35.1](https://github.com/psanders/mikro/compare/v1.35.0...v1.35.1) (2026-07-09)

**Note:** Version bump only for package @mikro/agents

# [1.35.0](https://github.com/psanders/mikro/compare/v1.34.1...v1.35.0) (2026-07-09)

**Note:** Version bump only for package @mikro/agents

## [1.34.1](https://github.com/psanders/mikro/compare/v1.34.0...v1.34.1) (2026-07-08)

**Note:** Version bump only for package @mikro/agents

# [1.34.0](https://github.com/psanders/mikro/compare/v1.33.1...v1.34.0) (2026-07-08)

**Note:** Version bump only for package @mikro/agents

# [1.33.0](https://github.com/psanders/mikro/compare/v1.32.0...v1.33.0) (2026-07-07)

### Features

- **copilot:** daily cash reconciliation + accounting transaction tool ([#115](https://github.com/psanders/mikro/issues/115)) ([ebf94d2](https://github.com/psanders/mikro/commit/ebf94d279fa723b01483b83b315998a2a5e8e5fa))

# [1.32.0](https://github.com/psanders/mikro/compare/v1.31.0...v1.32.0) (2026-07-07)

### Features

- **copilot:** loan lookup by phone parity (Maria parity) — [#119](https://github.com/psanders/mikro/issues/119) ([657c73b](https://github.com/psanders/mikro/commit/657c73b21347dfafb0b9fc6edd0d061c5aaf2b46))

# [1.31.0](https://github.com/psanders/mikro/compare/v1.30.0...v1.31.0) (2026-07-07)

### Features

- **copilot:** send payment receipt via WhatsApp (Maria parity) ([0a527e5](https://github.com/psanders/mikro/commit/0a527e51b998aa6d593a266d50249cd6f61837e5)), closes [#118](https://github.com/psanders/mikro/issues/118)

# [1.30.0](https://github.com/psanders/mikro/compare/v1.29.0...v1.30.0) (2026-07-07)

### Features

- **copilot:** let founders force an on-demand QCobro portfolio sync ([6787ddb](https://github.com/psanders/mikro/commit/6787ddb5ec6f336370528b080f837786ce560c4a)), closes [#130](https://github.com/psanders/mikro/issues/130)

# [1.29.0](https://github.com/psanders/mikro/compare/v1.28.0...v1.29.0) (2026-07-07)

### Features

- **copilot:** application review tools (approve/reject/delete) — [#114](https://github.com/psanders/mikro/issues/114) ([add384b](https://github.com/psanders/mikro/commit/add384b1b27c3ad926478303da85f6702812693e))

# [1.28.0](https://github.com/psanders/mikro/compare/v1.27.0...v1.28.0) (2026-07-07)

### Features

- **whatsapp:** track delivery status and deliver templates outside the 24h window ([22ca3ab](https://github.com/psanders/mikro/commit/22ca3ab9222d47a06dcd3694fa41ab97b46c691b)), closes [#85](https://github.com/psanders/mikro/issues/85) [#121](https://github.com/psanders/mikro/issues/121)

# [1.27.0](https://github.com/psanders/mikro/compare/v1.26.0...v1.27.0) (2026-07-07)

**Note:** Version bump only for package @mikro/agents

# [1.26.0](https://github.com/psanders/mikro/compare/v1.25.1...v1.26.0) (2026-07-07)

**Note:** Version bump only for package @mikro/agents

## [1.25.1](https://github.com/psanders/mikro/compare/v1.25.0...v1.25.1) (2026-07-06)

**Note:** Version bump only for package @mikro/agents

# [1.25.0](https://github.com/psanders/mikro/compare/v1.24.1...v1.25.0) (2026-07-06)

**Note:** Version bump only for package @mikro/agents

## [1.24.1](https://github.com/psanders/mikro/compare/v1.24.0...v1.24.1) (2026-07-06)

**Note:** Version bump only for package @mikro/agents

# [1.24.0](https://github.com/psanders/mikro/compare/v1.23.0...v1.24.0) (2026-07-06)

**Note:** Version bump only for package @mikro/agents

# [1.23.0](https://github.com/psanders/mikro/compare/v1.22.6...v1.23.0) (2026-07-06)

### Features

- **copilot:** tool/environment awareness + githubFeedback tool ([#111](https://github.com/psanders/mikro/issues/111)) ([752db3f](https://github.com/psanders/mikro/commit/752db3f76f1fbef5dfda229d57b1a654e199aa14))

## [1.22.6](https://github.com/psanders/mikro/compare/v1.22.5...v1.22.6) (2026-07-05)

**Note:** Version bump only for package @mikro/agents

## [1.22.5](https://github.com/psanders/mikro/compare/v1.22.4...v1.22.5) (2026-07-05)

**Note:** Version bump only for package @mikro/agents

## [1.22.4](https://github.com/psanders/mikro/compare/v1.22.3...v1.22.4) (2026-07-05)

**Note:** Version bump only for package @mikro/agents

## [1.22.3](https://github.com/psanders/mikro/compare/v1.22.2...v1.22.3) (2026-07-05)

**Note:** Version bump only for package @mikro/agents

## [1.22.1](https://github.com/psanders/mikro/compare/v1.22.0...v1.22.1) (2026-07-05)

**Note:** Version bump only for package @mikro/agents

# [1.22.0](https://github.com/psanders/mikro/compare/v1.21.2...v1.22.0) (2026-07-04)

**Note:** Version bump only for package @mikro/agents

## [1.21.2](https://github.com/psanders/mikro/compare/v1.21.1...v1.21.2) (2026-07-04)

**Note:** Version bump only for package @mikro/agents

## [1.21.1](https://github.com/psanders/mikro/compare/v1.21.0...v1.21.1) (2026-07-04)

**Note:** Version bump only for package @mikro/agents

# [1.21.0](https://github.com/psanders/mikro/compare/v1.20.1...v1.21.0) (2026-07-04)

### Bug Fixes

- **apiserver,common,mobile,agents:** require assigned collector for every customer ([7b96568](https://github.com/psanders/mikro/commit/7b965681e27dd9ff0468332f85afc4c95bc99b27)), closes [#41](https://github.com/psanders/mikro/issues/41)

## [1.20.1](https://github.com/psanders/mikro/compare/v1.20.0...v1.20.1) (2026-07-03)

**Note:** Version bump only for package @mikro/agents

# [1.20.0](https://github.com/psanders/mikro/compare/v1.19.3...v1.20.0) (2026-07-03)

### Features

- **apiserver,agents:** wire sendPromo as a founder-copilot WRITE_TOOL ([6ea964c](https://github.com/psanders/mikro/commit/6ea964c2e12648de63c900641e149b6fd6584438)), closes [#78](https://github.com/psanders/mikro/issues/78)

## [1.19.3](https://github.com/psanders/mikro/compare/v1.19.2...v1.19.3) (2026-07-03)

**Note:** Version bump only for package @mikro/agents

## [1.19.2](https://github.com/psanders/mikro/compare/v1.19.1...v1.19.2) (2026-07-03)

**Note:** Version bump only for package @mikro/agents

## [1.19.1](https://github.com/psanders/mikro/compare/v1.19.0...v1.19.1) (2026-07-03)

**Note:** Version bump only for package @mikro/agents

# [1.19.0](https://github.com/psanders/mikro/compare/v1.18.0...v1.19.0) (2026-07-03)

**Note:** Version bump only for package @mikro/agents

# [1.18.0](https://github.com/psanders/mikro/compare/v1.17.1...v1.18.0) (2026-07-03)

### Features

- **mobile,agents:** move new-customer promotion off WhatsApp into the app ([2e21ab4](https://github.com/psanders/mikro/commit/2e21ab45e66ae78884e91927f11cb7c97e92db62)), closes [#68](https://github.com/psanders/mikro/issues/68)

# [1.17.0](https://github.com/psanders/mikro/compare/v1.16.1...v1.17.0) (2026-07-02)

**Note:** Version bump only for package @mikro/agents

# [1.16.0](https://github.com/psanders/mikro/compare/v1.15.0...v1.16.0) (2026-07-01)

**Note:** Version bump only for package @mikro/agents

# [1.15.0](https://github.com/psanders/mikro/compare/v1.14.3...v1.15.0) (2026-06-28)

**Note:** Version bump only for package @mikro/agents

## [1.14.3](https://github.com/psanders/mikro/compare/v1.14.2...v1.14.3) (2026-06-23)

**Note:** Version bump only for package @mikro/agents

## [1.14.2](https://github.com/psanders/mikro/compare/v1.14.1...v1.14.2) (2026-06-23)

**Note:** Version bump only for package @mikro/agents

## [1.14.1](https://github.com/psanders/mikro/compare/v1.14.0...v1.14.1) (2026-06-23)

**Note:** Version bump only for package @mikro/agents

# [1.14.0](https://github.com/psanders/mikro/compare/v1.13.1...v1.14.0) (2026-06-22)

### Features

- **ctl:** add applications:sendPromo command + whatsapp template smoke-test ([2d61127](https://github.com/psanders/mikro/commit/2d61127d7902bd01d1318d40f92372318f8de1da))

# [1.13.0](https://github.com/psanders/mikro/compare/v1.12.0...v1.13.0) (2026-06-21)

### Features

- **whatsapp:** payment-confirmation template + configurable timers + single language ([1fd16eb](https://github.com/psanders/mikro/commit/1fd16ebd835f101926f2a086dac436b45a8dbd1a))

# [1.12.0](https://github.com/psanders/mikro/compare/v1.11.0...v1.12.0) (2026-06-21)

### Bug Fixes

- **agents:** restore BUSINESS_PHONE constant in collector test ([dbc69dd](https://github.com/psanders/mikro/commit/dbc69dd751e6f4d1ff7e8e0f3f1cab340286e75e))

### Features

- **agents:** add collector photo-prospecting WhatsApp agent ([b62dd04](https://github.com/psanders/mikro/commit/b62dd044bff420bee383c2ce88768d3a60d4cf47))

# [1.11.0](https://github.com/psanders/mikro/compare/v1.10.2...v1.11.0) (2026-06-21)

### Features

- **agents:** short-form José intake with opt-out and ABANDONED status ([5bb0ab1](https://github.com/psanders/mikro/commit/5bb0ab1329cb703159a93aa1728b21affedce5d2))

## [1.10.2](https://github.com/psanders/mikro/compare/v1.10.1...v1.10.2) (2026-06-20)

**Note:** Version bump only for package @mikro/agents

## [1.10.1](https://github.com/psanders/mikro/compare/v1.10.0...v1.10.1) (2026-06-20)

### Bug Fixes

- **agents:** per-agent replyMode, fix zone check, drop weekend boilerplate ([78e4874](https://github.com/psanders/mikro/commit/78e48747eb7cf489400b98ec6a0cb953e9cd5fbe))

# [1.10.0](https://github.com/psanders/mikro/compare/v1.9.3...v1.10.0) (2026-06-20)

### Features

- **agents:** externalize agents to YAML, route by profile ([23e23a4](https://github.com/psanders/mikro/commit/23e23a4cb2a3075491c9ffe6c2928560c01ea4c6))

## [1.9.3](https://github.com/psanders/mikro/compare/v1.9.2...v1.9.3) (2026-06-20)

**Note:** Version bump only for package @mikro/agents

# [1.9.0](https://github.com/psanders/mikro/compare/v1.8.0...v1.9.0) (2026-06-18)

**Note:** Version bump only for package @mikro/agents

# [1.8.0](https://github.com/psanders/mikro/compare/v1.7.1...v1.8.0) (2026-06-13)

### Features

- **whatsapp:** retire inbound intake greeting; no auto-response to unknowns ([#34](https://github.com/psanders/mikro/issues/34)) ([4082eb8](https://github.com/psanders/mikro/commit/4082eb8ee703bc77a5a7abfe1c4547e87874f39f))

## [1.7.1](https://github.com/psanders/mikro/compare/v1.7.0...v1.7.1) (2026-06-13)

### Bug Fixes

- **solicitudes:** match loan_application template format for promo send ([#30](https://github.com/psanders/mikro/issues/30)) ([99dacdf](https://github.com/psanders/mikro/commit/99dacdfc927c11a82384c2f94e9c191384e8800f))

# [1.7.0](https://github.com/psanders/mikro/compare/v1.6.1...v1.7.0) (2026-06-13)

### Features

- **solicitudes:** send WhatsApp promo on manual application creation ([#29](https://github.com/psanders/mikro/issues/29)) ([2fc969e](https://github.com/psanders/mikro/commit/2fc969e294486cd0b58fd6ab9e7272509b6ceab1))

# [1.6.0](https://github.com/psanders/mikro/compare/v1.5.0...v1.6.0) (2026-06-13)

### Bug Fixes

- **contracts:** move legal-entity data to mikro.json; drop cedula assets ([e8045b8](https://github.com/psanders/mikro/commit/e8045b82baa7dd4400de8b5665a5237215de6e64))

# [1.5.0](https://github.com/psanders/mikro/compare/v1.4.1...v1.5.0) (2026-06-11)

### Features

- **whatsapp:** prospect loan-application intake via native Flow form ([57133c1](https://github.com/psanders/mikro/commit/57133c1bfd222061e6b54c4bd4652387e1cd4e39))
- **whatsapp:** support sending the intake Flow in draft mode ([57c5fe8](https://github.com/psanders/mikro/commit/57c5fe8e3af9b7fc6a344309f665d54007dd8f89))

## [1.4.1](https://github.com/psanders/mikro/compare/v1.4.0...v1.4.1) (2026-06-11)

**Note:** Version bump only for package @mikro/agents

# [1.4.0](https://github.com/psanders/mikro/compare/v1.3.0...v1.4.0) (2026-06-10)

**Note:** Version bump only for package @mikro/agents

# [1.3.0](https://github.com/psanders/mikro/compare/v1.2.4...v1.3.0) (2026-06-09)

**Note:** Version bump only for package @mikro/agents

# [1.2.0](https://github.com/psanders/mikro/compare/v1.1.3...v1.2.0) (2026-06-08)

**Note:** Version bump only for package @mikro/agents

## [1.1.3](https://github.com/psanders/mikro/compare/v1.1.2...v1.1.3) (2026-06-06)

**Note:** Version bump only for package @mikro/agents

## [1.1.1](https://github.com/psanders/mikro/compare/v1.1.0...v1.1.1) (2026-06-01)

**Note:** Version bump only for package @mikro/agents
