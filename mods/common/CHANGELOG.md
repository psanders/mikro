# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [1.10.1](https://github.com/psanders/mikro/compare/v1.10.0...v1.10.1) (2026-06-20)

### Bug Fixes

- **agents:** per-agent replyMode, fix zone check, drop weekend boilerplate ([78e4874](https://github.com/psanders/mikro/commit/78e48747eb7cf489400b98ec6a0cb953e9cd5fbe))

# [1.10.0](https://github.com/psanders/mikro/compare/v1.9.3...v1.10.0) (2026-06-20)

### Features

- **agents:** externalize agents to YAML, route by profile ([23e23a4](https://github.com/psanders/mikro/commit/23e23a4cb2a3075491c9ffe6c2928560c01ea4c6))

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

# [1.6.0](https://github.com/psanders/mikro/compare/v1.5.0...v1.6.0) (2026-06-13)

### Bug Fixes

- **contracts:** move legal-entity data to mikro.json; drop cedula assets ([e8045b8](https://github.com/psanders/mikro/commit/e8045b82baa7dd4400de8b5665a5237215de6e64))

### Features

- **dashboard:** export the business-model projection as a branded PDF ([eeb84b4](https://github.com/psanders/mikro/commit/eeb84b40cb45495dd9bbb7f0bf6f4ab3eb884404))
- **solicitudes:** manually create loan applications from the dashboard ([d59068e](https://github.com/psanders/mikro/commit/d59068e87b127d9e2a3d3401c4d6136cb7d98d74))

# [1.5.0](https://github.com/psanders/mikro/compare/v1.4.1...v1.5.0) (2026-06-11)

### Features

- **whatsapp:** prospect loan-application intake via native Flow form ([57133c1](https://github.com/psanders/mikro/commit/57133c1bfd222061e6b54c4bd4652387e1cd4e39))
- **whatsapp:** support sending the intake Flow in draft mode ([57c5fe8](https://github.com/psanders/mikro/commit/57c5fe8e3af9b7fc6a344309f665d54007dd8f89))

## [1.4.1](https://github.com/psanders/mikro/compare/v1.4.0...v1.4.1) (2026-06-11)

### Bug Fixes

- **scoring:** score empty answers as 0 and align business-risk map with policy PDF ([f15e6ef](https://github.com/psanders/mikro/commit/f15e6ef170b269f404a186b980b1a2d3865f09d1))

# [1.4.0](https://github.com/psanders/mikro/compare/v1.3.0...v1.4.0) (2026-06-10)

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

# [1.2.0](https://github.com/psanders/mikro/compare/v1.1.3...v1.2.0) (2026-06-08)

### Features

- **common:** loan application schemas, scoring, and types; drop referrer ([30934ea](https://github.com/psanders/mikro/commit/30934eac0c98056b187f137d005ae486e8394770))

## [1.1.3](https://github.com/psanders/mikro/compare/v1.1.2...v1.1.3) (2026-06-06)

### Bug Fixes

- handle expired sessions gracefully and extend token to 30 days ([6edf0a1](https://github.com/psanders/mikro/commit/6edf0a1b5f3858099a44295ce7415fa5f80ca828))

## [1.1.1](https://github.com/psanders/mikro/compare/v1.1.0...v1.1.1) (2026-06-01)

**Note:** Version bump only for package @mikro/common
