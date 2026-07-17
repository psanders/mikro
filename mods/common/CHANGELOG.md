# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [1.39.8](https://github.com/psanders/mikro/compare/v1.39.7...v1.39.8) (2026-07-17)

### Bug Fixes

- **reporting:** explain a grace-waived zero on the loan statement ([#221](https://github.com/psanders/mikro/issues/221)) ([24970fa](https://github.com/psanders/mikro/commit/24970fa245c4e63414dd3bc997217db5049319f3))

## [1.39.6](https://github.com/psanders/mikro/compare/v1.39.5...v1.39.6) (2026-07-12)

**Note:** Version bump only for package @mikro/common

# [1.39.0](https://github.com/psanders/mikro/compare/v1.38.0...v1.39.0) (2026-07-11)

### Features

- **reporting:** Pencil-fidelity report redesign, derived pagination, offline smoke tests ([#208](https://github.com/psanders/mikro/issues/208)) ([9f58d32](https://github.com/psanders/mikro/commit/9f58d32baec85bf5a6212487cfd41348734bd760)), closes [#202](https://github.com/psanders/mikro/issues/202) [#201](https://github.com/psanders/mikro/issues/201)

# [1.38.0](https://github.com/psanders/mikro/compare/v1.37.2...v1.38.0) (2026-07-11)

### Features

- **copilot:** move loan-statement generation from automation to on-demand tool ([#206](https://github.com/psanders/mikro/issues/206)) ([3661487](https://github.com/psanders/mikro/commit/3661487a569def5db49b93a6946e78dc5f0ae2bb)), closes [#201](https://github.com/psanders/mikro/issues/201) [#202](https://github.com/psanders/mikro/issues/202) [#201](https://github.com/psanders/mikro/issues/201) [#202](https://github.com/psanders/mikro/issues/202)

## [1.37.2](https://github.com/psanders/mikro/compare/v1.37.1...v1.37.2) (2026-07-11)

### Bug Fixes

- **founder:** loan/contract copilot cards, reports UX, Tauri download crash ([#199](https://github.com/psanders/mikro/issues/199)) ([90fdcd6](https://github.com/psanders/mikro/commit/90fdcd62c120ee8bf3fcddcc7ae4108a16fab870))

## [1.37.1](https://github.com/psanders/mikro/compare/v1.37.0...v1.37.1) (2026-07-10)

**Note:** Version bump only for package @mikro/common

# [1.37.0](https://github.com/psanders/mikro/compare/v1.36.0...v1.37.0) (2026-07-10)

### Features

- **customers:** store customer documents independent of loan applications ([#197](https://github.com/psanders/mikro/issues/197)) ([dfa0397](https://github.com/psanders/mikro/commit/dfa0397f3198415a3612f26f8b82dbd6a588a0fd)), closes [#196](https://github.com/psanders/mikro/issues/196)

# [1.36.0](https://github.com/psanders/mikro/compare/v1.35.5...v1.36.0) (2026-07-10)

### Features

- **copilot:** generate ad-hoc loan contracts from the founder copilot ([#196](https://github.com/psanders/mikro/issues/196)) ([1145d95](https://github.com/psanders/mikro/commit/1145d9531dd254a0bbf82fc64a0cb1c90c59e253)), closes [#110](https://github.com/psanders/mikro/issues/110) [#161](https://github.com/psanders/mikro/issues/161) [#161](https://github.com/psanders/mikro/issues/161) [#10036](https://github.com/psanders/mikro/issues/10036)

## [1.35.5](https://github.com/psanders/mikro/compare/v1.35.4...v1.35.5) (2026-07-10)

**Note:** Version bump only for package @mikro/common

## [1.35.3](https://github.com/psanders/mikro/compare/v1.35.2...v1.35.3) (2026-07-09)

### Bug Fixes

- issue [#156](https://github.com/psanders/mikro/issues/156) ([99b3fd8](https://github.com/psanders/mikro/commit/99b3fd86987bcfc4db4333b11c47b04d8d879b02))

## [1.35.2](https://github.com/psanders/mikro/compare/v1.35.1...v1.35.2) (2026-07-09)

**Note:** Version bump only for package @mikro/common

## [1.35.1](https://github.com/psanders/mikro/compare/v1.35.0...v1.35.1) (2026-07-09)

**Note:** Version bump only for package @mikro/common

# [1.35.0](https://github.com/psanders/mikro/compare/v1.34.1...v1.35.0) (2026-07-09)

### Features

- **tasks:** generalize pay-collector to a generic payment automation ([#163](https://github.com/psanders/mikro/issues/163)) ([b42355e](https://github.com/psanders/mikro/commit/b42355e7707f00d637e7a8497f31be8cf503ce20))

## [1.34.1](https://github.com/psanders/mikro/compare/v1.34.0...v1.34.1) (2026-07-08)

**Note:** Version bump only for package @mikro/common

# [1.34.0](https://github.com/psanders/mikro/compare/v1.33.1...v1.34.0) (2026-07-08)

### Features

- **loans:** auto-deduct disbursed principal from ledger on conversion ([c58fd15](https://github.com/psanders/mikro/commit/c58fd15e6c9f229853c98ecea18d472409d9962e)), closes [#155](https://github.com/psanders/mikro/issues/155)

# [1.28.0](https://github.com/psanders/mikro/compare/v1.27.0...v1.28.0) (2026-07-07)

### Features

- **whatsapp:** track delivery status and deliver templates outside the 24h window ([22ca3ab](https://github.com/psanders/mikro/commit/22ca3ab9222d47a06dcd3694fa41ab97b46c691b)), closes [#85](https://github.com/psanders/mikro/issues/85) [#121](https://github.com/psanders/mikro/issues/121)

# [1.27.0](https://github.com/psanders/mikro/compare/v1.26.0...v1.27.0) (2026-07-07)

### Features

- **eval:** add closed-loan-reconciled check, found from running the framework on real data ([fcb2ce5](https://github.com/psanders/mikro/commit/fcb2ce50ca0339cd20d676bc7f89049155587745)), closes [#10002](https://github.com/psanders/mikro/issues/10002)

# [1.26.0](https://github.com/psanders/mikro/compare/v1.25.1...v1.26.0) (2026-07-07)

### Bug Fixes

- count loan progress by money, not row status ([fa9f448](https://github.com/psanders/mikro/commit/fa9f448a9a726f05576cc7c6efff9ed36f986854))

### Features

- collections evaluation framework (canonical snapshot + spec-as-code checks) ([1a8b9c7](https://github.com/psanders/mikro/commit/1a8b9c743c6a6b10fe2184003e15b691cb0eb84b)), closes [#10034](https://github.com/psanders/mikro/issues/10034) [#138](https://github.com/psanders/mikro/issues/138) [#138](https://github.com/psanders/mikro/issues/138)

## [1.25.1](https://github.com/psanders/mikro/compare/v1.25.0...v1.25.1) (2026-07-06)

### Bug Fixes

- **dashboard:** replace em-dash placeholder example with generic names ([28855c1](https://github.com/psanders/mikro/commit/28855c1a6b83ab27c4ca5762895a26a79ed3c7a1))

# [1.25.0](https://github.com/psanders/mikro/compare/v1.24.1...v1.25.0) (2026-07-06)

### Features

- **apiserver:** show daily QCobro sync on the founder feed ([#127](https://github.com/psanders/mikro/issues/127)) ([2ec1048](https://github.com/psanders/mikro/commit/2ec10483f432dded9f9eb1d5e67ed1bb446fd6c4)), closes [#124](https://github.com/psanders/mikro/issues/124)

## [1.24.1](https://github.com/psanders/mikro/compare/v1.24.0...v1.24.1) (2026-07-06)

**Note:** Version bump only for package @mikro/common

# [1.24.0](https://github.com/psanders/mikro/compare/v1.23.0...v1.24.0) (2026-07-06)

### Features

- **tasks:** Task/TaskFiring models + task.\* event and task contracts ([1d68f16](https://github.com/psanders/mikro/commit/1d68f1694157f71acb57378a1d1de053856f9fec))

## [1.22.6](https://github.com/psanders/mikro/compare/v1.22.5...v1.22.6) (2026-07-05)

**Note:** Version bump only for package @mikro/common

## [1.22.5](https://github.com/psanders/mikro/compare/v1.22.4...v1.22.5) (2026-07-05)

**Note:** Version bump only for package @mikro/common

## [1.22.4](https://github.com/psanders/mikro/compare/v1.22.3...v1.22.4) (2026-07-05)

### Bug Fixes

- **bug-report:** retry transient submit failures and always show Spanish errors ([c0d5479](https://github.com/psanders/mikro/commit/c0d547955ddba7733403372330431d28d7054ea1)), closes [mikro/#97](https://github.com/psanders/mikro/issues/97)

## [1.22.3](https://github.com/psanders/mikro/compare/v1.22.2...v1.22.3) (2026-07-05)

**Note:** Version bump only for package @mikro/common

## [1.22.1](https://github.com/psanders/mikro/compare/v1.22.0...v1.22.1) (2026-07-05)

**Note:** Version bump only for package @mikro/common

# [1.22.0](https://github.com/psanders/mikro/compare/v1.21.2...v1.22.0) (2026-07-04)

### Features

- **copilot:** add soft-delete clear-history control to the founder dock ([4129735](https://github.com/psanders/mikro/commit/412973548a54143960eb918e43fba26df834674e))

## [1.21.2](https://github.com/psanders/mikro/compare/v1.21.1...v1.21.2) (2026-07-04)

**Note:** Version bump only for package @mikro/common

## [1.21.1](https://github.com/psanders/mikro/compare/v1.21.0...v1.21.1) (2026-07-04)

**Note:** Version bump only for package @mikro/common

# [1.21.0](https://github.com/psanders/mikro/compare/v1.20.1...v1.21.0) (2026-07-04)

### Bug Fixes

- **apiserver,common,mobile,agents:** require assigned collector for every customer ([7b96568](https://github.com/psanders/mikro/commit/7b965681e27dd9ff0468332f85afc4c95bc99b27)), closes [#41](https://github.com/psanders/mikro/issues/41)
- **dashboard,mobile,apiserver:** drop screenshot in favor of video, pin GitHub API version ([b23e8c1](https://github.com/psanders/mikro/commit/b23e8c1cbf739b2b3eee0c061f422d94d186de31))

### Features

- **dashboard,mobile,apiserver:** real video capture, floating pill parity, and no-link result copy for bug reports ([e9ff1c5](https://github.com/psanders/mikro/commit/e9ff1c5b08db7beee4e883e3f363dfce079675a4)), closes [mikro#87](https://github.com/mikro/issues/87)

## [1.20.1](https://github.com/psanders/mikro/compare/v1.20.0...v1.20.1) (2026-07-03)

**Note:** Version bump only for package @mikro/common

## [1.19.3](https://github.com/psanders/mikro/compare/v1.19.2...v1.19.3) (2026-07-03)

### Reverts

- **mobile:** remove Activity/history feature from reviewer app ([#67](https://github.com/psanders/mikro/issues/67)) ([8e1eae8](https://github.com/psanders/mikro/commit/8e1eae8c3f983da95e907fbc008e1750d334eaaa)), closes [#75](https://github.com/psanders/mikro/issues/75)

## [1.19.2](https://github.com/psanders/mikro/compare/v1.19.1...v1.19.2) (2026-07-03)

**Note:** Version bump only for package @mikro/common

## [1.19.1](https://github.com/psanders/mikro/compare/v1.19.0...v1.19.1) (2026-07-03)

**Note:** Version bump only for package @mikro/common

# [1.19.0](https://github.com/psanders/mikro/compare/v1.18.0...v1.19.0) (2026-07-03)

### Features

- **ctl:** reframe applications:claim as applications:assign ([d672dd8](https://github.com/psanders/mikro/commit/d672dd8fd1b696998250b4b7823f7f7cd0a4b680))

# [1.18.0](https://github.com/psanders/mikro/compare/v1.17.1...v1.18.0) (2026-07-03)

### Features

- **dashboard,apiserver:** in-app bug report — record, transcribe, file issue ([f595df1](https://github.com/psanders/mikro/commit/f595df19fd74ccb2e9a059681b71d72e67cad0f8)), closes [#69](https://github.com/psanders/mikro/issues/69)
- **mobile,apiserver:** add reviewer-scoped activity history to Datos ([403fe5a](https://github.com/psanders/mikro/commit/403fe5a163da0e0da836485032c9c6f74a962502)), closes [#67](https://github.com/psanders/mikro/issues/67) [#73](https://github.com/psanders/mikro/issues/73) [#67](https://github.com/psanders/mikro/issues/67)

# [1.17.0](https://github.com/psanders/mikro/compare/v1.16.1...v1.17.0) (2026-07-02)

### Features

- **founder:** business event log + Pencil-faithful founder feed app ([c279c21](https://github.com/psanders/mikro/commit/c279c214b88b49af1a2ed6cc06310159db078576))
- **founder:** copilot dock with confirm-first writes and watch rules ([7aeddfb](https://github.com/psanders/mikro/commit/7aeddfbed848fd13bbe6d17fe8a04116ffde65c5))

# [1.16.0](https://github.com/psanders/mikro/compare/v1.15.0...v1.16.0) (2026-07-01)

### Features

- **qcobro:** Mikro <-> QCobro collections integration ([#56](https://github.com/psanders/mikro/issues/56)) ([800ee5d](https://github.com/psanders/mikro/commit/800ee5da738aa0813c9e1bba1cbacf0ab1a7d331)), closes [psanders/mikro#55](https://github.com/psanders/mikro/issues/55)

# [1.15.0](https://github.com/psanders/mikro/compare/v1.14.3...v1.15.0) (2026-06-28)

### Features

- **dashboard:** desktop auto-update via apiserver-served manifest ([#49](https://github.com/psanders/mikro/issues/49)) ([a9a7a41](https://github.com/psanders/mikro/commit/a9a7a410d40a23e2e4484596292a7078b07a7340)), closes [npm/cli#4828](https://github.com/npm/cli/issues/4828)

## [1.14.3](https://github.com/psanders/mikro/compare/v1.14.2...v1.14.3) (2026-06-23)

**Note:** Version bump only for package @mikro/common

## [1.14.2](https://github.com/psanders/mikro/compare/v1.14.1...v1.14.2) (2026-06-23)

### Bug Fixes

- default receipts/contracts paths under data volume ([06103cd](https://github.com/psanders/mikro/commit/06103cd4f2bc91c9195feef6a9eb6174a2337c86))

## [1.14.1](https://github.com/psanders/mikro/compare/v1.14.0...v1.14.1) (2026-06-23)

**Note:** Version bump only for package @mikro/common

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

**Note:** Version bump only for package @mikro/common

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
