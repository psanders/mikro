## 1. Types and Constants

- [x] 1.1 Add `AGENT_JOSE = "jose"` constant to `mods/agents/src/constants.ts`
- [x] 1.2 Add `prospect` variant to `RouteResult` union in `mods/agents/src/router/types.ts`: `{ type: "prospect"; sessionId: string; partial: boolean; phone: string }`
- [x] 1.3 Add `findApplicationByPhone` optional dep to `RouterDependencies` in `mods/agents/src/router/types.ts`

## 2. Router

- [x] 2.1 In `createMessageRouter.ts`, after the existing user/customer checks and before the final `unknown` return, add a prospect lookup: call `findApplicationByPhone(e164phone)`, return `{ type: "prospect", sessionId, partial, phone }` if found
- [x] 2.2 Ensure customer/user routes are checked BEFORE the prospect lookup so existing routes remain zero-touch

## 3. José's Tools

- [x] 3.1 Create `mods/agents/src/agents/jose/tools/getApplicationState.ts` — fetches rawData + stable fields for a sessionId, computes filled/missing field list, runs `scoreInput({ ...fields, partial: false })`, returns snapshot including simulated ISC and any disqualifying flags (OUT_OF_ZONE, CRITICAL_BUSINESS)
- [x] 3.2 Create `mods/agents/src/agents/jose/tools/saveAnswer.ts` — validates one or more field key/value pairs against `applicationPayloadSchema`, calls the upsert endpoint with `partial: true`, returns `{ saved: string[]; invalid: string[] }`
- [x] 3.3 Create `mods/agents/src/agents/jose/tools/finalizeApplication.ts` — calls the upsert endpoint with `partial: false`, sends the closing WhatsApp message (with or without firstName per the spec), returns `{ finalized: true }`
- [x] 3.4 Export all three tools from `mods/agents/src/agents/jose/index.ts`

## 4. José Agent Definition

- [x] 4.1 Create `mods/agents/src/agents/jose/systemPrompt.ts` — Spanish system prompt defining José's persona, the qualifying-gates-first instruction, the score-simulation loop (check after every `saveAnswer`; if ISC ≥ 80, call `finalizeApplication` immediately), the stuck rule (4 turns without `saveAnswer` → finalize), and the capacity-first field ordering
- [x] 4.2 Wire José's `Agent` definition (model, tools array, system prompt) in `mods/agents/src/agents/jose/index.ts`
- [x] 4.3 Export `JOSE_AGENT` from the agents barrel so it can be used in the handler

## 5. Message Handler Wiring

- [x] 5.1 In `handleWhatsAppMessage.ts`, add a `prospect` branch: `partial: true` → run José agent with `handleProspectMessage`; `partial: false` → send hold message and return
- [x] 5.2 Create `mods/agents/src/whatsapp/handleProspectMessage.ts` — phone-keyed session lookup (reuse `isNewSession`/`touchSession`), invokes `JOSE_AGENT` with the message and conversation history, returns the LLM reply
- [x] 5.3 Pass `findApplicationByPhone` dep from `mods/apiserver/src/index.ts` into the router factory so the prospect lookup is wired end-to-end

## 6. Apiserver Wiring

- [x] 6.1 In `mods/apiserver/src/index.ts`, import `createGetApplicationByPhone` and pass the bound function as `findApplicationByPhone` in `RouterDependencies`
- [x] 6.2 Wire the tool implementations (`getApplicationState`, `saveAnswer`, `finalizeApplication`) with their apiserver deps (DB client, `upsertApplication`, `sendWhatsAppMessage`) and pass them to the José agent at startup; pass `joseAgent` to `setMessageProcessor`

## 7. Eval Scenarios

- [x] 7.1 Add `evaluations` block to José's `Agent` definition in `mods/apiserver/src/agents/jose.ts` with all 6 scenarios
- [ ] 7.2 Run `npm run agents:eval jose` and confirm all 6 scenarios pass (blocked: Anthropic key in mikro.json is stale — update before running)

## 8. Validation and Smoke Test

- [ ] 8.1 Verify existing routes (María, customer, collector) still pass their unit tests after router changes
- [ ] 8.2 Manual smoke test: send a WhatsApp message from a phone with a known partial application; confirm José responds with a qualifying question
- [ ] 8.3 Manual smoke test: send a WhatsApp message from an admin phone; confirm María responds as before
- [ ] 8.4 Manual smoke test: complete the José intake flow end-to-end; confirm application appears as `partial: false` in the dashboard with all collected fields
