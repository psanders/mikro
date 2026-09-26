## 1. Webhook and sending

- [x] 1.1 Webhook schema: optional `from`, `from_user_id`, `contacts[]`, shared-contact payload, `recipient_user_id`; per-message validation; both barrels
- [x] 1.2 Sender identity (address = phone else BSUID) in `handleWhatsAppMessage`; tests
- [x] 1.3 `addressFields` in the send client: `recipient` for a BSUID; `isBusinessScopedUserId` in `@mikro/common`; tests

## 2. Data

- [x] 2.1 `whatsappUserId`/`whatsappUsername` on Customer and LoanApplication, `whatsappUserId` on ConversationHandoff; migration + integration SCHEMA_SQL + common types
- [x] 2.2 `createLinkWhatsAppIdentity`, `createRecordSharedWhatsAppPhone`, lookups by BSUID; tests

## 3. Routing and hand-offs

- [x] 3.1 Router: BSUID path with the same status rules; `unmatchedUsername` guest; tests
- [x] 3.2 Unmatched username → hand-off + fixed acknowledgement, no LLM; tests
- [x] 3.3 Hand-offs store the BSUID and match phone OR BSUID; the abandon job checks both; tests
- [x] 3.4 Flow submission stores the BSUID and folds by BSUID; tests
- [x] 3.5 Chatwoot lookup for username contacts (username, then `source_id`); tests

## 4. Rejected applicants (founder decision 2026-09-26)

- [x] 4.1 Router: `reapplyFrom` for 30 days after a rejection; handler adds the reapply note to Lucía's input instead of a hand-off; tests + Lucía eval
- [x] 4.2 cx-role-based-agents spec + design D9 updated

## 5. Verification

- [x] 5.1 Suites: agents, apiserver, integration, common; dashboard/ctl typecheck; migration diff empty
- [x] 5.2 CX_EXPLAINER.md updated (cases L and M, monitoring)
- [ ] 5.3 Production: a username-only message produces a hand-off card + Chatwoot note; a known customer who hides their number still gets Carmen; `invalid webhook payload` no longer appears for username senders
