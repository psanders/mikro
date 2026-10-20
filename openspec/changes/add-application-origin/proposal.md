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
- **Ops:**
  - The application feed card shows an origin chip (`Formulario (anuncio)`, `Formulario (orgánico)`, `Formulario (desconocido)`, `WhatsApp`, `Manual`).
  - The application panel shows an `Origen` row at the top of the data.
- Origin is about the channel and ad vs. organic only. **Which ad or campaign is out of scope.**

## Capabilities

### New Capabilities

- `application-origin`: how an application's origin is derived, and how the CLI lists and filters it.

### Modified Capabilities

- `ops-application-flow`: the feed card and the application panel show the origin.

## Impact

- **common:** `applicationOrigin()` + label maps (CLI English, Ops Spanish), `origin` filter on `listApplicationsSchema`.
- **apiserver:** `listApplications` filters by origin (translated to a `where` on `source`/`adId`/`createdAt`).
- **ctl:** `applications:list` / `applications:get` output.
- **dashboard:** origin chip on `ApplicationFeedCard`, `Origen` row in the panel; Storybook + Playwright.
- **Pencil:** card chip and panel row on board `EzobQ` sec-08.
- **No schema, migration, or `mikro.json` change.**
