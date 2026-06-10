# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

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
