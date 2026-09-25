## 1. Common

- [x] 1.1 `mapUrl` validation (`isMapUrl`, Google Maps hosts, https, ≤500) + GPS link builder
- [x] 1.2 `evidenceStatus` + `location`; labels for "Falta:"; unit tests
- [x] 1.3 Input schemas: `setApplicationMapUrl`, `listEvidenceQueue`, `getEvidenceTask`; event type `application.evidence_completed` + payload; barrels

## 2. Apiserver

- [x] 2.1 Migration: `loan_applications.map_url`, `customers.map_url`; integration `SCHEMA_SQL`
- [x] 2.2 Split guards (D2); COLLECTOR admitted to evidence procedures; data/recommendation stay assignee-only
- [x] 2.3 `setApplicationMapUrl` (set/clear)
- [x] 2.4 `listEvidenceQueue`, `getEvidenceTask` (collector/admin)
- [x] 2.5 Completion event on the false→true edge by a non-assignee (D5)
- [x] 2.6 Conversion copies `mapUrl` to the customer
- [x] 2.7 Integration tests: collector permissions, queue order/progress/removal, event edge cases, conversion copy, sendToDecision blocked without link

## 3. Ops (dashboard)

- [x] 3.1 Evidence panel "Ubicación del negocio" field (paste, validate, save, open, replace/remove)
- [x] 3.2 "Falta:" line + card evidence line include the location
- [x] 3.3 Feed: `application.evidence_completed` type config + card
- [ ] 3.4 Playwright: map-link field + seed updates (existing specs need a map link to send) — written, not yet run

## 4. Collector app (mobile)

- [x] 4.1 `expo-location` + permissions config; image picker (camera + gallery)
- [x] 4.2 Hoy card, list screen (oldest first, complete marked, empty state)
- [x] 4.3 Detail screen: contact/directions, progress, checklist, uploads/deletes
- [x] 4.4 GPS capture states (searching, no permission, weak signal → save anyway)
- [x] 4.5 "Mapa" button uses `customer.mapUrl`
- [ ] 4.6 Jest tests + Maestro flow; native config validation (expo prebuild) — Jest + prebuild done; Maestro flow written, not yet run on a simulator

## 5. Release

- [ ] 5.1 Release notes: store build needed, in-review applications need a link
- [x] 5.2 Verify on the prod copy (rehearsal harness) that the migration is additive only — both migrations applied to the 2026-09-23 copy; all existing rows identical, two empty columns added
