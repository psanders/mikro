## 1. Schema & Types

- [x] 1.1 Add `button_reply` field (`{ id: string; title: string }`) to `whatsappInteractiveSchema` in `mods/common/src/schemas/whatsapp.ts`
- [x] 1.2 Add interactive reply-button send params to `SendWhatsAppMessageInput` in `@mikro/common` (e.g. `replyButtons` field: `{ bodyText: string; buttons: Array<{ id: string; title: string }> }`)

## 2. WhatsApp Client — Reply Button Send

- [x] 2.1 Add reply-button branch to `sendMessage` in `mods/agents/src/whatsapp/client/sendMessage.ts` that builds the `interactive/button` request body from the new `replyButtons` field

## 3. Message Router

- [x] 3.1 Update `createMessageRouter` in `mods/agents/src/router/createMessageRouter.ts`: skip the `getAgentForProfile` gate for the COLLECTOR profile so enabled COLLECTOR users always return `{ type: "user", role: "COLLECTOR" }` (the handler, not an LLM agent, serves them)

## 4. Collector Handler

- [x] 4.1 Create `mods/agents/src/whatsapp/handleCollectorMessage.ts` with `pendingPromos` in-memory map (5-min TTL) and `handleCollectorMessage(phone, message, imageUrl, deps)` function signature
- [x] 4.2 Implement image branch: call vision LLM with extract-first-phone prompt, validate E.164 via `validatePhone`, store pending or reply with appropriate error message
- [x] 4.3 Implement button-reply branch: look up pending, send promo via `sendTemplateMessage` + `getWhatsAppPromoTemplate` on "yes", cancel on "no", handle expired/missing pending
- [x] 4.4 Implement fallback branch for non-image, non-button messages: reply "Solo puedo ayudarte a enviar el promo. Envíame una foto del negocio."

## 5. Message Processor Wiring

- [x] 5.1 Add `sendTemplateMessage` to `MessageProcessorDependencies` in `mods/agents/src/whatsapp/handleWhatsAppMessage.ts`
- [x] 5.2 Add COLLECTOR dispatch branch in `processMessage`: before the `getAgentForProfile(route.role)` LLM block, detect `route.type === "user" && route.role === "COLLECTOR"` and call `handleCollectorMessage`; pass the resolved `imageUrl` and `message.interactive?.button_reply` where relevant

## 6. Tests

- [x] 6.1 Unit-test `handleCollectorMessage`: image with valid number → button message sent + pending stored
- [x] 6.2 Unit-test `handleCollectorMessage`: image with no number → error reply, no pending
- [x] 6.3 Unit-test `handleCollectorMessage`: button "yes" with pending → promo sent, pending cleared
- [x] 6.4 Unit-test `handleCollectorMessage`: button "no" with pending → no promo, pending cleared
- [x] 6.5 Unit-test `handleCollectorMessage`: button reply with expired/missing pending → no-pending reply
- [x] 6.6 Unit-test `handleCollectorMessage`: non-image non-button → guidance reply
- [x] 6.7 Update `createMessageRouter` tests: COLLECTOR with no agent assigned now routes to `{ type: "user", role: "COLLECTOR" }` instead of `"ignored"`
