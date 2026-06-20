## Why

Prospects who start a loan application on the website but abandon it before submitting are lost leads. With their phone number already in the system, a WhatsApp AI agent (José) can pick up the conversation, gather the remaining qualifying information conversationally, and deliver a complete, scoreable application to the reviewer team — without any manual follow-up from staff.

## What Changes

- **New WhatsApp intake agent "José"**: a dedicated conversational agent that activates when a known prospect (phone in a loan application) messages the business WhatsApp line. Completely separate from the existing Maria agent (admin-only); José only activates for prospects with a partial application.
- **Router: new `prospect` route type**: the message router adds a DB lookup for loan applications by phone. Partial application → José. Completed application → brief hold message. All existing routes (customer, user/ADMIN, user/COLLECTOR) are unaffected.
- **Qualifying-first conversation flow**: José leads with a small set of gates (province, business type, monthly sales) before asking remaining fields. Out-of-zone or critical-business prospects are declined gracefully rather than put through the full intake.
- **Score-aware early exit**: after each collected answer, José re-runs the scoring engine (pure, synchronous) against the current application with `partial: false`. If `isc >= 80`, José finalizes immediately rather than asking every remaining field.
- **Finalization**: when done (score ≥ 80, all fields gathered, or stuck), José marks the application `partial: false` via the existing upsert pipeline, sends a closing message that reflects working hours, and stops running intake for that number.
- **Closing message in Spanish reflecting working hours**: "¡Listo, [nombre]! Tu información está completa. Un asesor de Mikro la revisará y te contactará en horario laboral (lunes a viernes). Si nos escribes en fin de semana, responderemos el lunes. ¡Gracias!"

## Capabilities

### New Capabilities

- `whatsapp-intake-agent`: conversational AI agent José — routing, qualifying gates, field collection, score simulation, and finalization for prospect loan applications over WhatsApp.

### Modified Capabilities

- `loan-application-intake`: the WhatsApp channel becomes a second intake path alongside the website form; partial applications can now be completed conversationally. The upsert-by-sessionId pipeline and `partial` flag semantics are unchanged.

## Impact

- **`mods/agents`**: new agent constant `AGENT_JOSE`; new route type `prospect` in `createMessageRouter` and `types.ts`; new `handleProspectMessage` path in `handleWhatsAppMessage.ts`; new agent definition (system prompt, tools); new tool implementations (`getApplicationState`, `saveAnswers`, `finalizeApplication`).
- **`mods/apiserver/src/index.ts`**: wire `findLatestApplicationByPhone` and `getApplicationByPhone` into the message processor dependencies; expose `getApplicationState` and `finalizeApplication` tool implementations.
- **`mods/common`**: scoring engine unchanged (already pure); `APPLICATION_CONTENT_KEYS` and `scoreInput` reused as-is.
- **No DB schema changes**: all fields already exist on `LoanApplication`; José uses the existing `partial` flag and `upsertApplication`.
- **No dashboard changes**: reviewer sees the completed application exactly as if the prospect submitted via the website form.
