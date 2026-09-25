## Why

The WhatsApp line only really talks to one audience today: José (the PROSPECT profile) finishes DRAFT applications. Everyone else gets a canned line or nothing. Guests are ignored (no GUEST agent), a submitted prospect always gets "Tu solicitud ya está en revisión", customers are dropped silently, and employees get fixed redirect text. A stuck or frustrated person never reaches a human. The DRAFT abandon timer is also dead code: after #291 the ABANDON job only acts on a DRAFT, but it is only ever scheduled from the NUDGE, and that runs for RECEIVED applications. So no DRAFT is ever abandoned by a timer. This is the CX half of the "Mikro Flow" plan (2026-09-23), and it builds on the application state machine from #291.

## What Changes

- Route each inbound WhatsApp message to an agent by **purpose**. Purpose comes from the sender's role plus their latest application's status: guest, onboarding (DRAFT), in-pipeline applicant (RECEIVED → APPROVED), customer, employee.
- New **GUEST** agent: answers the FAQ and pushes the guest to fill out the solicitud (guest → prospect).
- New **APPLICANT** profile and agent for prospects in the pipeline. It is limited to a plain-language status, collecting the evidence still missing (cédula images, business photos) and the FAQ. It never reveals score, reasons, timelines or approval odds.
- New **CUSTOMER** profile and agent. It covers the sender's own loans only (status, balance, receipts) plus the FAQ. Customer tools take the phone from the conversation context, never from the model's arguments.
- **Hand-off to a human** from every CX agent (GUEST, PROSPECT, APPLICANT, CUSTOMER). It fires on frustration, on an explicit request for a person, or when the agent is stuck. It records a hand-off, posts a founder-feed event, and keeps agents silent for that phone while the hand-off is open. The human replies in Chatwoot.
- **Employees** (ADMIN, COLLECTOR, REVIEWER) get no agent reply. Their messages already reach the Chatwoot inbox through the WABA fan-out. **BREAKING (behavior)**: the canned ADMIN/COLLECTOR redirect texts are removed. REVIEWER is now routed as REVIEWER; today it falls through to COLLECTOR.
- **Abandon timer anchored on the prospect's last activity.** Each inbound message or form autosave on a DRAFT (re)schedules one ABANDON job at `followUp.abandonDelayHours` (default 8h). This reuses the existing knob and adds no new config. The NUDGE no longer schedules a no-op ABANDON.
- **Reopen on return.** A never-submitted application that was ABANDONED returns to DRAFT when the prospect writes again, and José picks it up. An application that was submitted and then withdrawn is not reopened.
- The canned "en revisión" hold message and the silent customer drop are replaced by agent replies. `whatsapp.agentRepliesEnabled: false` still silences everything.

## Capabilities

### New Capabilities

- `whatsapp-cx-routing`: purpose-based routing of inbound WhatsApp messages (role + application status → profile), employee pass-through, and the kill-switch interaction.
- `whatsapp-cx-agents`: what each CX agent may and may not do (GUEST, APPLICANT, CUSTOMER), including own-data scoping and the applicant's disclosure limits.
- `whatsapp-human-handoff`: detecting hand-off conditions, recording an open hand-off, silencing agents while it is open, and letting the hand-off expire.

### Modified Capabilities

- `agent-configuration`: the profile set gains `CUSTOMER` and `APPLICANT`; routing maps customers, in-pipeline applicants and REVIEWER users to their profiles.
- `loan-application-follow-up-timers`: DRAFT ABANDON is scheduled from the last prospect activity, the NUDGE stops scheduling ABANDON, and the ABANDON handler acts on DRAFT (the spec still says RECEIVED).
- `loan-application-prospect-intake`: an ABANDONED, never-submitted application reopens to DRAFT when the prospect writes again; José can hand off to a human.

## Impact

- **mods/common**: `profileEnum` gains `CUSTOMER` and `APPLICANT`; there is a new hand-off type. Mind the double barrel export (see the schema-change gotchas).
- **mods/agents**: the router (`createMessageRouter`, `RouteResult`), `handleWhatsAppMessage` (customer, applicant and employee paths), `handleProspectMessage` (hand-off backstop), new tools (`getMyApplicationStatus`, `attachApplicationEvidence`, `listMyLoans`, `listMyPayments`, `sendMyReceipt`, `requestHumanHandoff`), and a context-bound phone in the tool executor.
- **mods/apiserver**: `createGetApplicationByPhone` returns status and `submittedAt`; new `ConversationHandoff` model plus migration (and the integration-test `SCHEMA_SQL`); follow-up job scheduling changes; a new `cx.handoff_requested` business event type in the founder feed.
- **agents.yaml**: three new agent entries (GUEST, APPLICANT, CUSTOMER); José gains `requestHumanHandoff`.
- **mikro.json**: no new keys (a key that lands before its release crashes rollback). The hand-off TTL is a code constant.
- **Out of scope**: Chatwoot API calls (labels/assignment), a dashboard UI for hand-offs, and changes to the NUDGE template.
