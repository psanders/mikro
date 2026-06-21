## ADDED Requirements

### Requirement: Promo send is triggerable from the collector WhatsApp flow

The intake Flow CTA promo template SHALL be sendable from the collector photo prospecting flow in addition to the existing reviewer dashboard path. The send SHALL use the same `sendTemplateMessage` function and `getWhatsAppPromoTemplate()` configuration. No new template, no new API endpoint, and no dashboard changes are required for this path.

#### Scenario: Collector-triggered send uses same template as reviewer-triggered send

- **WHEN** a collector confirms a promo send via WhatsApp button reply
- **THEN** the system calls `sendTemplateMessage` with the same template name, language code, and image URL as the reviewer dashboard path
- **AND** the business receives an identical promo message regardless of which path triggered it

#### Scenario: Collector-triggered send failure is surfaced to the collector

- **WHEN** the WhatsApp API returns an error during a collector-triggered promo send
- **THEN** the collector receives a text reply indicating the send failed
- **AND** the pending entry is cleared so they may retry by sending a new photo
