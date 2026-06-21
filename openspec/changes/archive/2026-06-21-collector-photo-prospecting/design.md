## Context

Collectors are registered users with the `COLLECTOR` role. Since the externalize-agent-config change, agents are defined in `agents.yaml` and keyed by **profile** (`ADMIN`, `COLLECTOR`, `REVIEWER`, `PROSPECT`, `GUEST`) — not by hardcoded name. The router now calls `getAgentForProfile(primaryRole)` and returns `{ type: "ignored" }` when no agent is assigned, so COLLECTOR messages are currently ignored before reaching `processMessage`. The infrastructure already has: vision LLM (`"vision"` purpose), `downloadMedia`, `sendTemplateMessage`, and `getWhatsAppPromoTemplate()` (the intake Flow CTA template). The WhatsApp incoming message schema supports `type: "interactive"` but only parses `nfm_reply`; `button_reply` is not yet parsed.

## Goals / Non-Goals

**Goals:**

- Route COLLECTOR messages to a new deterministic handler instead of ignoring them
- Handle the image → vision OCR → confirm button → promo send flow
- Reuse 100% of the existing promo send path (`getWhatsAppPromoTemplate` + `sendTemplateMessage`)
- Keep the new handler stateless except for a simple in-memory pending map

**Non-Goals:**

- No conversational LLM for collectors — this is a state machine, not an agent
- No persistence of pending state — in-memory only; a restart clears it (acceptable)
- No UI changes in the dashboard
- No new WhatsApp templates — reuse the existing intake Flow CTA

## Decisions

### 1. Reuse `{ type: "user", role: "COLLECTOR" }` — no new route type

`RouteResult` already has `{ type: "user"; role: Role }`. No new type needed. The change is in the router: remove the `getAgentForProfile` gate **for the COLLECTOR profile only**, so enabled COLLECTOR users always return `{ type: "user", role: "COLLECTOR" }` regardless of whether an agent is assigned in `agents.yaml`. The handler in `processMessage` dispatches COLLECTOR to `handleCollectorMessage` before reaching the `getAgentForProfile` LLM branch.

**Alternative considered:** Add a dedicated `{ type: "collector" }` to `RouteResult`. Rejected — unnecessary type proliferation; COLLECTOR is already a first-class user role and `processMessage` can branch on `route.role`.

**Why remove the gate in the router?** The router's `getAgentForProfile` check was designed to gate LLM-agent flows. The collector flow is deterministic — it has no LLM agent. Keeping the gate would force adding a dummy agent to `agents.yaml` or coupling the router to handler implementation details. The router should answer "who sent this?", not "is there an LLM for them?"

### 2. Dedicated `handleCollectorMessage.ts` — no agent

The flow is fully deterministic:

```
image received
  → downloadMedia → vision LLM (extract number, no chat history)
  → valid E.164?
      yes → send button confirmation + store pending_promos[collectorPhone]
      no  → "No pude leer el número, toma otra foto"
  → no number detected
      → "No vi ningún número, toma otra foto"

interactive/button_reply received
  → lookup pending_promos[collectorPhone]
    yes:
      button_reply.id === "yes" → sendTemplateMessage(getWhatsAppPromoTemplate(), targetPhone)
                                   clear pending, confirm to collector
      button_reply.id === "no"  → "Ok, no envié nada"
                                   clear pending
    no pending:
      → "No hay nada pendiente"

non-image, non-button message
  → "Solo puedo ayudarte a enviar la promo. Envíame una foto del negocio."
```

**Alternative considered:** Route collectors to a new LLM agent. Rejected — overkill; OCR + state machine is simpler, faster, and cheaper.

### 3. Vision extraction via a single `invokeLLM` call (vision purpose)

The existing `invokeLLM` dep already accepts an `imageUrl` parameter and uses the `"vision"` LLM config. We call it with a minimal system prompt: extract the first phone number from the image as a raw digit string, return "NONE" if not found. No chat history passed (stateless per image).

### 4. In-memory `pending_promos` map with 5-minute TTL

```typescript
// collectorPhone → { targetPhone, expiresAt }
const pendingPromos = new Map<string, { targetPhone: string; expiresAt: number }>();
const PENDING_TTL_MS = 5 * 60 * 1000;
```

Pruned on every access. If the collector doesn't tap within 5 minutes, the entry expires and a subsequent button tap gets "no hay nada pendiente."

**Alternative considered:** Persist in DB. Rejected — unnecessary complexity for a confirmatory tap that should happen within seconds.

### 5. Button confirmation sent as WhatsApp interactive `reply_buttons` message

WhatsApp supports interactive messages with up to 3 reply buttons. We send:

```json
{
  "type": "interactive",
  "interactive": {
    "type": "button",
    "body": { "text": "Encontré el número *+1XXXXXXXXXX*. ¿Envío el promo?" },
    "action": {
      "buttons": [
        { "type": "reply", "reply": { "id": "yes", "title": "Sí, enviar" } },
        { "type": "reply", "reply": { "id": "no", "title": "No" } }
      ]
    }
  }
}
```

This requires a new branch in `sendMessage.ts` (interactive reply buttons) and a new field on `SendWhatsAppMessageInput` in `@mikro/common`.

### 6. `button_reply` parsed in `whatsappInteractiveSchema`

Add `button_reply` to the schema:

```typescript
const whatsappButtonReplySchema = z.object({ id: z.string(), title: z.string() });
// added to whatsappInteractiveSchema:
button_reply: whatsappButtonReplySchema.optional();
```

`button_reply` arrives as `type: "interactive"` with `interactive.type === "button_reply"`. The existing `nfm_reply` check in `processMessage` already gates on `interactive.nfm_reply` being present, so adding `button_reply` parsing doesn't break it.

### 7. Multiple numbers — first only; invalid — ask to retake

The vision prompt instructs: "Return only the first phone number found." If the returned string fails `validatePhone()` (from `@mikro/common`), reply asking to retake the photo. This keeps the flow simple and avoids presenting a list to tap.

## Risks / Trade-offs

- **Vision OCR accuracy** → The model may misread numbers (e.g. 0/8, 1/7 confusion). Mitigation: the collector sees the extracted number in the confirmation message and can decline ("No") and retake.
- **Pending state lost on restart** → In-memory only; a server restart during the 5-minute window means the collector must retake the photo. Acceptable given the short TTL.
- **Collector sends non-image first** → They get the "solo fotos" message. Clear enough.
- **Business phone already a customer** → We send the promo regardless. The intake Flow on the receiving end handles duplicates (existing `loan-application-promo-send` spec: Flow completion updates existing app). No additional check needed here.
- **WhatsApp rate limits on button messages** → Button confirmation is one extra message per prospecting event. Volume is low (collectors, not mass blast). Not a concern.

## Migration Plan

Deploy is additive — no schema migrations, no breaking changes. New route type and handler are dead code until a COLLECTOR user sends a message. Rollback: revert the `createMessageRouter` change to return `"ignored"` for COLLECTOR; the handler and pending map become unreachable.

## Open Questions

- Should the confirmation message show the number with or without country code prefix? (Recommendation: always show E.164 with `+` so the collector can visually verify.)
- What exact Spanish copy for "promo sent" confirmation? (Recommendation: "¡Listo! Envié el promo a _+XXXXXXXXXXX_.")
