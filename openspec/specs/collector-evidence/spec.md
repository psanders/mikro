# collector-evidence Specification

## Purpose

TBD - created by archiving change add-collector-evidence. Update Purpose after archive.

## Requirements

### Requirement: Collectors see every application in review, oldest first

A collector-scoped read (`listEvidenceQueue`) SHALL return every `IN_REVIEW` application, ordered by the time it entered review (oldest first), with no assignment filter. Each item SHALL carry the applicant name, business name, address (street, sector/province, reference), phone, time in review, and per-piece progress (`have` / `need` across location, ID front, ID back and the minimum photos) with a `complete` flag. Completed items SHALL stay listed until the application leaves `IN_REVIEW`. Only users with the `COLLECTOR` or `ADMIN` role MAY call it.

#### Scenario: Oldest first, complete items stay

- **WHEN** A entered review 3 days ago with 1 of 6 pieces and B 2 days ago with all pieces
- **THEN** the list is A (1 of 6), then B marked complete

#### Scenario: Leaving review removes the item

- **WHEN** B's reviewer sends it to decision
- **THEN** B is no longer in the list

#### Scenario: Reviewers without the collector role cannot list

- **WHEN** a REVIEWER-only user calls `listEvidenceQueue`
- **THEN** the request is rejected as forbidden

### Requirement: The collector detail read exposes only what the visit needs

A collector-scoped read (`getEvidenceTask`) SHALL return, for one `IN_REVIEW` application: applicant name, business name, phone, address fields, the evidence pieces (map link, ID slots, business photos with labels, other documents) and completeness. It SHALL NOT return the score, the reviewer recommendation, the requested terms or any decision data. It fails with NOT_FOUND unless the application is `IN_REVIEW`.

#### Scenario: No review data leaks

- **WHEN** a collector reads an `IN_REVIEW` application
- **THEN** the response has the evidence and the contact/address fields, and no score, recommendation or amounts

### Requirement: The collector app lists and gathers evidence

The collector app SHALL show a "Evidencias por recoger" card on Hoy with the pending count and the age of the oldest; it opens the list. The detail screen SHALL show contact and directions (call, WhatsApp, directions by address), overall progress, and the checklist in this order: business location (required), ID front and back, business photos (minimum from the queue response, with suggested labels Fachada, Interior, Mercancía, plus "add another"), and optional other documents. Every photo slot SHALL accept the camera or the gallery. The list SHALL show an empty state when nothing is pending.

#### Scenario: Photo from the gallery

- **WHEN** the collector picks the customer's ID back image from the gallery
- **THEN** it is uploaded to the ID back slot and the progress updates

### Requirement: GPS capture saves a map link, even with a weak signal

"Estoy en el negocio" SHALL request location permission if needed, then read the position and save `https://maps.google.com/?q=<lat>,<lng>` as the map link. The app SHALL show the states: searching (until accuracy ≤ 20 m or 15 s pass), no permission (with a way to grant it), and weak signal (accuracy > 20 m: the accuracy is shown and the collector MAY "Guardar de todos modos"). The accuracy is shown at capture time only; it is not stored. A saved link shows "Abrir en Maps" and "Volver a tomar".

#### Scenario: Weak signal still saves

- **WHEN** the best reading after 15 s has ±85 m accuracy and the collector taps "Guardar de todos modos"
- **THEN** the map link is saved from that reading

#### Scenario: No permission

- **WHEN** location permission is denied
- **THEN** nothing is saved and the screen offers to grant the permission

### Requirement: The Mapa button opens the stored location

On the collector app's customer screen, "Mapa" SHALL open the customer's `mapUrl` when present, and otherwise keep today's behaviour (a map search on the collection point or home address).

#### Scenario: Customer with a map link

- **WHEN** a customer has a `mapUrl` and the collector taps "Mapa"
- **THEN** that link opens
