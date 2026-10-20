## ADDED Requirements

### Requirement: Ops shows each application's origin

The Ops app SHALL show each application's origin (see `application-origin`) in Spanish: `Formulario (anuncio)`, `Formulario (orgánico)`, `Formulario (desconocido)`, `WhatsApp` or `Manual`.

- The application feed card SHALL show the origin as a chip on its collapsed row.
- The application panel SHALL show an `Origen` row at the top of the application data.

It SHALL NOT show which ad or campaign produced the application.

#### Scenario: Ad application in the feed

- **WHEN** an application whose origin is `ad` appears in the feed
- **THEN** its card shows a `Formulario (anuncio)` chip

#### Scenario: Origin in the panel

- **WHEN** a reviewer opens an application whose origin is `whatsapp` in the side panel
- **THEN** the panel's data starts with `Origen: WhatsApp`
