## ADDED Requirements

### Requirement: The evidence panel has a required business location field

The Ops evidence panel SHALL show "Ubicación del negocio · obligatoria" first, with a field to paste a Google Maps link and a save action; invalid links show a validation message. A saved link shows with "Abrir en Maps" and can be replaced or removed. The panel's "Falta:" line and the application card's evidence line SHALL include the location when it is missing.

#### Scenario: Paste a link

- **WHEN** the assignee pastes `https://maps.app.goo.gl/AbC123` and saves
- **THEN** the location shows as saved and "Falta:" no longer lists it

#### Scenario: Missing location is named

- **WHEN** an application has both ID sides and 3 photos but no map link
- **THEN** "Falta:" reads "ubicación" and "Enviar a decisión" stays disabled
