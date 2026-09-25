## Context

Inbound WhatsApp goes through `handleWhatsAppMessage` → `createMessageRouter` → a profile → the agent assigned in `agents.yaml`. Current state on `main` (v3.0.0):

- **Router** (`mods/agents/src/router/createMessageRouter.ts`): customer is checked first and returns `customer`, which the handler drops. A user maps to ADMIN or COLLECTOR only, so a REVIEWER-only user falls through to COLLECTOR. An unknown phone with an application becomes `prospect { partial }`; otherwise it becomes `guest`.
- **Handler**: a guest is answered only if a GUEST agent exists (none today). A prospect with `partial: false` gets the fixed "Tu solicitud ya está en revisión". ADMIN and COLLECTOR get fixed redirect texts.
- **José** (`handleProspectMessage`): in-memory session with a 7-turn cap, a stuck counter and a decline regex. `finalizeApplication("abandoned")` sets ABANDONED.
- **Follow-up jobs** (`mods/apiserver/src/follow-up`): NUDGE is scheduled when an application reaches RECEIVED. NUDGE schedules ABANDON (+`abandonDelayHours`, default 8). Since #291, ABANDON only acts on DRAFT. **Net effect: ABANDON never does anything, and DRAFTs are never timer-abandoned.**
- **`createGetApplicationByPhone`**: latest application by `createdAt`, returns `{ sessionId, partial }`.
- **Chatwoot**: the WABA fans inbound messages out to the Chatwoot app directly, and bot replies are echoed by the apiserver (`sendAndEchoToChatwoot`). Humans already see every conversation in Chatwoot.
- **Tools**: `listCustomerLoansByPhone`, `listPaymentsByLoanId`, `sendReceiptViaWhatsApp` and friends take the phone or ids from model arguments. That is fine for staff copilots, but unsafe for customer self-service.

Decisions already taken with the founder (2026-09-25): the "(OR" means OR hand off; one timer, 8h, anchored on the last message; "limited" = status + requested evidence + FAQ; employees go to Chatwoot with no reply.

## Goals / Non-Goals

**Goals:**

- One routing function that turns (user role | customer | application status) into a profile, with every CX profile served by a config-defined agent.
- Safe self-service: customer and applicant tools can only touch the sender's own records.
- A human escape hatch that persists across restarts and shows up where founders look (the feed).
- A working DRAFT abandon timer that reuses the existing knob.

**Non-Goals:**

- Calling the Chatwoot API (labels, assignment, private notes). The hand-off is visible in the feed, and the conversation is already in Chatwoot.
- A dashboard UI to open or close hand-offs. They expire on their own; manual close can follow later.
- Proactive outbound nudges to DRAFT prospects (a template plus the 24h-window question). This change only replies.
- Rewriting José's intake flow.

## Decisions

### D1. Purpose = profile; add `CUSTOMER` and `APPLICANT` to `profileEnum`

"Call the agent by purpose" maps directly onto the profile system that already exists (one agent per profile, resolved from `agents.yaml`, no names in code). Adding two profiles keeps that contract.
_Alternative:_ a separate `purpose` field on agents. Rejected: it duplicates profile resolution and adds a second identity.

### D2. Router order: user → customer → application status → guest

Employees who are also customers are routed as employees, which reverses today's order. Staff texting the business line are almost always doing staff things, and "no reply" is the safe default for them. The router receives `{ status, submittedAt, applicationId, sessionId }` from an extended `findApplicationByPhone` and applies the status table from the spec. REVIEWER gets explicit precedence (ADMIN > REVIEWER > COLLECTOR).

### D3. Reopen happens in the router path, not in a job

When the latest application is `ABANDONED` with `submittedAt == null`, the handler calls a new injected `reopenApplication(applicationId)`. It sets DRAFT and reschedules ABANDON through the same activity hook as D5, and then José runs. `submittedAt` is the discriminator because it is already stamped on the first complete submission and never cleared. That separates "timed out or declined as a draft" from "withdrew after approval". Reopening is skipped when replies are disabled (kill switch = no state changes caused by the conversation, apart from activity bookkeeping).

