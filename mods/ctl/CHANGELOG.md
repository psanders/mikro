# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [3.3.1](https://github.com/psanders/mikro/compare/v3.3.0...v3.3.1) (2026-09-25)

**Note:** Version bump only for package @mikro/ctl

# [3.3.0](https://github.com/psanders/mikro/compare/v3.2.0...v3.3.0) (2026-09-25)

**Note:** Version bump only for package @mikro/ctl

# [3.2.0](https://github.com/psanders/mikro/compare/v3.1.0...v3.2.0) (2026-09-25)

**Note:** Version bump only for package @mikro/ctl

# [3.1.0](https://github.com/psanders/mikro/compare/v3.0.0...v3.1.0) (2026-09-25)

**Note:** Version bump only for package @mikro/ctl

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

**Note:** Version bump only for package @mikro/ctl

# [2.6.0](https://github.com/psanders/mikro/compare/v2.5.0...v2.6.0) (2026-09-22)

**Note:** Version bump only for package @mikro/ctl

# [2.5.0](https://github.com/psanders/mikro/compare/v2.4.0...v2.5.0) (2026-09-22)

**Note:** Version bump only for package @mikro/ctl

# [2.4.0](https://github.com/psanders/mikro/compare/v2.3.1...v2.4.0) (2026-09-22)

### Features

