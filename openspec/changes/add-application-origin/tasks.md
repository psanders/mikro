## 1. Design

- [x] 1.1 Pencil: `Origen` row in the panel (board `EzobQ` sec-08)
- [ ] 1.2 Pencil: drop the feed card chip and the variants strip (feed stays light)

## 2. Build

- [x] 2.1 common: `applicationOrigin()` + `APPLICATION_ORIGIN_LABELS` (CLI) / `APPLICATION_ORIGIN_LABELS_ES` (Ops), cutoff constant, `origin` on `listApplicationsSchema`; export through both barrels
- [x] 2.2 apiserver: `listApplications` translates `origin` to a `where` on `source`/`adId`/`createdAt`
- [x] 2.3 ctl: `applications:list` ORIGIN column + `--origin` flag + readable STATUS; `applications:get` ORIGIN line + readable STATUS
- [x] 2.4 dashboard: `Origen` row in the panel
- [x] 2.5 Remove the feed card chip (`OriginChip`, its story) and the feed API's `origin` field
- [x] 2.6 Application PDF: origin in the header
- [x] 2.7 `getCustomer` returns the origin of the customer's converted application; `customers:get` prints `ORIGIN:`

## 3. Test

- [x] 3.1 Unit: `applicationOrigin()` for all five cases incl. the cutoff boundary
- [x] 3.2 Unit: `listApplications` origin filter + validation failure (invalid origin rejected, no query)
- [x] 3.3 Playwright: the panel shows the origin; the feed card does not
- [x] 3.4 Unit: PDF header carries the origin; `getCustomer` origin (converted, several, none)
- [x] 3.5 Lint, typecheck, unit, integration, e2e green