### D4. Context-bound "my" tools instead of reusing staff tools

New tools resolve identity from the `context` the handler passes (`phone`, `customerId`, `applicationId`) and ignore model-supplied identifiers:

- `listMyLoans`, `listMyPayments(loanId)` (the loan must belong to the context customer), `sendMyReceipt(paymentId)` (the payment's loan must belong to them; always sent to the context phone).
- `getMyApplicationStatus` returns only `{ stage, missingEvidence[] }`, with the stage mapped to plain words. The score, band, recommendation and reasons are never in the payload, so the model cannot leak what it never sees. This is enforced in code, not only in the prompt.
- `attachApplicationEvidence(kind)` attaches the image from the current turn. The handler passes it through context, never a model-supplied URL. It writes an `ApplicationDocument` with `uploadedById = "whatsapp:<phone>"` (the field is a plain string). The missing list comes from the empty cédula slots (`idFront*`/`idBack*`) plus `BUSINESS_PHOTO` count < `applications.minBusinessPhotos`.
  _Alternative:_ add a `phone` binding flag to the existing tools. Rejected: those tools serve the founder copilot and collectors, and mixing trust levels in one tool is how a scoping bug ships.

### D4b. Applicants add evidence only before a decision is in progress

Review evidence is otherwise editable only IN_REVIEW, by the assigned reviewer (`assertEvidenceWritable`), and is frozen once the application is sent to decision. The applicant path therefore writes directly (it is not a reviewer), but only while the application is `RECEIVED` or `IN_REVIEW`. In `PENDING_DECISION` or `APPROVED` the tool refuses, `missingEvidence` is empty, and the agent says the team will reach out. Found during implementation.

### D5. Activity hook reschedules ABANDON (one pending job per application)

A new `recordProspectActivity(applicationId)` in apiserver cancels any PENDING ABANDON for the application and creates one at `now + abandonDelayMs`. It is called:

- by the handler on every inbound message routed to PROSPECT, including when replies are disabled (activity is a fact, not a reply);
- by `createUpsertApplication` on `partial: true` writes.

NUDGE stops scheduling ABANDON, because it was always a no-op after #291. Nothing is added to `mikro.json`: `followUp.abandonDelayHours` already exists and defaults to 8 (see the mikro.json `.strict()` rollback hazard).
_Alternative:_ a periodic sweep over `DRAFT where updatedAt < now-8h`. Rejected: `updatedAt` also moves on staff edits and scoring writes, and there is already a job system with cancellation semantics.

### D6. Hand-off stored in DB, checked before routing

New model `ConversationHandoff { id, phone, profile, reason, applicationId?, customerId?, openedAt, expiresAt, closedAt? }` with an index on `(phone, closedAt)`.

- `requestHumanHandoff(reason)` is available to all CX agents. It opens or extends the hand-off and appends a `cx.handoff_requested` BusinessEvent. The agent's reply in that turn is the acknowledgement.
- A deterministic backstop regex (explicit "persona / humano / asesor / alguien" requests) opens the hand-off before the LLM runs and sends a fixed acknowledgement. Same pattern as José's `DECLINE_RE`.
- `handleWhatsAppMessage` checks for an open hand-off right after routing. If one exists, it extends `expiresAt` (+24h), records prospect activity if applicable, and returns without replying. Employees never reach this check (no reply anyway).
- The TTL is a code constant (24h). It is not config, to avoid the `.strict()` hazard, and it can be promoted to config later.
- The ABANDON handler defers while a hand-off is open for the application's phone: it reschedules to `expiresAt`.
  _Alternative:_ in-memory map like the session store. Rejected: a restart would un-silence the agent in the middle of a human conversation.

### D7. The in-memory history pattern stays per route

GUEST keeps the existing in-memory guest conversation. APPLICANT and CUSTOMER reuse the same phone-keyed in-memory store (via `conversations/`), with the same TTL semantics as guests. No new DB chat history. The `Message` table stays keyed to users (staff).

### D8. Employee path = silence

The ADMIN and COLLECTOR redirect texts are removed. A role with an assigned agent still gets that agent (existing behavior is kept for a custom ADMIN agent). No LLM call and no send for unassigned roles.

### D9. Rejected applicants who write again go to a person (founder decision 2026-09-25)

Nothing messages a person when their application is rejected, and the GUEST agent knows nothing about the decision (it would invite them to apply again). So the router flags a guest whose latest application is `REJECTED`, and the handler opens a hand-off with a fixed acknowledgement, without calling the LLM. A founder decides case by case in Chatwoot. _Rejected alternatives:_ a cooldown (a config value and an upsert change for a rare case), and a rejection notice at decision time (needs a new approved Meta template and a send path). Re-applying through the web form stays allowed.

### D10. Returning customers keep Carmen, who also follows their new application (founder decision 2026-09-25)

The customer match still wins, so balance and receipts keep working. When the customer's latest application is in the pipeline, the route carries its id and the CUSTOMER agent gets `getMyApplicationStatus` / `attachApplicationEvidence`, with the APPLICANT limits in its prompt. The tools already scope by the context's `applicationId`. _Rejected alternative:_ routing to APPLICANT while the application is open, which would lose loan answers for weeks.

## Risks / Trade-offs

- [The customer agent quotes a wrong balance] → The tools return the canonical snapshot the receipts use (`getCycleMetrics` / the loan statement path). The prompt forbids arithmetic ("only repeat numbers from tools"). Eval cases are added in `agents.yaml`.
- [The applicant agent leaks decision signals through phrasing ("se ve bien")] → The payload holds only the stage. The prompt forbids opinions. Eval cases assert no score, dates or odds.
- [The regex backstop misfires on "mi asesor me dijo…"] → Keep it tight: an imperative request form only ("quiero hablar con…", "pásame con…", "necesito un humano"). A false positive costs one silent day, which is recoverable. A false negative is covered by the LLM tool.
- [A hand-off silences someone nobody answers] → The feed event is the alert. The 24h expiry returns the phone to agents. A dashboard close/list UI can be added later if needed.
- [Reversing router precedence changes behavior for employee-customers] → Today they get nothing (customer = dropped), so there is no reply regression.
- [Removing the redirect texts surprises staff who still text the line] → Accepted by the founder decision; Chatwoot shows the message.
- [The APPLICANT/CUSTOMER agents cost LLM calls on traffic that used to be free] → The kill switch plus per-agent `enabled: false` give an instant off.
- [Schema change] → Prisma migration plus the hand-maintained integration `SCHEMA_SQL`. `@mikro/common`'s double barrel export needs the new profile values in both.

## Migration Plan

1. Ship the migration (a new table only, additive). Old releases ignore it, so rollback is safe.
2. Ship code with the new agents in `agents.yaml` as `enabled: false`. Routing and the timer fix go live, and the new profiles stay silent (same as today for guests and customers, minus the hold and redirect texts).
3. Enable GUEST → APPLICANT → CUSTOMER one at a time in `agents.yaml` and watch the feed and Chatwoot.
4. Rollback: set agents to `enabled: false`, or `whatsapp.agentRepliesEnabled: false` for a full stop. There is no config key to remove.

Existing DRAFTs have no ABANDON job. On deploy they only get one on their next activity. Optional: a one-off `ctl` backfill that schedules ABANDON for DRAFTs by `updatedAt`. It is left out unless asked, because old stale DRAFTs are already cleaned up by `applications:cleanup`.

## Open Questions

- The FAQ content for the GUEST and CUSTOMER prompts: coverage area, rates wording, office hours. It needs founder copy before those agents are enabled (it does not block building).
