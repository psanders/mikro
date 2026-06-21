# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [1.13.0](https://github.com/psanders/mikro/compare/v1.12.0...v1.13.0) (2026-06-21)

### Features

- **apiserver:** add automated loan application follow-up timer system ([a59b47f](https://github.com/psanders/mikro/commit/a59b47f58b2e69a97de28fb0a749278668fcb195))
- **whatsapp:** payment-confirmation template + configurable timers + single language ([1fd16eb](https://github.com/psanders/mikro/commit/1fd16ebd835f101926f2a086dac436b45a8dbd1a))

# [1.12.0](https://github.com/psanders/mikro/compare/v1.11.0...v1.12.0) (2026-06-21)

### Features

- **agents:** add collector photo-prospecting WhatsApp agent ([b62dd04](https://github.com/psanders/mikro/commit/b62dd044bff420bee383c2ce88768d3a60d4cf47))

# [1.11.0](https://github.com/psanders/mikro/compare/v1.10.2...v1.11.0) (2026-06-21)

### Features

- **agents:** short-form José intake with opt-out and ABANDONED status ([5bb0ab1](https://github.com/psanders/mikro/commit/5bb0ab1329cb703159a93aa1728b21affedce5d2))

## [1.10.2](https://github.com/psanders/mikro/compare/v1.10.1...v1.10.2) (2026-06-20)

**Note:** Version bump only for package @mikro/apiserver

## [1.10.1](https://github.com/psanders/mikro/compare/v1.10.0...v1.10.1) (2026-06-20)

**Note:** Version bump only for package @mikro/apiserver

# [1.10.0](https://github.com/psanders/mikro/compare/v1.9.3...v1.10.0) (2026-06-20)

### Features

- **agents:** externalize agents to YAML, route by profile ([23e23a4](https://github.com/psanders/mikro/commit/23e23a4cb2a3075491c9ffe6c2928560c01ea4c6))

## [1.9.3](https://github.com/psanders/mikro/compare/v1.9.2...v1.9.3) (2026-06-20)

**Note:** Version bump only for package @mikro/apiserver

## [1.9.1](https://github.com/psanders/mikro/compare/v1.9.0...v1.9.1) (2026-06-19)

### Bug Fixes

- **apiserver:** promote promo-sent log to info to surface messageId ([a1849d8](https://github.com/psanders/mikro/commit/a1849d87d03aefeec1089a516cf04949834154ef))

# [1.9.0](https://github.com/psanders/mikro/compare/v1.8.0...v1.9.0) (2026-06-18)

### Features

- **dashboard:** add Send Promo shortcut in Inicio header ([4e8f43e](https://github.com/psanders/mikro/commit/4e8f43e81796bfbdc811adf5629141750a13ceb2))

# [1.8.0](https://github.com/psanders/mikro/compare/v1.7.1...v1.8.0) (2026-06-13)

### Features

- **whatsapp:** retire inbound intake greeting; no auto-response to unknowns ([#34](https://github.com/psanders/mikro/issues/34)) ([4082eb8](https://github.com/psanders/mikro/commit/4082eb8ee703bc77a5a7abfe1c4547e87874f39f))

## [1.7.1](https://github.com/psanders/mikro/compare/v1.7.0...v1.7.1) (2026-06-13)

### Bug Fixes

- **solicitudes:** match loan_application template format for promo send ([#30](https://github.com/psanders/mikro/issues/30)) ([99dacdf](https://github.com/psanders/mikro/commit/99dacdfc927c11a82384c2f94e9c191384e8800f))

# [1.7.0](https://github.com/psanders/mikro/compare/v1.6.1...v1.7.0) (2026-06-13)

### Features

- **solicitudes:** send WhatsApp promo on manual application creation ([#29](https://github.com/psanders/mikro/issues/29)) ([2fc969e](https://github.com/psanders/mikro/commit/2fc969e294486cd0b58fd6ab9e7272509b6ceab1))

## [1.6.1](https://github.com/psanders/mikro/compare/v1.6.0...v1.6.1) (2026-06-13)

### Bug Fixes

- **docker:** use prebuild-install for better-sqlite3 to avoid QEMU SIGILL ([2932a4c](https://github.com/psanders/mikro/commit/2932a4cd1d61209343383b29378694feeda9c325))

# [1.6.0](https://github.com/psanders/mikro/compare/v1.5.0...v1.6.0) (2026-06-13)

### Bug Fixes

- **contracts:** move legal-entity data to mikro.json; drop cedula assets ([e8045b8](https://github.com/psanders/mikro/commit/e8045b82baa7dd4400de8b5665a5237215de6e64))
- **contracts:** render human-readable labels in loan contract PDF ([0496473](https://github.com/psanders/mikro/commit/049647394cd9da53f1a78c1b5228f0b61adfba44))

### Features

- **dashboard:** export the business-model projection as a branded PDF ([eeb84b4](https://github.com/psanders/mikro/commit/eeb84b40cb45495dd9bbb7f0bf6f4ab3eb884404))
- **solicitudes:** manually create loan applications from the dashboard ([d59068e](https://github.com/psanders/mikro/commit/d59068e87b127d9e2a3d3401c4d6136cb7d98d74))

# [1.5.0](https://github.com/psanders/mikro/compare/v1.4.1...v1.5.0) (2026-06-11)

### Bug Fixes

- **whatsapp:** shorten Flow labels (<=20) and option titles (<=30) ([2a8b257](https://github.com/psanders/mikro/commit/2a8b25707f93031c7b87753b55b9f569e781ee84))

### Features

- **apiserver:** report running version in /health ([e235bed](https://github.com/psanders/mikro/commit/e235bedcec0373d971913b1b36f3f692cb2eabf6))
- **whatsapp:** prospect loan-application intake via native Flow form ([57133c1](https://github.com/psanders/mikro/commit/57133c1bfd222061e6b54c4bd4652387e1cd4e39))

## [1.4.1](https://github.com/psanders/mikro/compare/v1.4.0...v1.4.1) (2026-06-11)

### Bug Fixes

- **scoring:** score empty answers as 0 and align business-risk map with policy PDF ([f15e6ef](https://github.com/psanders/mikro/commit/f15e6ef170b269f404a186b980b1a2d3865f09d1))

# [1.4.0](https://github.com/psanders/mikro/compare/v1.3.0...v1.4.0) (2026-06-10)

### Bug Fixes

- **db:** restore customers.nickname dropped by remove_referrer migration ([d1ce606](https://github.com/psanders/mikro/commit/d1ce606e8a896b95df8294d0bd0716394a612ba0))

### Features

- add biz model calculator and loan application printing ([51e8942](https://github.com/psanders/mikro/commit/51e8942eb23b65a44dd8c3fdf2c67efbfbcf9cd6))

# [1.3.0](https://github.com/psanders/mikro/compare/v1.2.4...v1.3.0) (2026-06-09)

### Bug Fixes

- **apiserver:** stop baking a stray mikro.db into the image; pin db path ([1fb1569](https://github.com/psanders/mikro/commit/1fb15698d9a37fb9078834a271e43914460fe467))

### Features

- **applications:** manual purge (hard delete) of abandoned solicitudes ([595d6f5](https://github.com/psanders/mikro/commit/595d6f59637a8b4ac9a13e956656e5a172d40864))
- **applications:** promote a completed DRAFT to RECEIVED ([e275d0b](https://github.com/psanders/mikro/commit/e275d0bbb76b4b3fd1206b8689954ea7f01c70c0))
- **applications:** static cédula front/back image uploads ([9dc44c8](https://github.com/psanders/mikro/commit/9dc44c875145f090fb21866dcaecd97a68494e37))
- post-approval loan contract PDF generation ([76d1ed2](https://github.com/psanders/mikro/commit/76d1ed269a1977c9796359b55d5fa31a20d2bebd))

## [1.2.4](https://github.com/psanders/mikro/compare/v1.2.3...v1.2.4) (2026-06-09)

**Note:** Version bump only for package @mikro/apiserver

## [1.2.3](https://github.com/psanders/mikro/compare/v1.2.2...v1.2.3) (2026-06-08)

### Bug Fixes

- **apiserver:** install sharp musl binary in the Docker image too ([9c68ae6](https://github.com/psanders/mikro/commit/9c68ae6357752452d6d33ac1b767f86c2689b274))

## [1.2.2](https://github.com/psanders/mikro/compare/v1.2.1...v1.2.2) (2026-06-08)

### Bug Fixes

- **apiserver:** install resvg musl binary in the Docker image ([cc28d97](https://github.com/psanders/mikro/commit/cc28d97d3e106c89329be74d02153f47fa3a85a6))

## [1.2.1](https://github.com/psanders/mikro/compare/v1.2.0...v1.2.1) (2026-06-08)

### Bug Fixes

- **apiserver:** decouple prisma.config from @mikro/common barrel ([a6ad84d](https://github.com/psanders/mikro/commit/a6ad84d2833cc01ebbb6ea04b7380d471c3fc78c))

# [1.2.0](https://github.com/psanders/mikro/compare/v1.1.3...v1.2.0) (2026-06-08)

### Bug Fixes

- **apiserver:** seed users/customers with valid E.164 phones ([437bd3e](https://github.com/psanders/mikro/commit/437bd3e8642b37a003acd89efb92c170dae4ff24))

### Features

- **apiserver:** loan application pipeline; remove referrer endpoints ([d0848b4](https://github.com/psanders/mikro/commit/d0848b45f9289ea0662b3bce0081311ce6161a9d))

## [1.1.3](https://github.com/psanders/mikro/compare/v1.1.2...v1.1.3) (2026-06-06)

### Bug Fixes

- block duplicate collector payments within 5 minutes ([800289d](https://github.com/psanders/mikro/commit/800289d554d55416c0f54c8d80da6f1ce7e93a15))
- clarify Cuadre/dashboard counts and money breakdown ([0ce3028](https://github.com/psanders/mikro/commit/0ce302846b4a00a30b31a825e614d1d1f247aa91))

## [1.1.2](https://github.com/psanders/mikro/compare/v1.1.1...v1.1.2) (2026-06-01)

### Bug Fixes

- **apiserver:** bump Docker runtime to node:22-alpine ([d2851d3](https://github.com/psanders/mikro/commit/d2851d30277536a8be1dc7b253291db95246c9e2))

## [1.1.1](https://github.com/psanders/mikro/compare/v1.1.0...v1.1.1) (2026-06-01)

**Note:** Version bump only for package @mikro/apiserver
