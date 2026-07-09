# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [1.35.2](https://github.com/psanders/mikro/compare/v1.35.1...v1.35.2) (2026-07-09)

### Bug Fixes

- **mobile:** fix pull-to-refresh dead zone on blank space ([#71](https://github.com/psanders/mikro/issues/71)) ([#167](https://github.com/psanders/mikro/issues/167)) ([1bf4412](https://github.com/psanders/mikro/commit/1bf4412a8fe9d506a6486d56062c3d526bf53253))

## [1.35.1](https://github.com/psanders/mikro/compare/v1.35.0...v1.35.1) (2026-07-09)

**Note:** Version bump only for package mikro

# [1.35.0](https://github.com/psanders/mikro/compare/v1.34.1...v1.35.0) (2026-07-09)

### Bug Fixes

- **dashboard:** re-poll snooze expiry so the update banner reappears after 24h ([a52ca2f](https://github.com/psanders/mikro/commit/a52ca2f97b51ac76fac83dbefe80020bc6326368))

### Features

- **dashboard:** postpone update banner for 24h ([#162](https://github.com/psanders/mikro/issues/162)) ([056ac28](https://github.com/psanders/mikro/commit/056ac2894067172b3556ba3ef9edafc57bc6fa1b))
- **tasks:** generalize pay-collector to a generic payment automation ([#163](https://github.com/psanders/mikro/issues/163)) ([b42355e](https://github.com/psanders/mikro/commit/b42355e7707f00d637e7a8497f31be8cf503ce20))

## [1.34.1](https://github.com/psanders/mikro/compare/v1.34.0...v1.34.1) (2026-07-08)

### Bug Fixes

- **config:** use a valid UUID placeholder for accounting.disbursementAccountId ([e084798](https://github.com/psanders/mikro/commit/e0847989364c0d5761296d404e753faffcb0235b)), closes [mikro/#155](https://github.com/psanders/mikro/issues/155)

# [1.34.0](https://github.com/psanders/mikro/compare/v1.33.1...v1.34.0) (2026-07-08)

### Bug Fixes

- **founder-feed:** memoize date-range so the feed query stops thrashing ([e1c1769](https://github.com/psanders/mikro/commit/e1c1769d964e154fa079f655713e596b7934b98d))

### Features

- **founder-feed:** filter by type/actor/date range and group consecutive events ([bfaee4e](https://github.com/psanders/mikro/commit/bfaee4eb7a55caa083208dce272893debb88edea)), closes [#131](https://github.com/psanders/mikro/issues/131)
- **loans:** auto-deduct disbursed principal from ledger on conversion ([c58fd15](https://github.com/psanders/mikro/commit/c58fd15e6c9f229853c98ecea18d472409d9962e)), closes [#155](https://github.com/psanders/mikro/issues/155)

## [1.33.1](https://github.com/psanders/mikro/compare/v1.33.0...v1.33.1) (2026-07-08)

### Bug Fixes

- **tasks:** close daily-close's own day, not the day before ([fc54d67](https://github.com/psanders/mikro/commit/fc54d67b355b13a37f1559dfdef4696ea7686d18))

# [1.33.0](https://github.com/psanders/mikro/compare/v1.32.0...v1.33.0) (2026-07-07)

### Features

- **copilot:** daily cash reconciliation + accounting transaction tool ([#115](https://github.com/psanders/mikro/issues/115)) ([ebf94d2](https://github.com/psanders/mikro/commit/ebf94d279fa723b01483b83b315998a2a5e8e5fa))

# [1.32.0](https://github.com/psanders/mikro/compare/v1.31.0...v1.32.0) (2026-07-07)

### Bug Fixes

- **feedback:** wait for real recording finalization before reading files ([#135](https://github.com/psanders/mikro/issues/135)) ([87849ca](https://github.com/psanders/mikro/commit/87849ca2e42e7b9941d97cb72064017f5a2daf2b))

### Features

- **copilot:** loan lookup by phone parity (Maria parity) — [#119](https://github.com/psanders/mikro/issues/119) ([657c73b](https://github.com/psanders/mikro/commit/657c73b21347dfafb0b9fc6edd0d061c5aaf2b46))

# [1.31.0](https://github.com/psanders/mikro/compare/v1.30.0...v1.31.0) (2026-07-07)

### Features

- **copilot:** send payment receipt via WhatsApp (Maria parity) ([0a527e5](https://github.com/psanders/mikro/commit/0a527e51b998aa6d593a266d50249cd6f61837e5)), closes [#118](https://github.com/psanders/mikro/issues/118)

# [1.30.0](https://github.com/psanders/mikro/compare/v1.29.0...v1.30.0) (2026-07-07)

### Bug Fixes

- **release:** publish Windows .msi to updater folder ([b757adc](https://github.com/psanders/mikro/commit/b757adc79bc3cdfe08babf88c393ebdbd1b3726a)), closes [#136](https://github.com/psanders/mikro/issues/136)

### Features

- **copilot:** let founders force an on-demand QCobro portfolio sync ([6787ddb](https://github.com/psanders/mikro/commit/6787ddb5ec6f336370528b080f837786ce560c4a)), closes [#130](https://github.com/psanders/mikro/issues/130)

# [1.29.0](https://github.com/psanders/mikro/compare/v1.28.0...v1.29.0) (2026-07-07)

### Features

- **copilot:** application review tools (approve/reject/delete) — [#114](https://github.com/psanders/mikro/issues/114) ([add384b](https://github.com/psanders/mikro/commit/add384b1b27c3ad926478303da85f6702812693e))

# [1.28.0](https://github.com/psanders/mikro/compare/v1.27.0...v1.28.0) (2026-07-07)

### Features

- **whatsapp:** track delivery status and deliver templates outside the 24h window ([22ca3ab](https://github.com/psanders/mikro/commit/22ca3ab9222d47a06dcd3694fa41ab97b46c691b)), closes [#85](https://github.com/psanders/mikro/issues/85) [#121](https://github.com/psanders/mikro/issues/121)

# [1.27.0](https://github.com/psanders/mikro/compare/v1.26.0...v1.27.0) (2026-07-07)

### Bug Fixes

- **ci:** retry windows npm install on transient ECONNRESET ([291ed33](https://github.com/psanders/mikro/commit/291ed332f3bc4d360c116ee7257c5601c667d5c3))

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

### Bug Fixes

- **dashboard:** style task form selects to match input height ([9a5ceac](https://github.com/psanders/mikro/commit/9a5ceac1379953f51e3ff14bda8d9d6704792c4a)), closes [#125](https://github.com/psanders/mikro/issues/125)
- **lockfile:** regenerate with npm 10.9.8 to match CI's resolver ([1916269](https://github.com/psanders/mikro/commit/1916269fe7ae81f78c3f3e0b1dbf253ccbc33783))

### Features

- **apiserver:** show daily QCobro sync on the founder feed ([#127](https://github.com/psanders/mikro/issues/127)) ([2ec1048](https://github.com/psanders/mikro/commit/2ec10483f432dded9f9eb1d5e67ed1bb446fd6c4)), closes [#124](https://github.com/psanders/mikro/issues/124)
- **dashboard:** OS notification for red/amber feed events ([#124](https://github.com/psanders/mikro/issues/124)) ([8b60a1c](https://github.com/psanders/mikro/commit/8b60a1ccf11fc016aa8ad37daabf83b81b2c78bb)), closes [#109](https://github.com/psanders/mikro/issues/109)

## [1.24.1](https://github.com/psanders/mikro/compare/v1.24.0...v1.24.1) (2026-07-06)

**Note:** Version bump only for package mikro

# [1.24.0](https://github.com/psanders/mikro/compare/v1.23.0...v1.24.0) (2026-07-06)

### Bug Fixes

- **copilot:** soft-delete action cards when clearing history ([7dc25fa](https://github.com/psanders/mikro/commit/7dc25faa9865e01b4d5ad7abe7df18e37c804ce0))
- **dashboard:** Tareas rail uses a clock icon, placed under Feed ([4a380b8](https://github.com/psanders/mikro/commit/4a380b8770a9c8cd37d1bb674a97835d6bc7637d))

### Features

- **copilot:** createTask/listTasks/cancelTask DIRECT tools ([935e11a](https://github.com/psanders/mikro/commit/935e11ac7b6ff842beddfcb67220f64884195112))
- **dashboard:** amber task cards in the feed + Tareas tab ([38b8629](https://github.com/psanders/mikro/commit/38b8629a329fa7bf27389c81fe2355f2677d59b9))
- **founder:** catch triggered alerts and flag rail with red dot ([#109](https://github.com/psanders/mikro/issues/109)) ([e270855](https://github.com/psanders/mikro/commit/e270855db231e0c9c27f27490efa2d64df0c0c37))
- **tasks:** automation catalog with pay-collector, record-expense, daily-close ([d108060](https://github.com/psanders/mikro/commit/d108060f5dd9f8ecb449e639e8e327988f56d664))
- **tasks:** firing lifecycle + task worker wired at startup ([934589d](https://github.com/psanders/mikro/commit/934589d297027ec54a9d313960b9f92ffd649cf4))
- **tasks:** Task/TaskFiring models + task.\* event and task contracts ([1d68f16](https://github.com/psanders/mikro/commit/1d68f1694157f71acb57378a1d1de053856f9fec))
- **tasks:** tasks.\* tRPC router — CRUD, firing state, confirm/skip ([33a50a9](https://github.com/psanders/mikro/commit/33a50a9b27b90b2a3eaf90d7e6b4aa9d863843db))
- **tasks:** verification pass — docs, auto-expand fix, checklist ([3786d23](https://github.com/psanders/mikro/commit/3786d238f2d8796dd18d9f5d0363190a63fd3b98))

# [1.23.0](https://github.com/psanders/mikro/compare/v1.22.6...v1.23.0) (2026-07-06)

### Features

- **copilot:** tool/environment awareness + githubFeedback tool ([#111](https://github.com/psanders/mikro/issues/111)) ([752db3f](https://github.com/psanders/mikro/commit/752db3f76f1fbef5dfda229d57b1a654e199aa14))

## [1.22.6](https://github.com/psanders/mikro/compare/v1.22.5...v1.22.6) (2026-07-05)

### Bug Fixes

- **dashboard:** delay rail tooltip 700ms and drop the arrow ([2dea9a7](https://github.com/psanders/mikro/commit/2dea9a724316f519daf4b9b0f2a2ccdd1625a4f2))

## [1.22.5](https://github.com/psanders/mikro/compare/v1.22.4...v1.22.5) (2026-07-05)

### Bug Fixes

- **dashboard:** satisfy lint on server-stub.ts ([09205d1](https://github.com/psanders/mikro/commit/09205d1f9912fb0970ab64fb865da53fd8b8c8cb))

## [1.22.4](https://github.com/psanders/mikro/compare/v1.22.3...v1.22.4) (2026-07-05)

### Bug Fixes

- **bug-report:** retry transient submit failures and always show Spanish errors ([c0d5479](https://github.com/psanders/mikro/commit/c0d547955ddba7733403372330431d28d7054ea1)), closes [mikro/#97](https://github.com/psanders/mikro/issues/97)

## [1.22.3](https://github.com/psanders/mikro/compare/v1.22.2...v1.22.3) (2026-07-05)

**Note:** Version bump only for package mikro

## [1.22.2](https://github.com/psanders/mikro/compare/v1.22.1...v1.22.2) (2026-07-05)

### Features

- **dashboard:** silent background auto-update with a "ready" banner ([9de5082](https://github.com/psanders/mikro/commit/9de5082fe9bea1e1f64c5319c904c42411bbde71))

## [1.22.1](https://github.com/psanders/mikro/compare/v1.22.0...v1.22.1) (2026-07-05)

### Bug Fixes

- **dashboard:** ad-hoc sign the macOS bundle so Screen Recording persists ([206f35e](https://github.com/psanders/mikro/commit/206f35ebced54bcb8ea0a3483b0f299f8dc026a2))

### Features

- **dashboard:** show app version in the desktop window title ([7baa689](https://github.com/psanders/mikro/commit/7baa6895324bf4be29c53dbf3f16ebc0d1a1a810)), closes [#99](https://github.com/psanders/mikro/issues/99)
- **mobile:** frequency-aware first-payment calendar on conversion & contract ([8580304](https://github.com/psanders/mikro/commit/858030492293282d900c4f1c106c6a5e989de556)), closes [#1](https://github.com/psanders/mikro/issues/1)
- **mobile:** status-aware reopen label and preset start date on conversion ([02b3b7b](https://github.com/psanders/mikro/commit/02b3b7bd5c65838b7b5d732cc6039b78ca258164))

# [1.22.0](https://github.com/psanders/mikro/compare/v1.21.2...v1.22.0) (2026-07-04)

### Features

- **copilot:** add soft-delete clear-history control to the founder dock ([4129735](https://github.com/psanders/mikro/commit/412973548a54143960eb918e43fba26df834674e))

## [1.21.2](https://github.com/psanders/mikro/compare/v1.21.1...v1.21.2) (2026-07-04)

### Bug Fixes

- **ci:** pin build-dashboard macOS runner to macos-26 ([6b66ff5](https://github.com/psanders/mikro/commit/6b66ff56601018231d1f23dbaa615db6acda6eeb))
- **dashboard:** founder emphasis pass + copilot composer/scroll UX ([e3fc239](https://github.com/psanders/mikro/commit/e3fc2391dee63aa9ec986902dd1da302f5df4787))

## [1.21.1](https://github.com/psanders/mikro/compare/v1.21.0...v1.21.1) (2026-07-04)

### Bug Fixes

- **dashboard:** grant dialog:allow-ask capability for the desktop updater prompt ([4fbdb24](https://github.com/psanders/mikro/commit/4fbdb2401bc787bfdbe5b31320378de9257e52a4)), closes [#99](https://github.com/psanders/mikro/issues/99)
- **mobile:** stop the recording pill from blocking touches on iOS ([098df9a](https://github.com/psanders/mikro/commit/098df9a0ec1f3e65bf60e100e97e882adedda386))

# [1.21.0](https://github.com/psanders/mikro/compare/v1.20.1...v1.21.0) (2026-07-04)

### Bug Fixes

- **apiserver,common,mobile,agents:** require assigned collector for every customer ([7b96568](https://github.com/psanders/mikro/commit/7b965681e27dd9ff0468332f85afc4c95bc99b27)), closes [#41](https://github.com/psanders/mikro/issues/41)
- **dashboard,mobile,apiserver:** drop screenshot in favor of video, pin GitHub API version ([b23e8c1](https://github.com/psanders/mikro/commit/b23e8c1cbf739b2b3eee0c061f422d94d186de31))
- **dashboard:** bake Swift runtime rpath into the Tauri binary for screencapturekit ([73a06c2](https://github.com/psanders/mikro/commit/73a06c244b50365abbbdeb3be229ed6ef8df36d2))
- **mobile:** patch out iOS BroadcastExtension entirely instead of fighting EAS credentials ([afffa36](https://github.com/psanders/mikro/commit/afffa360054a58355c00f27b12c3e63ca1014b4f)), closes [expo/expo#40851](https://github.com/expo/expo/issues/40851)

### Features

- **dashboard,mobile,apiserver:** real video capture, floating pill parity, and no-link result copy for bug reports ([e9ff1c5](https://github.com/psanders/mikro/commit/e9ff1c5b08db7beee4e883e3f363dfce079675a4)), closes [mikro#87](https://github.com/mikro/issues/87)
- **dashboard,mobile:** extend bug-report capture to Tauri desktop and mobile ([c9933b5](https://github.com/psanders/mikro/commit/c9933b5258d385e653826b41194ce90ae81f8a78)), closes [mikro/#69](https://github.com/psanders/mikro/issues/69) [mikro#87](https://github.com/mikro/issues/87)

## [1.20.1](https://github.com/psanders/mikro/compare/v1.20.0...v1.20.1) (2026-07-03)

### Bug Fixes

- **dashboard:** make founder feed rows clickable to expand ([8d138de](https://github.com/psanders/mikro/commit/8d138de21a7d9712fa82ae759e47859ada37a680))

# [1.20.0](https://github.com/psanders/mikro/compare/v1.19.3...v1.20.0) (2026-07-03)

### Bug Fixes

- **mobile,dashboard:** format phone as-you-type and normalize to E.164 ([0b03eda](https://github.com/psanders/mikro/commit/0b03edad8c09a6b1f9b7f2c8760764fa2df9bb0b)), closes [#84](https://github.com/psanders/mikro/issues/84)
- **mobile:** keep quick-action labels on one line ([aa66983](https://github.com/psanders/mikro/commit/aa669831fdb8180ac84c09ee5fd635feeec5b945)), closes [#83](https://github.com/psanders/mikro/issues/83)
- **mobile:** remove Cuadre quick action from home dashboard ([85426d0](https://github.com/psanders/mikro/commit/85426d0d50b5ba72a5a10b784ee8a14e9dea4bd3)), closes [#83](https://github.com/psanders/mikro/issues/83) [#83](https://github.com/psanders/mikro/issues/83)

### Features

- **apiserver,agents:** wire sendPromo as a founder-copilot WRITE_TOOL ([6ea964c](https://github.com/psanders/mikro/commit/6ea964c2e12648de63c900641e149b6fd6584438)), closes [#78](https://github.com/psanders/mikro/issues/78)

## [1.19.3](https://github.com/psanders/mikro/compare/v1.19.2...v1.19.3) (2026-07-03)

### Bug Fixes

- **mobile:** show "Borrador" instead of "Nueva" for draft applications ([ad44692](https://github.com/psanders/mikro/commit/ad446926ce4e419225ede0b5992544d4f094e76f)), closes [mikro/#72](https://github.com/psanders/mikro/issues/72)

### Reverts

- **mobile:** remove Activity/history feature from reviewer app ([#67](https://github.com/psanders/mikro/issues/67)) ([8e1eae8](https://github.com/psanders/mikro/commit/8e1eae8c3f983da95e907fbc008e1750d334eaaa)), closes [#75](https://github.com/psanders/mikro/issues/75)

## [1.19.2](https://github.com/psanders/mikro/compare/v1.19.1...v1.19.2) (2026-07-03)

### Bug Fixes

- **dashboard:** white window bg, panel separation borders, tone down feed bold ([2b801f8](https://github.com/psanders/mikro/commit/2b801f894fb1638c76f51b38044bf4ca36435e3f)), closes [#F4F7](https://github.com/psanders/mikro/issues/F4F7)

## [1.19.1](https://github.com/psanders/mikro/compare/v1.19.0...v1.19.1) (2026-07-03)

### Bug Fixes

- **dashboard:** light window theme and larger uncontained rail logo ([62607c5](https://github.com/psanders/mikro/commit/62607c554bbe7ed6528e89fea95ddd8e8fd79bd2))

### Features

- **release:** consolidate all build outputs on the GitHub Release page ([2969cbd](https://github.com/psanders/mikro/commit/2969cbd49fb70e063d74a400a14b31d564c03961))
- **release:** force_release option on manual dispatch ([2246571](https://github.com/psanders/mikro/commit/2246571b5fc87f8ddc9d25df0b06e56dcd0cb843))

# [1.19.0](https://github.com/psanders/mikro/compare/v1.18.0...v1.19.0) (2026-07-03)

### Bug Fixes

- **ctl:** drop --send-promo from applications:create ([f6e18fc](https://github.com/psanders/mikro/commit/f6e18fca320c7c7d8cc03fc805b251ccbc15474c))

### Features

- **ctl:** applications:list/get/create/update/claim/approve/reject/reopen/delete ([05a60f7](https://github.com/psanders/mikro/commit/05a60f7bc0095300c349120908b792a1316afd27)), closes [#44](https://github.com/psanders/mikro/issues/44)
- **ctl:** reframe applications:claim as applications:assign ([d672dd8](https://github.com/psanders/mikro/commit/d672dd8fd1b696998250b4b7823f7f7cd0a4b680))

# [1.18.0](https://github.com/psanders/mikro/compare/v1.17.1...v1.18.0) (2026-07-03)

### Bug Fixes

- **mobile,apiserver:** stop Reviewer role from seeing or collecting payments ([9b4fb3c](https://github.com/psanders/mikro/commit/9b4fb3c43bfcf38c6ecb97fcac200a7bc5f669c6)), closes [#73](https://github.com/psanders/mikro/issues/73)
- **mobile:** show actual role and Collector/Reviewer switch for Admin users ([6c71b66](https://github.com/psanders/mikro/commit/6c71b66a5984b28685e7937f5e2a74e564263527)), closes [#70](https://github.com/psanders/mikro/issues/70)

### Features

- **dashboard,apiserver:** in-app bug report — record, transcribe, file issue ([f595df1](https://github.com/psanders/mikro/commit/f595df19fd74ccb2e9a059681b71d72e67cad0f8)), closes [#69](https://github.com/psanders/mikro/issues/69)
- **mobile,agents:** move new-customer promotion off WhatsApp into the app ([2e21ab4](https://github.com/psanders/mikro/commit/2e21ab45e66ae78884e91927f11cb7c97e92db62)), closes [#68](https://github.com/psanders/mikro/issues/68)
- **mobile,apiserver:** add reviewer-scoped activity history to Datos ([403fe5a](https://github.com/psanders/mikro/commit/403fe5a163da0e0da836485032c9c6f74a962502)), closes [#67](https://github.com/psanders/mikro/issues/67) [#73](https://github.com/psanders/mikro/issues/73) [#67](https://github.com/psanders/mikro/issues/67)
- **mobile:** add pull-to-refresh to remaining data-backed screens ([0b9b3ce](https://github.com/psanders/mikro/commit/0b9b3ce95a72b13c9eccdd8469c7da0eefcea606)), closes [#71](https://github.com/psanders/mikro/issues/71)
- **mobile:** surface draft/incomplete applications with a promote action ([4fdafe5](https://github.com/psanders/mikro/commit/4fdafe5121eb56eef3533128a4ea3daf9b79c2cf)), closes [#72](https://github.com/psanders/mikro/issues/72)

## [1.17.1](https://github.com/psanders/mikro/compare/v1.17.0...v1.17.1) (2026-07-03)

### Bug Fixes

- **founder:** remove leftover "ops" terminology ([fc00689](https://github.com/psanders/mikro/commit/fc00689c6885c7cb4d7c934d4e40fd2e409083a4))
- **founder:** render copilot markdown, discourage bold/bullet overuse ([ea4b9b8](https://github.com/psanders/mikro/commit/ea4b9b84639041fef0c80d595eec308d819a304a))
- restore peer:true lockfile metadata dropped by a macOS npm install ([db93a57](https://github.com/psanders/mikro/commit/db93a5772faf4b410131808d91356a53344028bf)), closes [#77](https://github.com/psanders/mikro/issues/77)

### Features

- **founder:** replace feed card KV-grid with per-type narratives ([06cb945](https://github.com/psanders/mikro/commit/06cb945f888587bd7dd629809d3238d849b41ed7))
- **founder:** wire the rail avatar to a real profile menu ([db6f68c](https://github.com/psanders/mikro/commit/db6f68cd95ead7655d6a7410dccb296421f1e9e4))

# [1.17.0](https://github.com/psanders/mikro/compare/v1.16.1...v1.17.0) (2026-07-02)

### Bug Fixes

- **ci:** raise Gradle JVM memory for Android APK builds ([#60](https://github.com/psanders/mikro/issues/60)) ([c6ed9dd](https://github.com/psanders/mikro/commit/c6ed9ddf84a99a9e853771e767006562b3e22613))
- **e2e:** pass APP_ID explicitly — flow-header env shadows CLI -e in Maestro ([#61](https://github.com/psanders/mikro/issues/61)) ([28d6ced](https://github.com/psanders/mikro/commit/28d6ced2600079f3b6802a82103648aba099bca7))
- **mobile:** don't show 'Sesión expirada' on fresh installs ([#62](https://github.com/psanders/mikro/issues/62)) ([a7efe58](https://github.com/psanders/mikro/commit/a7efe5865efb98be069c503f8f1e7aba6f94f316))

- feat(founder)!: retire the operations dashboard UI — founder path is the app ([c8c1ffc](https://github.com/psanders/mikro/commit/c8c1ffcb9e3fc739f1f545bc43c41344317d775a))

### Features

- **founder:** business event log + Pencil-faithful founder feed app ([c279c21](https://github.com/psanders/mikro/commit/c279c214b88b49af1a2ed6cc06310159db078576))
- **founder:** copilot dock with confirm-first writes and watch rules ([7aeddfb](https://github.com/psanders/mikro/commit/7aeddfbed848fd13bbe6d17fe8a04116ffde65c5))
- **mobile:** edit, discard, and document actions on Evaluador Datos ([ec833dc](https://github.com/psanders/mikro/commit/ec833dce3143d21b1330153483b33cf5f63905d4)), closes [#63](https://github.com/psanders/mikro/issues/63) [#66](https://github.com/psanders/mikro/issues/66) [#65](https://github.com/psanders/mikro/issues/65) [#64](https://github.com/psanders/mikro/issues/64) [#67](https://github.com/psanders/mikro/issues/67)

### BREAKING CHANGES

- desktop review/ops screens removed; review lives in the
  mobile evaluator app and via the copilot.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QTH1LxUpnpfzM1dsTWETRG

## [1.16.1](https://github.com/psanders/mikro/compare/v1.16.0...v1.16.1) (2026-07-01)

### Bug Fixes

- **ci:** repair apiserver smoke test, schema drift, and corrupt lockfile subtrees ([#59](https://github.com/psanders/mikro/issues/59)) ([96f208b](https://github.com/psanders/mikro/commit/96f208b35d105e26ca6c39ea19f8629af0822204))
- **config:** remove trailing comma breaking mikro.json.example as JSON ([#57](https://github.com/psanders/mikro/issues/57)) ([f9ac92b](https://github.com/psanders/mikro/commit/f9ac92b12b717cc7e575fe28e1448ce030030dff))
- **config:** remove trailing comma in mikro.json.example ([#53](https://github.com/psanders/mikro/issues/53)) ([694dd65](https://github.com/psanders/mikro/commit/694dd65d99c90df9fb9a1afcdf122241c19214af)), closes [#52](https://github.com/psanders/mikro/issues/52)

### Features

- **mobile:** add evaluator role to the collector app ([#58](https://github.com/psanders/mikro/issues/58)) ([dc1fbc2](https://github.com/psanders/mikro/commit/dc1fbc207c0fdf5ac8f0929f62ea7c52307b3db3)), closes [npm/cli#4828](https://github.com/npm/cli/issues/4828)

# [1.16.0](https://github.com/psanders/mikro/compare/v1.15.0...v1.16.0) (2026-07-01)

### Bug Fixes

- **ci:** copy tracked agents.yaml in deploy smoke test ([#52](https://github.com/psanders/mikro/issues/52)) ([cd4204f](https://github.com/psanders/mikro/commit/cd4204f63f743d1957189c0686e529c47b4c71ea))

### Features

- **qcobro:** Mikro <-> QCobro collections integration ([#56](https://github.com/psanders/mikro/issues/56)) ([800ee5d](https://github.com/psanders/mikro/commit/800ee5da738aa0813c9e1bba1cbacf0ab1a7d331)), closes [psanders/mikro#55](https://github.com/psanders/mikro/issues/55)

# [1.15.0](https://github.com/psanders/mikro/compare/v1.14.3...v1.15.0) (2026-06-28)

### Features

- **dashboard:** desktop auto-update via apiserver-served manifest ([#49](https://github.com/psanders/mikro/issues/49)) ([a9a7a41](https://github.com/psanders/mikro/commit/a9a7a410d40a23e2e4484596292a7078b07a7340)), closes [npm/cli#4828](https://github.com/npm/cli/issues/4828)

## [1.14.3](https://github.com/psanders/mikro/compare/v1.14.2...v1.14.3) (2026-06-23)

**Note:** Version bump only for package mikro

## [1.14.2](https://github.com/psanders/mikro/compare/v1.14.1...v1.14.2) (2026-06-23)

### Bug Fixes

- default receipts/contracts paths under data volume ([06103cd](https://github.com/psanders/mikro/commit/06103cd4f2bc91c9195feef6a9eb6174a2337c86))
- persist receipts and contracts under data volume ([f05b3d0](https://github.com/psanders/mikro/commit/f05b3d092138a047b98cfe14c876eca5cef9c732))
- replace deprecated llm model for the autopilot ([01021da](https://github.com/psanders/mikro/commit/01021dabea4b0361b5cc874ffa69ae84ee3b97d7))

## [1.14.1](https://github.com/psanders/mikro/compare/v1.14.0...v1.14.1) (2026-06-23)

**Note:** Version bump only for package mikro

# [1.14.0](https://github.com/psanders/mikro/compare/v1.13.1...v1.14.0) (2026-06-22)

### Features

- **ctl:** add applications:sendPromo command + whatsapp template smoke-test ([2d61127](https://github.com/psanders/mikro/commit/2d61127d7902bd01d1318d40f92372318f8de1da))

## [1.13.1](https://github.com/psanders/mikro/compare/v1.13.0...v1.13.1) (2026-06-21)

### Bug Fixes

- **apiserver:** stop tracking generated Prisma client ([0d19176](https://github.com/psanders/mikro/commit/0d1917616141e101f9980e4fb4bd194a648fce84))

# [1.13.0](https://github.com/psanders/mikro/compare/v1.12.0...v1.13.0) (2026-06-21)

### Features

- **apiserver:** add automated loan application follow-up timer system ([a59b47f](https://github.com/psanders/mikro/commit/a59b47f58b2e69a97de28fb0a749278668fcb195))
- **whatsapp:** payment-confirmation template + configurable timers + single language ([1fd16eb](https://github.com/psanders/mikro/commit/1fd16ebd835f101926f2a086dac436b45a8dbd1a))

# [1.12.0](https://github.com/psanders/mikro/compare/v1.11.0...v1.12.0) (2026-06-21)

### Bug Fixes

- **agents:** restore BUSINESS_PHONE constant in collector test ([dbc69dd](https://github.com/psanders/mikro/commit/dbc69dd751e6f4d1ff7e8e0f3f1cab340286e75e))

### Features

- **agents:** add collector photo-prospecting WhatsApp agent ([b62dd04](https://github.com/psanders/mikro/commit/b62dd044bff420bee383c2ce88768d3a60d4cf47))

# [1.11.0](https://github.com/psanders/mikro/compare/v1.10.2...v1.11.0) (2026-06-21)

### Features

- **agents:** short-form José intake with opt-out and ABANDONED status ([5bb0ab1](https://github.com/psanders/mikro/commit/5bb0ab1329cb703159a93aa1728b21affedce5d2))
- **site:** link Instagram and Facebook in footer ([715830a](https://github.com/psanders/mikro/commit/715830a77638abafcbc26d1e80a41262f93e3b0f))

## [1.10.2](https://github.com/psanders/mikro/compare/v1.10.1...v1.10.2) (2026-06-20)

**Note:** Version bump only for package mikro

## [1.10.1](https://github.com/psanders/mikro/compare/v1.10.0...v1.10.1) (2026-06-20)

### Bug Fixes

- **agents:** per-agent replyMode, fix zone check, drop weekend boilerplate ([78e4874](https://github.com/psanders/mikro/commit/78e48747eb7cf489400b98ec6a0cb953e9cd5fbe))
- **ci:** mount agents.yaml in smoke test and compose ([ab33520](https://github.com/psanders/mikro/commit/ab33520b5a54519431d66d66cc0e3620d40a2885))

# [1.10.0](https://github.com/psanders/mikro/compare/v1.9.3...v1.10.0) (2026-06-20)

### Features

- **agents:** externalize agents to YAML, route by profile ([23e23a4](https://github.com/psanders/mikro/commit/23e23a4cb2a3075491c9ffe6c2928560c01ea4c6))

## [1.9.3](https://github.com/psanders/mikro/compare/v1.9.2...v1.9.3) (2026-06-20)

**Note:** Version bump only for package mikro

## [1.9.1](https://github.com/psanders/mikro/compare/v1.9.0...v1.9.1) (2026-06-19)

### Bug Fixes

- **apiserver:** promote promo-sent log to info to surface messageId ([a1849d8](https://github.com/psanders/mikro/commit/a1849d87d03aefeec1089a516cf04949834154ef))
- **dashboard:** replace inline promo banner with toast in SolicitudDetailPage ([1edb0e6](https://github.com/psanders/mikro/commit/1edb0e679b3df413c601c85de15a666427fb1ecb))
- **dashboard:** select defaults + registrar transacción button height ([fa46fad](https://github.com/psanders/mikro/commit/fa46fad103c364ae569924354e592ad408448847))
- **dashboard:** unify select height via shared Select component ([#40](https://github.com/psanders/mikro/issues/40)) ([997e07b](https://github.com/psanders/mikro/commit/997e07b2217e7d682f7a95d0465bbd11c6b7f05d))

### Features

- **dashboard:** consolidate toast notifications across all mutation sites ([3460021](https://github.com/psanders/mikro/commit/34600214a8c4338f09917f5cc78ff4af54d2c707))

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

- **ci:** align site react/react-dom with root override; add lock-check ([e0f7b71](https://github.com/psanders/mikro/commit/e0f7b715bebb5420238adbd4bc4b8839cf7a9e61))
- **contracts:** move legal-entity data to mikro.json; drop cedula assets ([e8045b8](https://github.com/psanders/mikro/commit/e8045b82baa7dd4400de8b5665a5237215de6e64))
- **contracts:** render human-readable labels in loan contract PDF ([0496473](https://github.com/psanders/mikro/commit/049647394cd9da53f1a78c1b5228f0b61adfba44))

### Features

- **dashboard:** export the business-model projection as a branded PDF ([eeb84b4](https://github.com/psanders/mikro/commit/eeb84b40cb45495dd9bbb7f0bf6f4ab3eb884404))
- **dashboard:** save files via native dialog in the Tauri desktop app ([615208c](https://github.com/psanders/mikro/commit/615208c686d63e64385bb8b39c299831d6668692))
- **solicitudes:** manually create loan applications from the dashboard ([d59068e](https://github.com/psanders/mikro/commit/d59068e87b127d9e2a3d3401c4d6136cb7d98d74))

# [1.5.0](https://github.com/psanders/mikro/compare/v1.4.1...v1.5.0) (2026-06-11)

### Bug Fixes

- **whatsapp:** shorten Flow labels (<=20) and option titles (<=30) ([2a8b257](https://github.com/psanders/mikro/commit/2a8b25707f93031c7b87753b55b9f569e781ee84))

### Features

- **apiserver:** report running version in /health ([e235bed](https://github.com/psanders/mikro/commit/e235bedcec0373d971913b1b36f3f692cb2eabf6))
- **whatsapp:** prospect loan-application intake via native Flow form ([57133c1](https://github.com/psanders/mikro/commit/57133c1bfd222061e6b54c4bd4652387e1cd4e39))
- **whatsapp:** support sending the intake Flow in draft mode ([57c5fe8](https://github.com/psanders/mikro/commit/57c5fe8e3af9b7fc6a344309f665d54007dd8f89))

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
