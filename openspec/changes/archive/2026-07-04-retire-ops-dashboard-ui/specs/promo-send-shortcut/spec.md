# promo-send-shortcut — delta

## REMOVED Requirements

### Requirement: Inicio panel has a "Enviar Promoción" button that opens a phone-only modal

**Reason**: The Inicio screen is retired with the operations dashboard UI.
**Migration**: Standalone promos remain fully available via the apiserver capability (unchanged requirement in this spec) — sendable through the copilot or any API client.

### Requirement: Dashboard shows toast feedback after standalone promo send

**Reason**: The dashboard promo UI is retired.
**Migration**: The copilot surfaces send outcomes conversationally; the apiserver behavior is unchanged.
