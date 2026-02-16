# WhatsApp Agent Performance Optimizations

Branch: `perf/whatsapp-agent-optimizations`

These changes improve perceived latency of the WhatsApp agent. Each improvement is committed separately so you can revert individual changes if needed.

## Revert Instructions

- **Revert a single commit:** `git revert <commit-hash> --no-edit`
- **Revert entire branch:** `git checkout main` then `git branch -D perf/whatsapp-agent-optimizations`, or merge with a revert commit.

## Changes (in commit order)

| #   | Description                                             | Files                                                                     | Revert                         |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------ |
| 1   | Add PERF_NOTES.md (this file)                           | `PERF_NOTES.md`                                                           | N/A (metadata only)            |
| 2   | Remove 500ms artificial delay in receipt sending        | `mods/apiserver/src/api/receipts/createSendReceiptViaWhatsApp.ts`         | `git revert 99e2f03 --no-edit` |
| 3   | Parallelize getMemberByPhone + getUserByPhone in router | `mods/agents/src/router/createMessageRouter.ts`                           | `git revert 0e858b8 --no-edit` |
| 4   | Parallelize addMessageForUser + sendWhatsAppMessage     | `mods/agents/src/whatsapp/handleWhatsAppMessage.ts`                       | `git revert e63ae1d --no-edit` |
| 5   | Return 200 OK immediately from webhook, process async   | `mods/apiserver/src/index.ts`                                             | `git revert e8abcaf --no-edit` |
| 6   | Overlap media download with message routing             | `mods/agents/src/whatsapp/handleWhatsAppMessage.ts`                       | `git revert 9ffe66d --no-edit` |
| 7   | Message ID deduplication with TTL                       | `mods/agents/src/whatsapp/handleWhatsAppMessage.ts`                       | `git revert 266bb93 --no-edit` |
| 8   | Condense Maria and Juan system prompts                  | `mods/apiserver/src/agents/maria.ts`, `mods/apiserver/src/agents/juan.ts` | `git revert d278dde --no-edit` |

## Expected Impact

- **2:** ~500ms saved per payment+receipt flow
- **3:** ~30–80ms saved per message (one fewer DB round-trip)
- **4:** ~30–200ms saved per message (save + send in parallel)
- **5:** Prevents WhatsApp timeout retries and duplicate processing
- **6:** ~50–200ms saved for image/audio messages
- **7:** Prevents duplicate LLM runs on duplicate webhooks
- **8:** ~50–100ms per LLM call, lower token cost
