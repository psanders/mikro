## Why

Ops can't tell where a loan application came from. The data is already stored — `source` (FORM / WHATSAPP / MANUAL) and the Meta ad ids the site forwards (`adId`, live since 2026-09-18 02:52 UTC) — but no surface shows it per application. `applications:list` also prints raw status codes (`IN_REVIEW`) instead of the readable labels Ops and the application PDF already use.

## What Changes

- **One derived "origin" per application**, from data already on the row:
  - `FORM` with an `adId` → **ad**
  - `FORM` without an `adId`, created on/after 2026-09-18 02:52 UTC → **organic**
  - `FORM` without an `adId`, created before that → **unknown** (ad tracking didn't exist yet, so "organic" would be wrong)
  - `WHATSAPP` → **WhatsApp**; `MANUAL` → **Manual**
- **CLI:**
  - `applications:list` gains an `ORIGIN` column (`Form (ad)`, `Form (organic)`, `Form (unknown)`, `WhatsApp`, `Manual`) and an `--origin ad|organic|unknown|whatsapp|manual` filter.
  - `STATUS` prints the readable label (`APPLICATION_STATUS_LABELS`, e.g. "En evaluación").
  - `applications:get` adds an `ORIGIN:` line and prints the readable status.
- **Ops:** the application panel shows an `Origen` row at the top of the data (`Formulario (anuncio)`, `Formulario (orgánico)`, `Formulario (desconocido)`, `WhatsApp`, `Manual`). The feed card does not show it, to keep the feed light.
- **Application PDF:** the header shows the origin next to date and status.
- **Customer:** `customers:get` prints the origin of the application that became the customer (`—` if none).
- Origin is about the channel and ad vs. organic only. **Which ad or campaign is out of scope.**

## Capabilities

### New Capabilities

- `application-origin`: how an application's origin is derived, and how the CLI lists and filters it.

### Modified Capabilities

- `ops-application-flow`: the application panel shows the origin (the feed card does not).

## Impact

- **common:** `applicationOrigin()` + label maps (CLI English, Ops Spanish), `origin` filter on `listApplicationsSchema`.
- **apiserver:** `listApplications` filters by origin; `getCustomer` returns the customer's origin; the PDF builder passes the origin.
- **ctl:** `applications:list` / `applications:get` / `customers:get` output.
- **dashboard:** `Origen` row in the panel; Playwright.
- **Pencil:** panel row on board `EzobQ` sec-08.
- **No schema, migration, or `mikro.json` change.**
