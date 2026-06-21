## Why

Collectors already visit businesses daily to collect payments. Those businesses are high-quality loan prospects — visible, operating, physically nearby. Today that intelligence goes nowhere. This change turns each collector visit into a prospecting touchpoint: snap a photo, confirm the number, promo sent.

## What Changes

- Collectors can send a business photo via WhatsApp and trigger the existing intake Flow promo to the business's phone number, confirmed by a button tap
- Vision LLM extracts the phone number from the photo (first number found, validated to E.164)
- If the number is invalid, collector is asked to retake the photo
- If no image is sent, collector receives a brief "only photos" message
- New `"collector"` route type added to the message router (currently collectors are silently ignored)
- New `handleCollectorMessage` handler — deterministic state machine, no conversational LLM

## Capabilities

### New Capabilities

- `collector-photo-prospecting`: WhatsApp flow for collectors to photograph business storefronts, extract phone numbers via vision, confirm via button tap, and send the intake Flow CTA promo template to the extracted number

### Modified Capabilities

- `loan-application-promo-send`: Promo send is now triggerable from a second path (collector WhatsApp flow) in addition to the existing reviewer dashboard path. No requirement changes — same template, same `sendTemplateMessage` infrastructure, same Flow CTA format.

## Impact

- `mods/agents/src/router/` — new `"collector"` type in `RouteResult` union; `createMessageRouter` routes COLLECTOR users to it instead of `"ignored"`
- `mods/agents/src/whatsapp/handleWhatsAppMessage.ts` — new branch for `route.type === "collector"` dispatches to new handler; interactive `button_reply` messages from collectors routed through same path
- `mods/agents/src/whatsapp/handleCollectorMessage.ts` — new file; owns image processing, vision OCR, pending state, button send, and promo dispatch
- `mods/agents/src/whatsapp/client/sendMessage.ts` — needs interactive button message support (if not already present) for the confirmation step
- No new dependencies; reuses `invokeLLM` (vision purpose), `downloadMedia`, `sendTemplateMessage`, `getWhatsAppPromoTemplate`
