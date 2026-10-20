## 1. Design

- [x] 1.1 Pencil: origin chip on the application feed card and `Origen` row in the panel (board `EzobQ` sec-08)

## 2. Build

- [x] 2.1 common: `applicationOrigin()` + `APPLICATION_ORIGIN_LABELS` (CLI) / `APPLICATION_ORIGIN_LABELS_ES` (Ops), cutoff constant, `origin` on `listApplicationsSchema`; export through both barrels
- [x] 2.2 apiserver: `listApplications` translates `origin` to a `where` on `source`/`adId`/`createdAt`
- [x] 2.3 ctl: `applications:list` ORIGIN column + `--origin` flag + readable STATUS; `applications:get` ORIGIN line + readable STATUS
- [x] 2.4 dashboard: origin chip on `ApplicationFeedCard` (+ story), `Origen` row in the panel

## 3. Test

- [x] 3.1 Unit: `applicationOrigin()` for all five cases incl. the cutoff boundary
- [x] 3.2 Unit: `listApplications` origin filter + validation failure (invalid origin rejected, no query)
- [x] 3.3 Playwright: the feed card and panel show the origin
- [x] 3.4 Lint, typecheck, unit, integration, e2e green
