## Context

José runs as a `replyMode: final` agent over WhatsApp. `handleProspectMessage` owns per-phone session state and can inject `[SISTEMA: ...]` directives into the user message before invoking the LLM — the same mechanism already used for the stuck timer and the 7-turn cap. The closing message is José's own reply text; `finalizeApplication` only persists (it no longer sends a WhatsApp message). These two facts shape the design.

## Decisions

### Decision: Reuse the existing `ABANDONED` status rather than invent `WITHDRAWN`

`loan-application-model` already declares an `ABANDONED` terminal value; the Prisma enum had drifted and lacked it. Adding a second near-synonym (`WITHDRAWN`) would fragment the vocabulary. `ABANDONED` cleanly covers both an explicit decline and a silent drop-off.

- **Alternative considered**: distinct `DECLINED`/`WITHDRAWN` for active opt-out vs. `ABANDONED` for timeout. Rejected — the ops distinction isn't worth a new enum value; both are "prospect did not complete." Can be split later if review needs it.

### Decision: `outcome` argument on `finalizeApplication`, not a new tool

The model already calls `finalizeApplication` to close out. A single `outcome` enum (`complete` | `abandoned`) keeps the tool surface small and lets the existing call sites stay. `abandoned` short-circuits to a direct status update (`update where id`, set `ABANDONED`) and skips the scoring/`RECEIVED` upsert that `complete` runs — an abandoned lead should not be re-scored or marked received.

### Decision: Deterministic decline detector as a backstop, LLM as primary

The LLM handles soft/ambiguous declines conversationally. But behavior must not depend on the model: a regex detector in `handleProspectMessage` injects a forcing directive on unambiguous phrases so the abandon path is reliable. The regex is intentionally tight (requires a clear withdrawal phrase, not a bare "no") to avoid closing a conversation when the prospect answers "no" to "¿tienes RNC?".

### Decision: Directive precedence — decline > turn cap > stuck

A decline ends the conversation as `abandoned` no matter where it lands, including on the final turn (so a turn-7 "no me interesa" is `abandoned`, not `complete`). The 7-turn cap stays `complete` (engaged prospect, real data). The 3-turn stuck timer now resolves to `abandoned` (no useful answers = abandonment), fixing the prior mislabel.

## Risks / Trade-offs

- **False positives** on the decline regex would prematurely close a willing prospect. Mitigated by the tight phrase list and a unit test asserting plain "no" is not a decline. If a false positive surfaces, narrow the regex — the LLM directive only fires on a match.
- **`prisma generate` required**: the generated client must be regenerated for the new enum value before deploy. No SQL migration (SQLite TEXT columns).
- **Re-engagement**: an `ABANDONED` phone that messages again routes to GUEST, not back into José. Acceptable for now; revisit if prospects ask to resume.
