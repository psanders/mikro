# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

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

**Note:** Version bump only for package @mikro/mobile

# [2.6.0](https://github.com/psanders/mikro/compare/v2.5.0...v2.6.0) (2026-09-22)

**Note:** Version bump only for package @mikro/mobile

# [2.5.0](https://github.com/psanders/mikro/compare/v2.4.0...v2.5.0) (2026-09-22)

**Note:** Version bump only for package @mikro/mobile

# [2.4.0](https://github.com/psanders/mikro/compare/v2.3.1...v2.4.0) (2026-09-22)

**Note:** Version bump only for package @mikro/mobile

## [2.3.1](https://github.com/psanders/mikro/compare/v2.3.0...v2.3.1) (2026-09-18)

**Note:** Version bump only for package @mikro/mobile

# [2.3.0](https://github.com/psanders/mikro/compare/v2.2.0...v2.3.0) (2026-09-18)

**Note:** Version bump only for package @mikro/mobile

# [2.2.0](https://github.com/psanders/mikro/compare/v2.1.1...v2.2.0) (2026-09-18)

### Features

- **reports:** attribute applications to their ad and report lead quality per ad ([#282](https://github.com/psanders/mikro/issues/282)) ([97c631f](https://github.com/psanders/mikro/commit/97c631f7856a96c09e9fab4be7bae062ef228ba6)), closes [#280](https://github.com/psanders/mikro/issues/280)

# [2.1.0](https://github.com/psanders/mikro/compare/v2.0.5...v2.1.0) (2026-09-17)

**Note:** Version bump only for package @mikro/mobile

## [2.0.5](https://github.com/psanders/mikro/compare/v2.0.4...v2.0.5) (2026-09-02)

**Note:** Version bump only for package @mikro/mobile

## [2.0.4](https://github.com/psanders/mikro/compare/v2.0.3...v2.0.4) (2026-08-05)

**Note:** Version bump only for package @mikro/mobile

## [2.0.3](https://github.com/psanders/mikro/compare/v2.0.2...v2.0.3) (2026-08-05)

**Note:** Version bump only for package @mikro/mobile

## [2.0.2](https://github.com/psanders/mikro/compare/v2.0.1...v2.0.2) (2026-08-05)

**Note:** Version bump only for package @mikro/mobile

## [2.0.1](https://github.com/psanders/mikro/compare/v2.0.0...v2.0.1) (2026-08-05)

**Note:** Version bump only for package @mikro/mobile

# [2.0.0](https://github.com/psanders/mikro/compare/v1.42.0...v2.0.0) (2026-08-05)

- Retire watch rules, reconcile payment-automation specs, and unblock `npm run lint` (#244) ([53bc914](https://github.com/psanders/mikro/commit/53bc914fa4412301078f592a714b17fbd8c044a8)), closes [#244](https://github.com/psanders/mikro/issues/244) [#224](https://github.com/psanders/mikro/issues/224) [#224](https://github.com/psanders/mikro/issues/224) [#163](https://github.com/psanders/mikro/issues/163) [#163](https://github.com/psanders/mikro/issues/163) [#163](https://github.com/psanders/mikro/issues/163) [#163](https://github.com/psanders/mikro/issues/163) [#224](https://github.com/psanders/mikro/issues/224) [#224](https://github.com/psanders/mikro/issues/224) [#224](https://github.com/psanders/mikro/issues/224) [#163](https://github.com/psanders/mikro/issues/163)

### BREAKING CHANGES

- the listWatchRules and setWatchRuleEnabled tRPC procedures
  are removed, and `rule.alert` is no longer a valid business event type.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

# [1.42.0](https://github.com/psanders/mikro/compare/v1.41.1...v1.42.0) (2026-07-30)

**Note:** Version bump only for package @mikro/mobile

## [1.41.1](https://github.com/psanders/mikro/compare/v1.41.0...v1.41.1) (2026-07-23)

**Note:** Version bump only for package @mikro/mobile

# [1.41.0](https://github.com/psanders/mikro/compare/v1.40.2...v1.41.0) (2026-07-23)

**Note:** Version bump only for package @mikro/mobile

## [1.40.2](https://github.com/psanders/mikro/compare/v1.40.1...v1.40.2) (2026-07-22)

**Note:** Version bump only for package @mikro/mobile

## [1.40.1](https://github.com/psanders/mikro/compare/v1.40.0...v1.40.1) (2026-07-20)

**Note:** Version bump only for package @mikro/mobile

# [1.40.0](https://github.com/psanders/mikro/compare/v1.39.8...v1.40.0) (2026-07-20)

**Note:** Version bump only for package @mikro/mobile

## [1.39.8](https://github.com/psanders/mikro/compare/v1.39.7...v1.39.8) (2026-07-17)

**Note:** Version bump only for package @mikro/mobile

## [1.39.7](https://github.com/psanders/mikro/compare/v1.39.6...v1.39.7) (2026-07-14)

**Note:** Version bump only for package @mikro/mobile

## [1.39.6](https://github.com/psanders/mikro/compare/v1.39.5...v1.39.6) (2026-07-12)

**Note:** Version bump only for package @mikro/mobile

## [1.39.5](https://github.com/psanders/mikro/compare/v1.39.4...v1.39.5) (2026-07-12)

**Note:** Version bump only for package @mikro/mobile

## [1.39.4](https://github.com/psanders/mikro/compare/v1.39.3...v1.39.4) (2026-07-11)

**Note:** Version bump only for package @mikro/mobile

## [1.39.3](https://github.com/psanders/mikro/compare/v1.39.2...v1.39.3) (2026-07-11)

**Note:** Version bump only for package @mikro/mobile

## [1.39.1](https://github.com/psanders/mikro/compare/v1.39.0...v1.39.1) (2026-07-11)

**Note:** Version bump only for package @mikro/mobile

# [1.39.0](https://github.com/psanders/mikro/compare/v1.38.0...v1.39.0) (2026-07-11)

**Note:** Version bump only for package @mikro/mobile

# [1.38.0](https://github.com/psanders/mikro/compare/v1.37.2...v1.38.0) (2026-07-11)

**Note:** Version bump only for package @mikro/mobile

## [1.37.2](https://github.com/psanders/mikro/compare/v1.37.1...v1.37.2) (2026-07-11)

**Note:** Version bump only for package @mikro/mobile

## [1.37.1](https://github.com/psanders/mikro/compare/v1.37.0...v1.37.1) (2026-07-10)

**Note:** Version bump only for package @mikro/mobile

# [1.37.0](https://github.com/psanders/mikro/compare/v1.36.0...v1.37.0) (2026-07-10)

**Note:** Version bump only for package @mikro/mobile

# [1.36.0](https://github.com/psanders/mikro/compare/v1.35.5...v1.36.0) (2026-07-10)

**Note:** Version bump only for package @mikro/mobile

## [1.35.5](https://github.com/psanders/mikro/compare/v1.35.4...v1.35.5) (2026-07-10)

**Note:** Version bump only for package @mikro/mobile

## [1.35.4](https://github.com/psanders/mikro/compare/v1.35.3...v1.35.4) (2026-07-09)

### Bug Fixes

- **mobile:** fold mobile into lerna's version lockstep for TestFlight ([#172](https://github.com/psanders/mikro/issues/172)) ([00f1398](https://github.com/psanders/mikro/commit/00f1398fe8fd91a0245d0079a6f4d758ad3d95ad)), closes [#170](https://github.com/psanders/mikro/issues/170)
