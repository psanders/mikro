## Why

WhatsApp is rolling out usernames. When a person uses one, Meta may hide their phone: the webhook then carries no `messages[].from`, only `from_user_id`, a business-scoped user ID (BSUID) such as `DO.1610031533916997`, plus `contacts[].profile.username`. Mikro required `from` on every message, so these messages failed validation and **the whole webhook delivery was dropped**, other people's messages in the same batch included. On 2026-09-26, Chatwoot showed six username contacts that Mikro had silently ignored, among them two real applicants: Orelby Garcia (IN_REVIEW, score 80) and Vladimir Parra (DRAFT, score 62).

## What Changes

- **Webhook:** messages are validated one by one. `from` is optional; `from_user_id`, `contacts[]` (`wa_id`, `user_id`, `profile.username`) and shared-contact payloads are parsed. Each message gets a sender identity: the address is the phone when present, else the BSUID.
- **Replies to a BSUID** use Meta's `recipient` field (`to` for phones). Every existing reply path works unchanged.
- **The BSUID and username are stored internally** on `Customer` and `LoanApplication` (new nullable, indexed columns; not shown anywhere). They're learned whenever a message carries both the phone and the BSUID, and when the sender shares their own number on request (`origin: "contact_request"`, e.g. asked from Chatwoot).
- **Routing:** a username-only sender is matched by BSUID to their customer or application and follows the same rules as a phone sender. **Unmatched username senders are handed to a person** (founder decision): hand-off with a fixed acknowledgement, no LLM.
- **Hand-offs** also store the BSUID, and match by phone OR BSUID, so they hold whichever way the person writes.
- **WhatsApp Flow submissions** from a username sender are tied to the application by BSUID, and fold into an existing linked application.
- **Chatwoot:** a username contact's conversation is found by scanning recent inbox conversations (by username, then the BSUID as `source_id`), because Chatwoot's search matches neither.
- Also included here (founder decision 2026-09-26, change `cx-role-based-agents`): **recently rejected applicants** are no longer handed off. For 30 days after the decision, the guest agent tells them when they may apply again.

## Capabilities

### New Capabilities

- `whatsapp-username-senders`: identifying, routing, replying to and remembering WhatsApp senders who reach us with a BSUID instead of a phone.

### Modified Capabilities

- (none archived yet: the CX routing spec lives in the open change `cx-role-based-agents`, updated in place for the rejected-applicant rule)

## Impact

- **mods/common:** webhook schemas (+ both barrels), `isBusinessScopedUserId`, optional `whatsappUserId`/`whatsappUsername` on the application and customer types.
- **mods/agents:** handler (sender identity, per-message validation, linking, shared contact, unmatched hand-off), router (BSUID lookups, reapply cooldown), send client (`recipient`), Flow mapper.
- **mods/apiserver:** migration `20260926120000_whatsapp_user_ids` (additive: nullable columns + indexes), identity link/lookups, hand-off matching, Flow submission, Chatwoot lookup, wiring.
- **No new mikro.json keys and no new Meta templates.** Rolling back to v3.3.x is safe: the new columns are ignored.
