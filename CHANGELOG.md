# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [1.4.0](https://github.com/psanders/mikro/compare/v1.3.0...v1.4.0) (2026-06-10)

### Bug Fixes

- **db:** restore customers.nickname dropped by remove_referrer migration ([d1ce606](https://github.com/psanders/mikro/commit/d1ce606e8a896b95df8294d0bd0716394a612ba0))

### Features

- add biz model calculator and loan application printing ([51e8942](https://github.com/psanders/mikro/commit/51e8942eb23b65a44dd8c3fdf2c67efbfbcf9cd6))

# [1.3.0](https://github.com/psanders/mikro/compare/v1.2.4...v1.3.0) (2026-06-09)

### Bug Fixes

- **apiserver:** stop baking a stray mikro.db into the image; pin db path ([1fb1569](https://github.com/psanders/mikro/commit/1fb15698d9a37fb9078834a271e43914460fe467))
- **dashboard:** draft visibility + edit-form placeholders ([1695ccd](https://github.com/psanders/mikro/commit/1695ccda098fd499ff412fd05737447cc62b334e))
- restore nested site react/react-dom in lock for npm ci ([29fa569](https://github.com/psanders/mikro/commit/29fa569fa7e2c7bc82b2c2862212c9fdfc7aa525))
- sync package-lock with pdfkit deps for contract generation ([e93da74](https://github.com/psanders/mikro/commit/e93da743be354ee679abeff37a4156e963b9e677))

### Features

- **applications:** manual purge (hard delete) of abandoned solicitudes ([595d6f5](https://github.com/psanders/mikro/commit/595d6f59637a8b4ac9a13e956656e5a172d40864))
- **applications:** promote a completed DRAFT to RECEIVED ([e275d0b](https://github.com/psanders/mikro/commit/e275d0bbb76b4b3fd1206b8689954ea7f01c70c0))
- **applications:** static cédula front/back image uploads ([9dc44c8](https://github.com/psanders/mikro/commit/9dc44c875145f090fb21866dcaecd97a68494e37))
- **dashboard:** solicitud detail polish — documents, labels, validation ([2456395](https://github.com/psanders/mikro/commit/2456395b09ed905416abe3260c6ad3c18b340845))
- post-approval loan contract PDF generation ([76d1ed2](https://github.com/psanders/mikro/commit/76d1ed269a1977c9796359b55d5fa31a20d2bebd))

## [1.2.4](https://github.com/psanders/mikro/compare/v1.2.3...v1.2.4) (2026-06-09)

### Bug Fixes

- **ci:** green site deploy + point intake at the apiserver ([e50b26a](https://github.com/psanders/mikro/commit/e50b26a0d1702f30ab6205b0cce60691b30298ef))

### Features

- **dashboard:** solicitud list/detail refinements (OpenSpec tasks 1-3) ([98b4f38](https://github.com/psanders/mikro/commit/98b4f385732941c4277cb7a4fe3ff08e1c0d7880))

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
- **deps:** regenerate lockfile to sync site react/react-dom ([4467993](https://github.com/psanders/mikro/commit/44679934b3357c43f179f15b60ca149fd6e20254))

### Features

- **apiserver:** loan application pipeline; remove referrer endpoints ([d0848b4](https://github.com/psanders/mikro/commit/d0848b45f9289ea0662b3bce0081311ce6161a9d))
- **common:** loan application schemas, scoring, and types; drop referrer ([30934ea](https://github.com/psanders/mikro/commit/30934eac0c98056b187f137d005ae486e8394770))
- **dashboard:** ops dashboard with v2 design system ([4aea486](https://github.com/psanders/mikro/commit/4aea48669414a0474ac14a28964f63a6c1650a78))

## [1.1.3](https://github.com/psanders/mikro/compare/v1.1.2...v1.1.3) (2026-06-06)

### Bug Fixes

- block duplicate collector payments within 5 minutes ([800289d](https://github.com/psanders/mikro/commit/800289d554d55416c0f54c8d80da6f1ce7e93a15))
- clarify Cuadre/dashboard counts and money breakdown ([0ce3028](https://github.com/psanders/mikro/commit/0ce302846b4a00a30b31a825e614d1d1f247aa91))
- handle expired sessions gracefully and extend token to 30 days ([6edf0a1](https://github.com/psanders/mikro/commit/6edf0a1b5f3858099a44295ce7415fa5f80ca828))
- **mobile:** reflect collected payments in local screens immediately ([9bc2ec5](https://github.com/psanders/mikro/commit/9bc2ec524e92d8931f72eb19d7f9360c859bb86a))

## [1.1.2](https://github.com/psanders/mikro/compare/v1.1.1...v1.1.2) (2026-06-01)

### Bug Fixes

- **apiserver:** bump Docker runtime to node:22-alpine ([d2851d3](https://github.com/psanders/mikro/commit/d2851d30277536a8be1dc7b253291db95246c9e2))

## [1.1.1](https://github.com/psanders/mikro/compare/v1.1.0...v1.1.1) (2026-06-01)

**Note:** Version bump only for package mikro
