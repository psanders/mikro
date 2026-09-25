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

Evidence SHALL be complete when both ID sides are stored and the count of `BUSINESS_PHOTO` documents is at least `applications.minBusinessPhotos`. That config key is optional, defaults to 3, and must be an integer ≥ 0. A read procedure SHALL return completeness per piece (`idFront`, `idBack`, `businessPhotos {have, need}`), so the UI can name what is missing.

#### Scenario: Default minimum

- **WHEN** `mikro.json` has no `applications.minBusinessPhotos` and an application has both ID sides and 2 photos
- **THEN** evidence is incomplete with `businessPhotos {have: 2, need: 3}`

#### Scenario: Complete evidence

- **WHEN** an application has both ID sides and 3 photos
- **THEN** evidence is complete

### Requirement: Evidence is writable only by the assignee during review

Uploads, replacements, and deletions of evidence, and edits of the `reviewerRecommendation`, SHALL be allowed only while the application is `IN_REVIEW` and only by its assigned reviewer. Evidence is therefore locked while `PENDING_DECISION` and later, and becomes writable again when an admin returns the application. The storage/validation logic SHALL live in plain functions that take an already-authorized actor, so a future token-authenticated capture route can reuse them.

#### Scenario: Locked while pending decision

- **WHEN** anyone uploads a photo to a `PENDING_DECISION` application
- **THEN** the request fails with CONFLICT

#### Scenario: Unlocked after return

- **WHEN** an admin returns the application and the assignee then uploads a photo
- **THEN** the upload succeeds

#### Scenario: Non-assignee cannot upload

- **WHEN** a reviewer who is not the assignee uploads to an `IN_REVIEW` application
- **THEN** the request is rejected as forbidden
