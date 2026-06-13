## Why

The `payment_reminder` and `payment_overdue` WhatsApp template names linger in config but are **dead in this repo**: they are not in the config schema, nothing reads them, and there are no routes/webhooks/jobs that send them. They were sent by an external application that talks to Meta directly, not through Mikro. Carrying them in our config files is misleading. `payment_confirmation` (`payment_receipt`) is **kept** — we intend to implement receipt-template sends later.

## What Changes

- Remove the `paymentReminder` and `paymentOverdue` keys from `mikro.json.example` and the local `mikro.json`.
- No code changes: these keys are not part of `whatsappTemplatesSchema` and are not referenced anywhere (Zod already strips them at load).
- Keep `paymentConfirmation` (`payment_receipt`) for a future receipt-template implementation.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

<!-- none — config-only cleanup; no spec/requirement-level behavior changes. -->

## Impact

- **Config**: `mikro.json.example` and `mikro.json` lose two dead keys.
- **No code, schema, API, webhook, or test changes** — confirmed by a repo-wide sweep (the only references were the two example keys).
- **No behavior change**: nothing sent these templates; the external app is unaffected (it addresses Meta directly).
