## Context

Follow-up to `add-application-review-flow` (v3.0.0). Decisions were taken with the user on 2026-09-23 and 2026-09-25; the design is in `pencil.pen`, board `J3PM63`.

## Decisions

- **D1 · Link only.** `mapUrl` is a single text column, with no lat/lng, accuracy or captured-by columns. The GPS link format `https://maps.google.com/?q=lat,lng` opens Google Maps on Android and iOS, or the browser. Validation is host-based (Google Maps hosts, https), so pasted short links work.
- **D2 · Two guards instead of one.** `assertEvidenceWritable(app, actor)`: `IN_REVIEW` and (assignee OR `COLLECTOR`). `assertReviewDataWritable`: `IN_REVIEW` and assignee, used for data edits and the recommendation. Evidence procedures move from the reviewer-only procedure builder to one admitting REVIEWER | ADMIN | COLLECTOR; the guard does the real check.
- **D3 · Completeness stays one pure function.** `evidenceStatus(app, photoCount, min)` gains `location: Boolean(app.mapUrl)`. Server gating, the Ops "Falta:" line, the card line and the collector progress all read it, so they can't drift.
- **D4 · Queue order** = `assignedAt` ascending, the moment the application entered `IN_REVIEW` (set by `assign`; a return keeps the original). Progress counts 1 location + 2 ID sides + `min` photos.
- **D5 · Completion event.** Every evidence write computes completeness before and after, inside the same request; a false→true edge by a non-assignee records `application.evidence_completed` intrinsically (not a `.meta` boundary event, because it depends on the before/after state).
- **D6 · Collector detail is its own read.** `getEvidenceTask` selects explicit fields, so no review data (score, recommendation, terms, decision) reaches the collector app even if `getApplication` grows.
- **D7 · Mobile.** `expo-location` (foreground permission only); `expo-image-picker` for camera and gallery. GPS: `watchPositionAsync` until accuracy ≤ 20 m or 15 s, then offer the best reading. Store build required.

## Risks

- Applications already `IN_REVIEW` at release lose "Enviar a decisión" until someone adds a map link. The release notes say so; the collector list surfaces them.
- Any collector can delete a reviewer's photo. Accepted by the user ("full edit"); the file itself stays in content-addressed storage.
