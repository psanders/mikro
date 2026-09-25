## 1. Common

- [ ] 1.1 `mapUrl` validation (`isMapUrl`, Google Maps hosts, https, ≤500) + GPS link builder
- [ ] 1.2 `evidenceStatus` + `location`; labels for "Falta:"; unit tests
- [ ] 1.3 Input schemas: `setApplicationMapUrl`, `listEvidenceQueue`, `getEvidenceTask`; event type `application.evidence_completed` + payload; barrels

## 2. Apiserver

- [ ] 2.1 Migration: `loan_applications.map_url`, `customers.map_url`; integration `SCHEMA_SQL`
- [ ] 2.2 Split guards (D2); COLLECTOR admitted to evidence procedures; data/recommendation stay assignee-only
- [ ] 2.3 `setApplicationMapUrl` (set/clear)
- [ ] 2.4 `listEvidenceQueue`, `getEvidenceTask` (collector/admin)
- [ ] 2.5 Completion event on the false→true edge by a non-assignee (D5)
- [ ] 2.6 Conversion copies `mapUrl` to the customer
- [ ] 2.7 Integration tests: collector permissions, queue order/progress/removal, event edge cases, conversion copy, sendToDecision blocked without link

## 3. Ops (dashboard)

- [ ] 3.1 Evidence panel "Ubicación del negocio" field (paste, validate, save, open, replace/remove)
- [ ] 3.2 "Falta:" line + card evidence line include the location
- [ ] 3.3 Feed: `application.evidence_completed` type config + card
- [ ] 3.4 Playwright: map-link field + seed updates (existing specs need a map link to send)

## 4. Collector app (mobile)

- [ ] 4.1 `expo-location` + permissions config; image picker (camera + gallery)
- [ ] 4.2 Hoy card, list screen (oldest first, complete marked, empty state)
- [ ] 4.3 Detail screen: contact/directions, progress, checklist, uploads/deletes
- [ ] 4.4 GPS capture states (searching, no permission, weak signal → save anyway)
- [ ] 4.5 "Mapa" button uses `customer.mapUrl`
- [ ] 4.6 Jest tests + Maestro flow; native config validation (expo prebuild)

## 5. Release

- [ ] 5.1 Release notes: store build needed, in-review applications need a link
- [ ] 5.2 Verify on the prod copy (rehearsal harness) that the migration is additive only
