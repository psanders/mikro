# application-evidence Specification

## Purpose

TBD - created by archiving change add-application-review-flow. Update Purpose after archive.

## Requirements

### Requirement: Evidence has two fixed ID slots, business photos and other documents

An application's evidence SHALL consist of:

- the ID card front and back: two fixed slots stored in the existing `idFront*`/`idBack*` columns; uploading a side replaces it
- business photos: `ApplicationDocument` rows of kind `BUSINESS_PHOTO`, any number, each with an optional label (e.g. "Fachada")
- optional other documents: `ApplicationDocument` rows of kind `OTHER`, e.g. a utility bill or lease

Files SHALL use the existing content-addressed storage (`<sha256>.<ext>`). Images SHALL be JPEG/PNG/WebP; other documents MAY also be PDF; each file is capped at the attachment size limit.

#### Scenario: Upload a business photo

- **WHEN** the assignee uploads a JPEG labeled "Fachada" to an `IN_REVIEW` application
- **THEN** an `ApplicationDocument` of kind `BUSINESS_PHOTO` with that label exists and the file is stored by sha256

#### Scenario: Replace an ID side

- **WHEN** the assignee uploads a new ID back image when one exists
- **THEN** the `idBack*` columns point to the new file

#### Scenario: Unsupported type is rejected

- **WHEN** a business photo is uploaded as a PDF
- **THEN** the request fails validation

### Requirement: Evidence is complete when both ID sides and the minimum photos exist

Evidence SHALL be complete when both ID sides are stored, the count of `BUSINESS_PHOTO` documents is at least `applications.minBusinessPhotos`, and the application has a `mapUrl`. That config key is optional, defaults to 3, and must be an integer ≥ 0. A read procedure SHALL return completeness per piece (`location`, `idFront`, `idBack`, `businessPhotos {have, need}`), so the UI can name what is missing.

#### Scenario: Default minimum

- **WHEN** `mikro.json` has no `applications.minBusinessPhotos` and an application has a map link, both ID sides and 2 photos
- **THEN** evidence is incomplete with `businessPhotos {have: 2, need: 3}`

#### Scenario: Complete evidence

- **WHEN** an application has a map link, both ID sides and 3 photos
- **THEN** evidence is complete

#### Scenario: Missing map link blocks sending

- **WHEN** an application has both ID sides and 3 photos but no map link, and the assignee sends it to decision
- **THEN** the request fails with `EVIDENCE_INCOMPLETE` and `location` is reported missing

### Requirement: Evidence is writable only by the assignee during review

Uploads, replacements, and deletions of evidence (ID sides, business photos, other documents, the map link) SHALL be allowed only while the application is `IN_REVIEW`, by its assigned reviewer or by any user with the `COLLECTOR` role. Collectors need no assignment. Edits of the application data and of the `reviewerRecommendation` SHALL stay limited to the assigned reviewer in `IN_REVIEW`. Evidence is therefore locked while `PENDING_DECISION` and later, and becomes writable again when an admin returns the application. The storage/validation logic SHALL live in plain functions that take an already-authorized actor, so a future token-authenticated capture route can reuse them.

#### Scenario: Locked while pending decision

- **WHEN** anyone uploads a photo to a `PENDING_DECISION` application
- **THEN** the request fails with CONFLICT

#### Scenario: Unlocked after return

- **WHEN** an admin returns the application and the assignee then uploads a photo
- **THEN** the upload succeeds

#### Scenario: Non-assignee reviewer cannot upload

- **WHEN** a reviewer who is not the assignee and not a collector uploads to an `IN_REVIEW` application
- **THEN** the request is rejected as forbidden

#### Scenario: Any collector can upload and delete

- **WHEN** a collector uploads the ID back and deletes a business photo the assignee uploaded, on an `IN_REVIEW` application
- **THEN** both succeed

#### Scenario: Collectors cannot edit data or the recommendation

- **WHEN** a collector edits the business name or the recommendation of an `IN_REVIEW` application
- **THEN** the request is rejected as forbidden

### Requirement: The business location is stored as a map link

An application SHALL have an optional `mapUrl`: a link to the business location. Only the link is stored, with no coordinates, accuracy or author. A value SHALL be accepted only if it is an `https` URL on a Google Maps host (`maps.google.com`, `www.google.com/maps…`, `maps.app.goo.gl`, `goo.gl/maps…`), at most 500 characters. Links built from GPS SHALL use `https://maps.google.com/?q=<lat>,<lng>` with 6 decimals. Setting it follows the evidence write rule; clearing it is allowed the same way.

#### Scenario: GPS link is accepted

- **WHEN** a collector saves `https://maps.google.com/?q=19.793412,-70.688401` on an `IN_REVIEW` application
- **THEN** the application's `mapUrl` is that link

#### Scenario: A pasted short link is accepted

- **WHEN** the assignee saves `https://maps.app.goo.gl/AbC123`
- **THEN** it is stored

#### Scenario: Other links are rejected

- **WHEN** someone saves `https://example.com/maps` or `http://maps.google.com/?q=1,2`
- **THEN** the request fails validation and nothing is stored
