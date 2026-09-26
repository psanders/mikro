## Context

Meta's rules (docs, 2026): a phone is still included when we exchanged messages or calls with the user in the last 30 days (per business number), or they're in our contact book. Otherwise the webhook has only the BSUID and the username. The BSUID is stable per user for our business portfolio. Sending to a BSUID uses `recipient` (all message types except authentication templates). A user answering a contact-info request produces a `type: "contacts"` message with `origin: "contact_request"` and their phone.

Chatwoot (checked 2026-09-26) stores a username contact with no phone. The BSUID is the contact's inbox `source_id`; the username is in `additional_attributes.social_whatsapp_user_name`. The contact search endpoint matches neither.

## Decisions

- **Address = phone, else BSUID.** Sessions, hand-offs and replies key on one string. The send client picks `recipient` for the BSUID shape (`^[A-Z]{2}\.[A-Za-z0-9]+$`), so no caller changes.
- **Store on the rows, not an identity table** (founder request). `whatsappUserId`/`whatsappUsername` on `Customer` and `LoanApplication`, internal only. Linking is an idempotent `updateMany` (only rows not already holding this BSUID), fired without awaiting the reply.
- **Unmatched username senders → a person** (founder decision), not a "share your phone" button. Without a phone the agents can't look anything up. If a person in Chatwoot asks for the number, the shared contact reaches Mikro too and fills it.
- **Only `origin: "contact_request"` is trusted** as the sender's own phone; `"other"` may be a third party's card.
- **Hand-offs match phone OR BSUID**, and store both.
- **Per-message validation:** an unknown message shape is skipped and logged, never fatal to the delivery.
- **Chatwoot lookup scans** the 2 most recent pages of inbox conversations. The person just wrote, so theirs is near the top. It matches the username first, then the contact's `source_id`. Best-effort as before.
- **Staff aren't matched by BSUID:** their numbers are normally visible (contact book).

## Risks / Trade-offs

- [A username sender with an application but no phone on it] → Agents still work by BSUID. Reviewers can't call; Chatwoot is the channel. A shared contact fills the phone.
- [The Chatwoot scan misses a conversation beyond 2 pages] → Rare (the conversation just had activity); the note and mirror are skipped and logged.
- [The same person has a phone-keyed and a BSUID-keyed José session] → Only across the moment Meta stops showing the phone; the application is the same.