- measure form completeness for the solicitud (issue [#280](https://github.com/psanders/mikro/issues/280)) ([#286](https://github.com/psanders/mikro/issues/286)) ([a6aef20](https://github.com/psanders/mikro/commit/a6aef20eb3f635117dca386e5260a85a834fb02a))

## [2.3.1](https://github.com/psanders/mikro/compare/v2.3.0...v2.3.1) (2026-09-18)

**Note:** Version bump only for package @mikro/ctl

# [2.3.0](https://github.com/psanders/mikro/compare/v2.2.0...v2.3.0) (2026-09-18)

### Features

- **ctl:** add applications:cleanup to purge stale DRAFT and ABANDONED applications ([#284](https://github.com/psanders/mikro/issues/284)) ([3b8f7e8](https://github.com/psanders/mikro/commit/3b8f7e805656c4b142f081fd647fe804aca98eda))

# [2.2.0](https://github.com/psanders/mikro/compare/v2.1.1...v2.2.0) (2026-09-18)

### Features

- **reports:** attribute applications to their ad and report lead quality per ad ([#282](https://github.com/psanders/mikro/issues/282)) ([97c631f](https://github.com/psanders/mikro/commit/97c631f7856a96c09e9fab4be7bae062ef228ba6)), closes [#280](https://github.com/psanders/mikro/issues/280)

## [2.1.1](https://github.com/psanders/mikro/compare/v2.1.0...v2.1.1) (2026-09-18)

**Note:** Version bump only for package @mikro/ctl

# [2.1.0](https://github.com/psanders/mikro/compare/v2.0.5...v2.1.0) (2026-09-17)

**Note:** Version bump only for package @mikro/ctl

## [2.0.5](https://github.com/psanders/mikro/compare/v2.0.4...v2.0.5) (2026-09-02)

**Note:** Version bump only for package @mikro/ctl

## [2.0.4](https://github.com/psanders/mikro/compare/v2.0.3...v2.0.4) (2026-08-05)

**Note:** Version bump only for package @mikro/ctl

## [2.0.3](https://github.com/psanders/mikro/compare/v2.0.2...v2.0.3) (2026-08-05)

**Note:** Version bump only for package @mikro/ctl

## [2.0.2](https://github.com/psanders/mikro/compare/v2.0.1...v2.0.2) (2026-08-05)

**Note:** Version bump only for package @mikro/ctl

## [2.0.1](https://github.com/psanders/mikro/compare/v2.0.0...v2.0.1) (2026-08-05)

**Note:** Version bump only for package @mikro/ctl

# [2.0.0](https://github.com/psanders/mikro/compare/v1.42.0...v2.0.0) (2026-08-05)

**Note:** Version bump only for package @mikro/ctl

# [1.42.0](https://github.com/psanders/mikro/compare/v1.41.1...v1.42.0) (2026-07-30)

**Note:** Version bump only for package @mikro/ctl

## [1.41.1](https://github.com/psanders/mikro/compare/v1.41.0...v1.41.1) (2026-07-23)

**Note:** Version bump only for package @mikro/ctl

# [1.41.0](https://github.com/psanders/mikro/compare/v1.40.2...v1.41.0) (2026-07-23)

### Features

- **reports:** replace single-month performance report with over-time "Desempeño en el Tiempo" ([#236](https://github.com/psanders/mikro/issues/236)) ([5687576](https://github.com/psanders/mikro/commit/5687576c2878ed58b884a3bb11ceaf76597bfa95))

## [1.40.2](https://github.com/psanders/mikro/compare/v1.40.1...v1.40.2) (2026-07-22)

**Note:** Version bump only for package @mikro/ctl

## [1.40.1](https://github.com/psanders/mikro/compare/v1.40.0...v1.40.1) (2026-07-20)

**Note:** Version bump only for package @mikro/ctl

# [1.40.0](https://github.com/psanders/mikro/compare/v1.39.8...v1.40.0) (2026-07-20)

**Note:** Version bump only for package @mikro/ctl

## [1.39.8](https://github.com/psanders/mikro/compare/v1.39.7...v1.39.8) (2026-07-17)

**Note:** Version bump only for package @mikro/ctl

## [1.39.7](https://github.com/psanders/mikro/compare/v1.39.6...v1.39.7) (2026-07-14)

**Note:** Version bump only for package @mikro/ctl

## [1.39.6](https://github.com/psanders/mikro/compare/v1.39.5...v1.39.6) (2026-07-12)

**Note:** Version bump only for package @mikro/ctl

## [1.39.5](https://github.com/psanders/mikro/compare/v1.39.4...v1.39.5) (2026-07-12)

**Note:** Version bump only for package @mikro/ctl

## [1.39.4](https://github.com/psanders/mikro/compare/v1.39.3...v1.39.4) (2026-07-11)

**Note:** Version bump only for package @mikro/ctl

## [1.39.3](https://github.com/psanders/mikro/compare/v1.39.2...v1.39.3) (2026-07-11)

**Note:** Version bump only for package @mikro/ctl

## [1.39.2](https://github.com/psanders/mikro/compare/v1.39.1...v1.39.2) (2026-07-11)

### Bug Fixes

- **ctl:** add missing lib/dates.ts ([#212](https://github.com/psanders/mikro/issues/212)) ([207fa5f](https://github.com/psanders/mikro/commit/207fa5ff0002777dccf931759bc00422d9f696bd)), closes [#206](https://github.com/psanders/mikro/issues/206)

## [1.39.1](https://github.com/psanders/mikro/compare/v1.39.0...v1.39.1) (2026-07-11)

**Note:** Version bump only for package @mikro/ctl

# [1.39.0](https://github.com/psanders/mikro/compare/v1.38.0...v1.39.0) (2026-07-11)

**Note:** Version bump only for package @mikro/ctl

# [1.38.0](https://github.com/psanders/mikro/compare/v1.37.2...v1.38.0) (2026-07-11)

### Features

- **copilot:** move loan-statement generation from automation to on-demand tool ([#206](https://github.com/psanders/mikro/issues/206)) ([3661487](https://github.com/psanders/mikro/commit/3661487a569def5db49b93a6946e78dc5f0ae2bb)), closes [#201](https://github.com/psanders/mikro/issues/201) [#202](https://github.com/psanders/mikro/issues/202) [#201](https://github.com/psanders/mikro/issues/201) [#202](https://github.com/psanders/mikro/issues/202)

## [1.37.2](https://github.com/psanders/mikro/compare/v1.37.1...v1.37.2) (2026-07-11)

**Note:** Version bump only for package @mikro/ctl

## [1.37.1](https://github.com/psanders/mikro/compare/v1.37.0...v1.37.1) (2026-07-10)

**Note:** Version bump only for package @mikro/ctl

# [1.37.0](https://github.com/psanders/mikro/compare/v1.36.0...v1.37.0) (2026-07-10)

### Features

- **customers:** store customer documents independent of loan applications ([#197](https://github.com/psanders/mikro/issues/197)) ([dfa0397](https://github.com/psanders/mikro/commit/dfa0397f3198415a3612f26f8b82dbd6a588a0fd)), closes [#196](https://github.com/psanders/mikro/issues/196)

# [1.36.0](https://github.com/psanders/mikro/compare/v1.35.5...v1.36.0) (2026-07-10)

**Note:** Version bump only for package @mikro/ctl

## [1.35.5](https://github.com/psanders/mikro/compare/v1.35.4...v1.35.5) (2026-07-10)

**Note:** Version bump only for package @mikro/ctl

## [1.35.3](https://github.com/psanders/mikro/compare/v1.35.2...v1.35.3) (2026-07-09)

**Note:** Version bump only for package @mikro/ctl

## [1.35.2](https://github.com/psanders/mikro/compare/v1.35.1...v1.35.2) (2026-07-09)

**Note:** Version bump only for package @mikro/ctl

## [1.35.1](https://github.com/psanders/mikro/compare/v1.35.0...v1.35.1) (2026-07-09)

**Note:** Version bump only for package @mikro/ctl

# [1.35.0](https://github.com/psanders/mikro/compare/v1.34.1...v1.35.0) (2026-07-09)

**Note:** Version bump only for package @mikro/ctl

## [1.34.1](https://github.com/psanders/mikro/compare/v1.34.0...v1.34.1) (2026-07-08)

**Note:** Version bump only for package @mikro/ctl

# [1.34.0](https://github.com/psanders/mikro/compare/v1.33.1...v1.34.0) (2026-07-08)

**Note:** Version bump only for package @mikro/ctl

## [1.33.1](https://github.com/psanders/mikro/compare/v1.33.0...v1.33.1) (2026-07-08)

**Note:** Version bump only for package @mikro/ctl

# [1.33.0](https://github.com/psanders/mikro/compare/v1.32.0...v1.33.0) (2026-07-07)

**Note:** Version bump only for package @mikro/ctl

# [1.32.0](https://github.com/psanders/mikro/compare/v1.31.0...v1.32.0) (2026-07-07)

**Note:** Version bump only for package @mikro/ctl

# [1.31.0](https://github.com/psanders/mikro/compare/v1.30.0...v1.31.0) (2026-07-07)

**Note:** Version bump only for package @mikro/ctl

# [1.30.0](https://github.com/psanders/mikro/compare/v1.29.0...v1.30.0) (2026-07-07)

**Note:** Version bump only for package @mikro/ctl

# [1.29.0](https://github.com/psanders/mikro/compare/v1.28.0...v1.29.0) (2026-07-07)

**Note:** Version bump only for package @mikro/ctl

# [1.28.0](https://github.com/psanders/mikro/compare/v1.27.0...v1.28.0) (2026-07-07)

**Note:** Version bump only for package @mikro/ctl

# [1.27.0](https://github.com/psanders/mikro/compare/v1.26.0...v1.27.0) (2026-07-07)

**Note:** Version bump only for package @mikro/ctl

# [1.26.0](https://github.com/psanders/mikro/compare/v1.25.1...v1.26.0) (2026-07-07)

### Features

- collections evaluation framework (canonical snapshot + spec-as-code checks) ([1a8b9c7](https://github.com/psanders/mikro/commit/1a8b9c743c6a6b10fe2184003e15b691cb0eb84b)), closes [#10034](https://github.com/psanders/mikro/issues/10034) [#138](https://github.com/psanders/mikro/issues/138) [#138](https://github.com/psanders/mikro/issues/138)

## [1.25.1](https://github.com/psanders/mikro/compare/v1.25.0...v1.25.1) (2026-07-06)

**Note:** Version bump only for package @mikro/ctl

# [1.25.0](https://github.com/psanders/mikro/compare/v1.24.1...v1.25.0) (2026-07-06)

**Note:** Version bump only for package @mikro/ctl

## [1.24.1](https://github.com/psanders/mikro/compare/v1.24.0...v1.24.1) (2026-07-06)

**Note:** Version bump only for package @mikro/ctl

# [1.24.0](https://github.com/psanders/mikro/compare/v1.23.0...v1.24.0) (2026-07-06)

**Note:** Version bump only for package @mikro/ctl

# [1.23.0](https://github.com/psanders/mikro/compare/v1.22.6...v1.23.0) (2026-07-06)

**Note:** Version bump only for package @mikro/ctl

## [1.22.6](https://github.com/psanders/mikro/compare/v1.22.5...v1.22.6) (2026-07-05)

**Note:** Version bump only for package @mikro/ctl

## [1.22.5](https://github.com/psanders/mikro/compare/v1.22.4...v1.22.5) (2026-07-05)

**Note:** Version bump only for package @mikro/ctl

## [1.22.4](https://github.com/psanders/mikro/compare/v1.22.3...v1.22.4) (2026-07-05)

**Note:** Version bump only for package @mikro/ctl

## [1.22.3](https://github.com/psanders/mikro/compare/v1.22.2...v1.22.3) (2026-07-05)

**Note:** Version bump only for package @mikro/ctl

## [1.22.2](https://github.com/psanders/mikro/compare/v1.22.1...v1.22.2) (2026-07-05)

**Note:** Version bump only for package @mikro/ctl

## [1.22.1](https://github.com/psanders/mikro/compare/v1.22.0...v1.22.1) (2026-07-05)

**Note:** Version bump only for package @mikro/ctl

# [1.22.0](https://github.com/psanders/mikro/compare/v1.21.2...v1.22.0) (2026-07-04)

**Note:** Version bump only for package @mikro/ctl

## [1.21.2](https://github.com/psanders/mikro/compare/v1.21.1...v1.21.2) (2026-07-04)

**Note:** Version bump only for package @mikro/ctl

## [1.21.1](https://github.com/psanders/mikro/compare/v1.21.0...v1.21.1) (2026-07-04)

**Note:** Version bump only for package @mikro/ctl

# [1.21.0](https://github.com/psanders/mikro/compare/v1.20.1...v1.21.0) (2026-07-04)

**Note:** Version bump only for package @mikro/ctl

## [1.20.1](https://github.com/psanders/mikro/compare/v1.20.0...v1.20.1) (2026-07-03)

**Note:** Version bump only for package @mikro/ctl

# [1.20.0](https://github.com/psanders/mikro/compare/v1.19.3...v1.20.0) (2026-07-03)

**Note:** Version bump only for package @mikro/ctl

## [1.19.3](https://github.com/psanders/mikro/compare/v1.19.2...v1.19.3) (2026-07-03)

**Note:** Version bump only for package @mikro/ctl

## [1.19.2](https://github.com/psanders/mikro/compare/v1.19.1...v1.19.2) (2026-07-03)

**Note:** Version bump only for package @mikro/ctl

## [1.19.1](https://github.com/psanders/mikro/compare/v1.19.0...v1.19.1) (2026-07-03)

**Note:** Version bump only for package @mikro/ctl

# [1.19.0](https://github.com/psanders/mikro/compare/v1.18.0...v1.19.0) (2026-07-03)

### Bug Fixes

- **ctl:** drop --send-promo from applications:create ([f6e18fc](https://github.com/psanders/mikro/commit/f6e18fca320c7c7d8cc03fc805b251ccbc15474c))

### Features

- **ctl:** applications:list/get/create/update/claim/approve/reject/reopen/delete ([05a60f7](https://github.com/psanders/mikro/commit/05a60f7bc0095300c349120908b792a1316afd27)), closes [#44](https://github.com/psanders/mikro/issues/44)
- **ctl:** reframe applications:claim as applications:assign ([d672dd8](https://github.com/psanders/mikro/commit/d672dd8fd1b696998250b4b7823f7f7cd0a4b680))

# [1.18.0](https://github.com/psanders/mikro/compare/v1.17.1...v1.18.0) (2026-07-03)

**Note:** Version bump only for package @mikro/ctl

## [1.17.1](https://github.com/psanders/mikro/compare/v1.17.0...v1.17.1) (2026-07-03)

**Note:** Version bump only for package @mikro/ctl

# [1.17.0](https://github.com/psanders/mikro/compare/v1.16.1...v1.17.0) (2026-07-02)

**Note:** Version bump only for package @mikro/ctl

## [1.16.1](https://github.com/psanders/mikro/compare/v1.16.0...v1.16.1) (2026-07-01)

**Note:** Version bump only for package @mikro/ctl

# [1.16.0](https://github.com/psanders/mikro/compare/v1.15.0...v1.16.0) (2026-07-01)

### Features

- **qcobro:** Mikro <-> QCobro collections integration ([#56](https://github.com/psanders/mikro/issues/56)) ([800ee5d](https://github.com/psanders/mikro/commit/800ee5da738aa0813c9e1bba1cbacf0ab1a7d331)), closes [psanders/mikro#55](https://github.com/psanders/mikro/issues/55)

# [1.15.0](https://github.com/psanders/mikro/compare/v1.14.3...v1.15.0) (2026-06-28)

**Note:** Version bump only for package @mikro/ctl

## [1.14.3](https://github.com/psanders/mikro/compare/v1.14.2...v1.14.3) (2026-06-23)

**Note:** Version bump only for package @mikro/ctl

## [1.14.2](https://github.com/psanders/mikro/compare/v1.14.1...v1.14.2) (2026-06-23)

**Note:** Version bump only for package @mikro/ctl

## [1.14.1](https://github.com/psanders/mikro/compare/v1.14.0...v1.14.1) (2026-06-23)

**Note:** Version bump only for package @mikro/ctl

# [1.14.0](https://github.com/psanders/mikro/compare/v1.13.1...v1.14.0) (2026-06-22)

### Features

- **ctl:** add applications:sendPromo command + whatsapp template smoke-test ([2d61127](https://github.com/psanders/mikro/commit/2d61127d7902bd01d1318d40f92372318f8de1da))

## [1.13.1](https://github.com/psanders/mikro/compare/v1.13.0...v1.13.1) (2026-06-21)

**Note:** Version bump only for package @mikro/ctl

# [1.13.0](https://github.com/psanders/mikro/compare/v1.12.0...v1.13.0) (2026-06-21)

**Note:** Version bump only for package @mikro/ctl

# [1.12.0](https://github.com/psanders/mikro/compare/v1.11.0...v1.12.0) (2026-06-21)

**Note:** Version bump only for package @mikro/ctl

# [1.11.0](https://github.com/psanders/mikro/compare/v1.10.2...v1.11.0) (2026-06-21)

**Note:** Version bump only for package @mikro/ctl

## [1.10.2](https://github.com/psanders/mikro/compare/v1.10.1...v1.10.2) (2026-06-20)

**Note:** Version bump only for package @mikro/ctl

## [1.10.1](https://github.com/psanders/mikro/compare/v1.10.0...v1.10.1) (2026-06-20)

**Note:** Version bump only for package @mikro/ctl

# [1.10.0](https://github.com/psanders/mikro/compare/v1.9.3...v1.10.0) (2026-06-20)

**Note:** Version bump only for package @mikro/ctl

## [1.9.3](https://github.com/psanders/mikro/compare/v1.9.2...v1.9.3) (2026-06-20)

**Note:** Version bump only for package @mikro/ctl

## [1.9.1](https://github.com/psanders/mikro/compare/v1.9.0...v1.9.1) (2026-06-19)

**Note:** Version bump only for package @mikro/ctl

# [1.9.0](https://github.com/psanders/mikro/compare/v1.8.0...v1.9.0) (2026-06-18)

**Note:** Version bump only for package @mikro/ctl

# [1.8.0](https://github.com/psanders/mikro/compare/v1.7.1...v1.8.0) (2026-06-13)

**Note:** Version bump only for package @mikro/ctl

## [1.7.1](https://github.com/psanders/mikro/compare/v1.7.0...v1.7.1) (2026-06-13)

**Note:** Version bump only for package @mikro/ctl

# [1.7.0](https://github.com/psanders/mikro/compare/v1.6.1...v1.7.0) (2026-06-13)

**Note:** Version bump only for package @mikro/ctl

## [1.6.1](https://github.com/psanders/mikro/compare/v1.6.0...v1.6.1) (2026-06-13)

**Note:** Version bump only for package @mikro/ctl

# [1.6.0](https://github.com/psanders/mikro/compare/v1.5.0...v1.6.0) (2026-06-13)

**Note:** Version bump only for package @mikro/ctl

# [1.5.0](https://github.com/psanders/mikro/compare/v1.4.1...v1.5.0) (2026-06-11)

**Note:** Version bump only for package @mikro/ctl

## [1.4.1](https://github.com/psanders/mikro/compare/v1.4.0...v1.4.1) (2026-06-11)

**Note:** Version bump only for package @mikro/ctl

# [1.4.0](https://github.com/psanders/mikro/compare/v1.3.0...v1.4.0) (2026-06-10)

**Note:** Version bump only for package @mikro/ctl

# [1.3.0](https://github.com/psanders/mikro/compare/v1.2.4...v1.3.0) (2026-06-09)

**Note:** Version bump only for package @mikro/ctl

## [1.2.4](https://github.com/psanders/mikro/compare/v1.2.3...v1.2.4) (2026-06-09)

**Note:** Version bump only for package @mikro/ctl

## [1.2.3](https://github.com/psanders/mikro/compare/v1.2.2...v1.2.3) (2026-06-08)

**Note:** Version bump only for package @mikro/ctl

## [1.2.2](https://github.com/psanders/mikro/compare/v1.2.1...v1.2.2) (2026-06-08)

**Note:** Version bump only for package @mikro/ctl

## [1.2.1](https://github.com/psanders/mikro/compare/v1.2.0...v1.2.1) (2026-06-08)

**Note:** Version bump only for package @mikro/ctl

# [1.2.0](https://github.com/psanders/mikro/compare/v1.1.3...v1.2.0) (2026-06-08)

**Note:** Version bump only for package @mikro/ctl

## [1.1.3](https://github.com/psanders/mikro/compare/v1.1.2...v1.1.3) (2026-06-06)

**Note:** Version bump only for package @mikro/ctl

## [1.1.2](https://github.com/psanders/mikro/compare/v1.1.1...v1.1.2) (2026-06-01)

**Note:** Version bump only for package @mikro/ctl

## [1.1.1](https://github.com/psanders/mikro/compare/v1.1.0...v1.1.1) (2026-06-01)

**Note:** Version bump only for package @mikro/ctl
