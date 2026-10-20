## ADDED Requirements

### Requirement: The full application shows its origin

The application panel SHALL show the application's origin (see `application-origin`) as an `Origen` row at the top of the application data, in Spanish: `Formulario (anuncio)`, `Formulario (orgánico)`, `Formulario (desconocido)`, `WhatsApp` or `Manual`. The feed card SHALL NOT show the origin, so the feed stays light. Neither SHALL show which ad or campaign produced the application.

#### Scenario: Origin in the panel

- **WHEN** a reviewer opens an application whose origin is `ad` in the side panel
- **THEN** the panel's data starts with `Origen: Formulario (anuncio)`

#### Scenario: The feed card stays light

- **WHEN** an application appears in the feed
- **THEN** its card shows no origin
