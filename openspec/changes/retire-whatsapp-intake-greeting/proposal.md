## Why

We previously auto-greeted any unknown number that messaged the business line with the loan-application intake Flow button (the `guest_intake` path). We no longer want this: outreach is **outbound-only** (the promo template), and unknown numbers are answered **manually via an external application**. So an unknown inbound message should produce **no automated response at all** — no greeting, no notification, nothing.

## What Changes

- Remove the inbound **intake greeting / auto-send**: the `guest_intake` route, the Flow-button greeting (`buildIntakeFlowMessage`), the resend throttle, the `whatsapp.intakeFlow` config, and the `isIntakeEnabled` wiring.
- An unknown number now routes to `ignored` — the handler already does nothing for `ignored`, so the business line stays silent.
- **Keep** the Flow **submission** path intact (`processIntakeFlowSubmission` → `mapFlowAnswersToPayload` → `submitApplicationFromFlow` → `INTAKE_RECEIVED_MESSAGE`): the outbound promo's Flow CTA still produces `nfm_reply` submissions that must be ingested and phone-correlated.
- Rename `intakeFlow.ts` → `loanApplicationFlowSubmission.ts` (after the greeting is gone it holds only submission helpers).

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

<!-- none — the WhatsApp inbound greeting was never spec'd; this is code/config removal. The Flow-submission behavior (used by the promo) is unchanged. -->

## Impact

- **agents**: `router/createMessageRouter.ts` + `router/types.ts` (drop `guest_intake` + `isIntakeEnabled`); `whatsapp/handleWhatsAppMessage.ts` (drop greeting branch + throttle + imports); `whatsapp/intakeFlow.ts` → `loanApplicationFlowSubmission.ts` (drop greeting builder/constants); `config.ts` (drop `getWhatsAppIntakeFlow`); `index.ts` export.
- **common**: `config.ts` drops `whatsapp.intakeFlow` schema.
- **apiserver**: `index.ts` drops the `isIntakeEnabled` wiring.
- **config**: `mikro.json.example` + `mikro.json` drop the `whatsapp.intakeFlow` block.
- **tests**: remove greeting/throttle tests; keep submission tests (rename the file accordingly).
- **No behavior change to**: the outbound promo, the Flow submission ingestion, the public website intake, or any known-user agent routing.
