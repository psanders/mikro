## Why

Evidence for an application in review is gathered today only by its assigned reviewer, at a desk. The people who are actually on the street every day are the collectors, and the one piece of evidence that proves someone visited the business, its location, isn't recorded anywhere: the schema holds only text addresses, and the collector app's "Mapa" button guesses from them. Collectors should pick up the missing evidence while they're out, and every application should carry a map link to the business.

The design is final in `pencil.pen`, board "Collector · Evidencias (IN_REVIEW)" (`J3PM63`).

## What Changes

- **Map link evidence (required).** New `mapUrl` on the application: only the link, no coordinates, accuracy or author. Collectors save it from GPS ("Estoy en el negocio", `https://maps.google.com/?q=<lat>,<lng>`); reviewers paste a Google Maps link in Ops. Only map links are accepted. With a weak GPS signal the collector may still save.
- **Evidence completeness** adds the map link: complete = both ID sides + minimum business photos + `mapUrl`. `sendToDecision` stays gated on it.
- **Collectors can write evidence.** While an application is `IN_REVIEW`, any collector may add, replace and delete any evidence (ID sides, photos, other documents, map link), with no assignment. The assignee keeps the same rights. Data edits and the recommendation stay assignee-only.
- **Collector evidence list.** A collector-scoped list of every `IN_REVIEW` application, oldest first, with per-item progress. Completed items stay listed, marked complete, until the application leaves `IN_REVIEW`. A collector-scoped detail read returns only what the visit needs (name, business, address, phone, evidence).
- **Collector app.** A "Evidencias por recoger" card on Hoy opens the list. The detail screen has the checklist: location with its GPS states (pending, searching, no permission, weak signal), the ID slots, the photo slots and optional documents. Photos come from the camera or the gallery. Adds `expo-location`, a native module, so this ships in a store build.
- **Ops.** The evidence panel gets a required "Ubicación del negocio" paste field; "Falta:" and the card's evidence line include it.
- **Feed.** One `application.evidence_completed` event when a write completes the evidence and the writer isn't the assignee ("Evidencia completa · por Luis"). Individual uploads emit nothing.
- **Conversion** copies `mapUrl` to the new or reused customer. The collector app's "Mapa" button opens it, and falls back to the address search when there is none.
- **BREAKING (data):** applications already `IN_REVIEW` at release need a map link before they can be sent to decision.

## Capabilities

### New Capabilities

- `collector-evidence`: the collector's evidence list and detail (API and mobile), GPS capture, and the photo sources.

### Modified Capabilities

- `application-evidence`: the map link piece, the completeness rule, collector write access.
- `ops-application-flow`: the map-link field in the evidence panel.
- `loan-application-conversion`: `mapUrl` copied to the customer.
- `business-event-log`: `application.evidence_completed`.

## Impact

- `@mikro/common`: `evidenceStatus` (+ `mapUrl`), map-URL validation, input schemas, event type.
- apiserver: migration adding `loan_applications.map_url` and `customers.map_url`; evidence guard split; new procedures `setApplicationMapUrl`, `listEvidenceQueue`, `getEvidenceTask`; COLLECTOR admitted to the evidence procedures; conversion copy; event.
- dashboard: evidence panel field, "Falta:" text, card line.
- mobile: new screens, `expo-location`, camera/gallery picker, "Mapa" button. Needs a store build.
- Tests: unit (rules, URL validation), integration (collector permissions, queue, event, conversion copy), Playwright (map-link field), jest + Maestro (collector flow).
