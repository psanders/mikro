# WhatsApp CX: what happens, case by case

A plain-language guide to how the WhatsApp number handles each kind of person: what happens, where to look to see it happening, which Meta templates are involved, what happens on rejections, and how each case is tested. The formal specs are in `openspec/changes/cx-role-based-agents/` and `openspec/changes/whatsapp-username-senders/`.

> **Status (2026-09-25):** the routing code is live in production since v3.2.0 (PR #294). The Chatwoot note on hand-offs is live since v3.3.0 (PR #295). Which agents actually answer depends on the `agents.yaml` file on the server (next to `mikro.json`), not on the release: deploys never update that file. An agent that is missing or `enabled: false` there means that audience gets no reply.

---

## 1. The one rule

When a WhatsApp message arrives, the server decides **who is writing**. That picks **one agent**, or nobody.

| Who is writing                     | How we know                                                                     | Who answers                          |
| ---------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------ |
| Staff (admin, reviewer, collector) | phone matches an enabled user                                                   | **Nobody.** You read it in Chatwoot. |
| Customer                           | phone matches a customer (a new application of theirs in review is attached)    | **Carmen**                           |
| Prospect with an unfinished form   | latest application is `DRAFT`                                                   | **José** (as today)                  |
| Prospect whose draft expired       | latest application is `ABANDONED` and was **never submitted**                   | the draft reopens, then **José**     |
| Applicant in review                | latest application is `RECEIVED`, `IN_REVIEW`, `PENDING_DECISION` or `APPROVED` | **Sofía**                            |
| Rejected applicant (last 30 days)  | latest application is `REJECTED`, decided less than 30 days ago                 | **Lucía**, with the reapply date (L) |
| Username sender we can't match     | no phone (WhatsApp username), no linked customer or application                 | **A person** (hand-off, case M)      |
| Everyone else                      | no application, withdrawn after approval, etc.                                  | **Lucía**                            |

The checks run in that order. For example, a collector who is also a customer is treated as staff.

**People who write with a WhatsApp username** (Meta hides their phone) are matched by an internal id stored on their customer and application records, then follow the same table. See case M.

Two things apply to everyone except staff:

- **Hand-off to a human.** If a hand-off is open for that phone, **no agent answers**. You answer from Chatwoot.
- **Kill switch.** `whatsapp.agentRepliesEnabled: false` in `mikro.json` means **no replies to anyone**.

---

## 2. Case by case

Each case lists what happens and how you can see it. Log lines are quoted exactly so you can search for them.

### A. A stranger writes ("¿qué necesito para un préstamo?")

1. They have no application → **Lucía** (GUEST).
2. She answers from the website FAQ (requirements, Puerto Plata only, how fast, bad credit, rates, data) in 1–3 sentences.
3. She ends by inviting them to fill out the form at `https://mikro.do/solicitud`.
4. **Exception:** if their business is outside Puerto Plata, she says so politely and does **not** send them to the form (it would be auto-rejected). She offers no waitlist and makes no promises.
5. She never collects form data in chat, and never promises amounts or approval.

**Monitor:** the conversation in Chatwoot. Nothing goes to the feed unless they ask for a person (case I).

### B. A prospect with an unfinished form writes

1. Latest application is `DRAFT` → **José**. He asks 2–3 fields per message and **submits early**: as soon as the estimated score reaches 50 or nothing is missing, and in any case by his 7th reply. "No me interesa" before submission abandons the draft.
2. **After submitting he keeps going** (openspec jose-keep-gathering). If fields are still missing, he confirms the application was received and offers, as optional, to complete it. He keeps asking while the person answers, with no turn cap. He stops when the form is complete, when the person declines (the application stays submitted, it's never abandoned), after 3 replies with nothing new, after 24h of quiet, when a reviewer takes it, or on a hand-off. He only replies; he never writes first.
3. **New:** every message they send before submission restarts the draft's **8-hour abandon clock** (case C).
4. **New:** if they are frustrated or ask for a person, José hands off (case I) instead of closing the application. The draft stays `DRAFT`.
5. **Outside Puerto Plata:** when José learns the province isn't covered, he says so and closes the application the way the web form does: `REJECTED` as a system decision (`OUT_OF_COVERAGE_AREA`), with the automatic "rechazada: fuera de zona" feed event. This applies to a draft or a submitted application nobody has taken yet; it never reaches the reviewers' queue.
6. He never tells someone their information is complete while fields are missing, even when the score lets him submit on a bare "Hola". His closing line promises no timing: "El equipo va a revisar tu solicitud y te avisa por aquí."

**Monitor:** Chatwoot. Log line: `prospect activity — ABANDON rescheduled`.

### C. A prospect goes quiet → draft abandoned after 8 hours

1. Each message from them, and each autosave of the web form, cancels the pending abandon timer and sets a new one for **now + 8h**. The 8h is `followUp.abandonDelayHours`, an existing setting.
2. If 8 hours pass with no activity, the timer fires and the draft becomes `ABANDONED`.
3. **Nothing is sent to the person.**
4. If a human hand-off is open for their phone when the timer fires, the draft is **not** abandoned. The timer moves to when the hand-off ends.
5. Submitted applications (`RECEIVED` and later) are **never** abandoned by a timer. A person has to act on them.

> Before this change, no draft was ever abandoned by the timer: it was dead code on `main`.

**Monitor:** logs `application auto-abandoned after stale window` and `ABANDON deferred — human hand-off open`. In the database: the `follow_up_jobs` table (type `ABANDON`).

### D. An abandoned prospect comes back

1. Latest application is `ABANDONED` **and was never submitted**. This covers both a timed-out draft and a draft where they said "no me interesa".
2. It goes back to `DRAFT`, the 8h clock restarts, and **José** continues from the fields still missing.
3. If it **was** submitted and later withdrawn (approved → withdrawn), it is **not** reopened. They are treated as a stranger (case A).

**Monitor:** log `abandoned draft reopened on prospect return`. The application shows as `DRAFT` again.

### E. A submitted applicant writes (`RECEIVED` or `IN_REVIEW`)

0. **Exception, José first:** a `RECEIVED` application with form fields still missing stays with **José** while intake is open. That means he replied within the last 24h, or, for a web-form applicant, it's their first message and nobody has talked with them since they submitted. José then answers status questions and takes photos with Sofía's tools and rules. Once intake closes (see case B, item 2), it's Sofía.
1. → **Sofía** (APPLICANT). The old fixed "Tu solicitud ya está en revisión" text is gone.
2. On her first reply she checks the application and says the stage in plain words: _recibida_ or _en revisión_.
3. If documents are missing (cédula front, cédula back, business photos below the configured minimum, 3 by default), she asks for them **one at a time**.
4. Business photos are asked for by name and count: "la 1 de 3: el frente del negocio por fuera" (Fachada), then the inside (Interior), then the goods or tools (Mercancía). Each photo is saved with that label, which the Ops evidence view shows.
5. When they send a photo, she attaches it to the application and asks for the next missing item. The exact same picture sent twice (or the cédula again as a business photo) is not attached; she asks for a different one.
6. **She can never say:** score, risk band, recommendation, reasons, who is reviewing, dates or timelines ("pronto", "24 horas"), or chances of approval. She cannot see them either: her tool only returns the stage and the missing list.
7. Anything else (change the amount, complaints, "¿por qué tarda?") → hand-off (case I).

**Monitor:** Chatwoot. Log `applicant attached evidence over whatsapp`. The photos appear in the application's evidence in the Ops app, uploaded by `whatsapp:<phone>`.

### F. An applicant writes while their application is with the decider (`PENDING_DECISION`) or `APPROVED`

1. Still **Sofía**. The stage is _en revisión_ or _aprobada_.
2. She **does not accept photos** anymore. The evidence is frozen once the application is sent to decision, so she says the team will reach out if anything is needed.

### G. A customer writes ("¿cuánto debo?")

1. → **Carmen** (CUSTOMER). Before this change, customer messages were silently dropped.
2. She can tell them about **their own** active loans (balance, cuota, cuotas paid, next payment date, late days, mora), using the same numbers as the receipts. She only repeats tool numbers and never calculates.
3. She can list their recent payments and **resend a receipt**, always to the phone that is writing.
4. She cannot touch anyone else's loan, even if they type another number or loan id. The tools ignore what the model passes and use the sender's identity.
5. She cannot record payments, give discounts or change dates. Anything like that → hand-off.
6. **Returning customer with a new application in review:** Carmen also follows it. She gives the plain stage and asks for missing documents one at a time, with the same limits as Sofía (no score, reasons, dates or odds). A new application still being filled out (`DRAFT`) is not attached; they finish it on the web form.

**Monitor:** Chatwoot. Resent receipts appear as normal receipt sends.

### H. Staff write to the number

1. **No automatic reply.** The old "Ahora puedes enviar promociones desde la app…" and "Ahora la asistencia… está en el dashboard" texts are gone.
2. The message still lands in Chatwoot (Meta sends it there directly).
3. If you someday assign an agent to ADMIN, REVIEWER or COLLECTOR in `agents.yaml`, it would answer them.

### I. Someone wants a person (the hand-off)

It can start two ways:

- **The person asks explicitly**: "quiero hablar con una persona", "pásame con un asesor", "necesito hablar con alguien". The server catches this **before** any AI runs and sends a fixed reply: _"Claro, ya le avisé al equipo. Una persona te va a responder por aquí lo antes posible."_
- **The agent decides**: frustration, or a request it can't handle. The agent calls the hand-off tool and says goodbye in one line.

Passing mentions do **not** trigger it, for example "mi asesor me dijo que pagara el lunes". If a prospect says "no me interesa" and asks for a person in the same message, the opt-out wins and José closes the application.

What happens next:

1. A **hand-off record** is saved in the database, so it survives restarts.
2. A **founder feed card** appears: type `cx.handoff_requested` with an amber headset icon. It says who (Visitante / Prospecto / Solicitante / Cliente) and why. It shows under the **Alertas** and **Mensajes** filters and counts as an alert.
3. **No agent answers that phone** while the hand-off is open. You reply from Chatwoot.
4. Every new message from them pushes the end of the hand-off 24h further out.
5. After **24h without a message from them**, the hand-off closes on its own and agents answer again.
6. There is no "close hand-off" button yet. It only expires.
7. **In Chatwoot**, the conversation gets a **private note** (only your team sees it) and the **`handoff` label**. The note says who is writing, the reason, the application stage or active loan numbers, and the agent's short summary; when no agent was involved (explicit request, rejected applicant) it shows the last messages instead.
8. **Who gets it** is decided in Chatwoot, not in Mikro: create the `handoff` label (Settings → Labels), then an automation rule (Settings → Automation: "Conversation updated", condition label = `handoff`, action assign to an agent or team). Change the person anytime there.

**Monitor:** the feed card, then Chatwoot. Logs `human hand-off opened`, `human hand-off extended` and `human hand-off open, agent stays silent`. In the database: the `conversation_handoffs` table.

### J. Kill switch off (`whatsapp.agentRepliesEnabled: false`)

- No replies to anyone and no AI calls.
- The prospect's 8h clock **still restarts** when they write, so going quiet doesn't make drafts expire.
- Form submissions through the WhatsApp Flow are still saved (as today).
- Abandoned drafts are **not** reopened while it's off.

### L. A rejected applicant writes again

1. Their latest application is `REJECTED`, and the decision was **less than 30 days ago** → **Lucía** answers, with a note she gets from the system: the application wasn't approved, and they may apply again from a date (decision + 30 days).
2. If they ask about their application or about reapplying, she says it wasn't approved and gives that date, with the form link. She **doesn't invite them to apply before then** and **doesn't explain the decision**. Other questions get normal FAQ answers.
3. **No hand-off**, unless they ask for a person (case I).
4. **After 30 days** they are a regular guest: Lucía answers as usual and invites them to apply.
5. The web form isn't blocked: someone could still reapply earlier on their own.

**Monitor:** Chatwoot. Changed on 2026-09-26: before this, every rejected applicant was handed to a person.

### M. Someone writes with a WhatsApp username (no phone)

WhatsApp now lets people use a username instead of showing their number. Meta then sends us an internal id instead of their phone: a "business-scoped user id", e.g. `DO.1610031533916997`. It's stable for that person with our business.

1. **We remember it.** Whenever a message comes with both the phone and that id (Meta shows the phone to businesses they've talked with in the last 30 days), Mikro stores the id and username on that person's customer and application records. It's internal and shown nowhere.
2. **Known person, number hidden:** matched by that id → same agent as case A–G (e.g. a customer still gets Carmen, an applicant Sofía). Replies go to the id; Meta delivers them.
3. **Unknown person, number hidden:** no AI answers. A hand-off opens (reason "Escribe con nombre de usuario, sin número"), with a feed card and a Chatwoot note showing `@username`. They get one fixed reply: _"Hola, gracias por escribirnos. Ya le avisé al equipo; una persona te va a responder por aquí."_
4. **If you ask them for their number in Chatwoot** (the "request contact info" option) and they share it, Mikro learns it too and fills it on their records.
5. **WhatsApp form submitted by a username sender:** the application is saved with that id (and no phone), so later messages still find it.

**Monitor:** feed card with that reason, then Chatwoot (the contact shows the username, no phone). Logs: `username sender matches no customer or application`, `whatsapp identity linked`, `username sender shared their phone`.

Before this change (up to v3.3.x), these messages were **silently dropped**, sometimes with other people's messages in the same delivery.

### K. Unchanged

The WhatsApp Flow intake and its confirmation, the generic error message, receipts, promos and payment confirmations all work as before.

Voice notes are transcribed (when configured) and handled like text. **Changed:** if a voice note can't be used, the "No puedo escuchar notas de voz" notice now follows the same rules as any reply. It is not sent during a hand-off or when no agent serves that person, and the voice note still counts as prospect activity.

---

## 3. Rejections: what is sent?

**Short answer: nothing is sent when an application is rejected, and this change does not add a rejection message.**

| How it gets rejected                                                          | Message to the person?                                                                                              |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Reviewer or admin rejects in the Ops app                                      | **No**                                                                                                              |
| Web form auto-rejects because the province is outside the coverage area       | **No**                                                                                                              |
| José declines in the chat (outside Puerto Plata, or a critical business type) | **Yes, but it's his in-chat reply** ("Por el momento solo atendemos negocios en Puerto Plata…"), not a notification |
| Applicant withdraws after approval                                            | **No**                                                                                                              |

**What happens if a rejected person writes later** (decided 2026-09-26): for 30 days Lucía tells them the application wasn't approved and when they may apply again; after that they are a regular guest. See case L. A person gets involved only if they ask for one.

Not chosen, for the record: blocking re-application in the form, and a rejection notice at the moment of rejection (that would need a new approved Meta template).

---

## 4. Meta templates

**This change adds no templates and sends no new templates.** Every CX message is a normal text reply.

Why that is safe: Meta lets a business send free text only within **24 hours of the person's last message**. Every CX reply is an **answer to a message the person just sent**. The server also discards incoming messages older than 60 seconds (`messageMaxAgeSeconds`), so a reply can never go out long after the question. The fixed hand-off reply is also an immediate answer.

Templates the system sends today, all unchanged by this change:

| Template (default name)                | When                                                      | Sent by                     |
| -------------------------------------- | --------------------------------------------------------- | --------------------------- |
| `loan_request_followup`                | 10 min after an application is **submitted** (`RECEIVED`) | follow-up worker (NUDGE)    |
| `loan_application` (with image)        | a reviewer chooses "send promo" on manual creation        | Ops app                     |
| `payment_confirmation`                 | after a payment is recorded                               | payments                    |
| `payment_reminder` / `payment_overdue` | reminders                                                 | **external app**, not Mikro |

Names come from `whatsapp.templates.*` in `mikro.json`. Your local file uses the defaults above.

Things to keep in mind:

- **The NUDGE no longer schedules a follow-up abandon.** It still sends exactly the same template at the same moment.
- **Human replies from Chatwoot after 24h** of the person's silence cannot be free text. Chatwoot will ask you for a template. Hand-offs expire at 24h for the same reason.
- `loan_request_followup` is a **MARKETING** template. Meta can silently drop marketing templates to cold numbers (the issue 85 finding). That problem exists today and this change doesn't touch it.
- There is **no automatic message to abandoned prospects**. Drafts go quiet silently.

---

## 5. Where to look (monitoring cheat sheet)

| You want to know…                  | Look at                                                                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Someone needs a person             | Founder feed → **Alertas** or **Mensajes** filter, headset card; then Chatwoot                                                                                     |
| What an agent said                 | Ops app → application → **Conversación · WhatsApp**; `mikro conversations:export`; Chatwoot (also has staff replies)                                               |
| Drafts being abandoned or reopened | apiserver logs: `application auto-abandoned after stale window`, `abandoned draft reopened on prospect return`                                                     |
| Photos applicants sent             | Ops app → application → evidence (uploader `whatsapp:<phone>`)                                                                                                     |
| Why someone got no reply           | logs: `no agent assigned to profile, ignoring` (agent off), `human hand-off open, agent stays silent`, `whatsapp agent replies disabled, ignoring inbound message` |
| Username senders (case M)          | logs: `username sender matches no customer or application`, `whatsapp identity linked`, `skipping unparseable whatsapp message`                                    |

Database checks (SQLite):

```sql
-- One phone's stored conversation (see section 5b)
SELECT created_at, role, profile, agent_name, content
FROM conversation_turns WHERE phone = '+18095551234' ORDER BY id;
```

```sql
-- Open hand-offs right now
SELECT phone, profile, reason, opened_at, expires_at
FROM conversation_handoffs
WHERE closed_at IS NULL AND expires_at > CURRENT_TIMESTAMP;

-- Drafts and when they will be abandoned
SELECT a.id, a.first_name, a.phone, j.scheduled_for
FROM follow_up_jobs j JOIN loan_applications a ON a.id = j.application_id
WHERE j.type = 'ABANDON' AND j.status = 'PENDING'
ORDER BY j.scheduled_for;
```

---

## 5b. Stored conversations (monitoring, evals, compliance)

Since issue #299 every CX message is stored in the `conversation_turns` table, not only in Chatwoot. That covers guests, prospects, applicants and customers. It includes messages the agents stayed silent on (open hand-off, agent off, kill switch). Staff chats are not in this table; they stay in `messages` as before.

- **One row per message.** `INBOUND` is the person. `AGENT` is an agent's reply, with the agent's name, a version hash and the tools it called (name + arguments, never the results). `SYSTEM` is a fixed reply the app sent (hand-off ack, voice-note notice, error message, intake confirmation).
- **Version hash** (`agent_version`): 12 characters derived from the agent's prompt, model, temperature, reply mode and tools. Editing an agent in `agents.yaml` changes it. Comparing conversations across versions is how you spot drift.
- **Images and voice notes** are not stored. An image is recorded as its caption (or `[Imagen]`) with `has_image = true`. A voice note is recorded as its transcription, or as `[Nota de voz]` when it could not be transcribed.
- **Agent memory reads from this table**, so a deploy no longer makes the bot forget, and doesn't make it introduce itself again: a new session is decided from the time of the last stored message.
  - The guest/applicant/customer agents remember the last 40 messages from the last 30 days, José's included, so Sofía picks up where his intake ended instead of greeting again.
  - José remembers his intake for that application since it was last reopened, including after he submits it. His "submit by the 7th reply" count survives restarts and starts over when an abandoned draft comes back.
- **Agents don't use names with customers.** They speak as "el equipo de Mikro Créditos" and sign their first reply of a conversation with their initials for the team's review: `^JO` José, `^SO` Sofía, `^LU` Lucía, `^CA` Carmen. A conversation here is the session: after a silence longer than the session timeout, the next reply is signed again. The sign-off is stored in the transcript but removed from what the model reads, so it never writes one itself.
- **Quick follow-ups get one reply.** A message without an image waits 2.5 seconds. If the same person sent another message meanwhile ("Ok", "Gracias"), only the newer one is answered, with both in the agent's history. Images are always answered: each one is evidence to attach.
- **Failed sends** (Meta rejected the reply) are stored with `failed = true`. They show as "No entregado" on the panel and `[NOT DELIVERED]` in the text export. The agents don't remember them, because the person never saw them.
- **Tool-only turns** (the agent ran a tool and said nothing) are stored with empty text. The panel doesn't draw them; the export includes them.
- **Where to see it:** Ops app → open an application → **Conversación · WhatsApp**. It shows everything stored for the applicant's phone, including chats from before they applied, and marks where a hand-off began. Replies your team types in Chatwoot are **not** stored; use the **Abrir en Chatwoot →** link for those. The link only appears when `chatwoot` is configured.
- **Export for evals** (ADMIN):
  - `mikro conversations:export --since 2026-09-01 > turns.jsonl` writes one JSON turn per line.
  - `--format conversations` writes one JSON conversation per phone per line.
  - `--format text` is for reading by eye.
  - Filters: `--phone`, `--application`, `--customer`, `--profile`, `--agent`, `--agent-version`, `--until`, `--limit`.
- **Retention:** kept until someone asks for deletion. There is no automatic expiry. To delete, run `mikro conversations:delete +18095551234` (ADMIN, asks for confirmation). It removes every stored message for that phone. It does not touch Chatwoot, hand-off records or applications; delete those separately if the request covers them.

## 5c. Conversation audit (automatic review of the stored conversations)

The stored conversations are reviewed automatically, on a schedule or when you ask. Each run looks for agent drift and misbehavior and posts one card to the feed.

- **What a run reviews:** the messages stored since the previous completed run. The first run looks back 24 hours. Each phone's messages count as one conversation. The AI judge also sees up to 20 earlier messages for context, but it never reports on them.
- **Fixed checks** (no AI, every conversation):
  - **Mensaje no entregado**: a send Meta rejected.
  - **Respondió con el mensaje de error**: handling a message failed and the generic error reply went out.
  - **Pidió una persona y no se traspasó**: an explicit request for a person with no hand-off within 10 minutes.
  - **Reveló el puntaje** (critical): a reply that states a score or band with a number.
- **AI judge:** reads each conversation against the serving agent's `policies` in `agents.yaml` and reports every rule it breaks, with the message quoted. It uses the `evals` model (the same one as `npm run agents:eval`). Editing policies does not change an agent's version hash.
- **Cap:** `maxConversations` is how many conversations the judge reads per run, most recent first. The rest get the fixed checks only, and the card says so.
- **Where to see it:** the feed card "Auditoría de conversaciones" says whether the conversations comply ("3 de 42 conversaciones no cumplen" in amber, or "las 37 conversaciones cumplen" in green). Expanded, it shows one status paragraph, written by the AI from the findings (a fixed template if that fails or when all comply), and **Ver detalle**, which opens every finding in the side panel with **Ver conversación** for each one. Agent versions stay on the findings, not on the card. It's under the **Mensajes** filter.
- **Run it now:** ask the copilot, e.g. "Corre la auditoría de conversaciones ahora". It works even when the schedule is off. Only one run at a time; a run stuck for more than 30 minutes is marked failed and a new one proceeds.
- **Turn on the schedule** in `mikro.json`:

  ```json
  "conversationAudit": { "enabled": true, "schedule": "0 7 * * *", "maxConversations": 200 }
  ```

  `schedule` is a cron expression in `timezone`. It's off by default. **Add this to prod only after the release that includes it is deployed**: `mikro.json` is strict, and an unknown key crashes the boot, including a rollback.

- **Stored:** runs in `conversation_audit_runs` and findings in `conversation_audit_findings`, both kept with the agent name and version.

---

## 6. How each case is tested

There are three layers:

1. **Automated unit and integration tests.** Run locally before each PR (CI doesn't run them yet); all pass today: agents 229, apiserver 596, integration 850.
2. **Agent evals.** A real AI model answers scripted conversations and a judge checks both the tool use and the answer. Run with `npm run agents:eval -- <agent>`.
3. **Manual staging smoke test** on a real WhatsApp. **Not done yet.** It's the one open task (6.3).

| Case                                                                              | Automated test                                                                                                                                                                                                | Eval                                                                                                                                                 | Manual (to do)                              |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Routing table (every status → agent, staff first, reviewer role)                  | `mods/agents/test/whatsapp/createMessageRouter.test.ts`                                                                                                                                                       | —                                                                                                                                                    | ✔                                           |
| A. Guest FAQ + form link                                                          | `handleCxMessage.test.ts` (routes to GUEST)                                                                                                                                                                   | Lucía: requirements, out-of-zone, asks for person — 3/3                                                                                              | ✔                                           |
| B. José + clock restart                                                           | `handleCxMessage.test.ts`, `createRecordProspectActivity.test.ts`                                                                                                                                             | José: existing 6 scenarios (5/6; the failing one fails on `main` too)                                                                                | ✔                                           |
| C. 8h abandon, deferred by hand-off, never for submitted                          | `createHandleAbandonJob.test.ts`, `scheduleOnUpsert.test.ts`, `createHandleNudgeJob.test.ts`                                                                                                                  | —                                                                                                                                                    | ✔ wait 8h (or set a short delay on staging) |
| D. Reopen / no reopen after withdrawal                                            | `createReopenApplication.test.ts`, `handleCxMessage.test.ts`                                                                                                                                                  | —                                                                                                                                                    | ✔                                           |
| E/F. Applicant stage, no leaks, photos only before decision                       | `selfService.test.ts` (checks no score, reasons or dates in the data), `handleCxMessage.test.ts` (photo passed through)                                                                                       | Sofía: status without dates, asks for missing doc, change amount → hand-off — 3/3                                                                    | ✔ send a real photo                         |
| G. Customer own loans only, receipt to sender, new application                    | `selfService.test.ts` (someone else's loan or payment → refused), `createMessageRouter.test.ts`, `handleCxMessage.test.ts` (application attached)                                                             | Carmen: balance, refuses brother's loan, resends receipt, new application status — behavior correct in all 4; wording judge is noisy (2–4/4 per run) | ✔                                           |
| L. Rejected applicant → reapply date (30 days)                                    | `createMessageRouter.test.ts` (cooldown on/off), `handleCxMessage.test.ts` (Lucía gets the note, no hand-off; asking for a person still hands off)                                                            | Lucía: recently rejected → reapply date, no reasons — 4/4                                                                                            | ✔                                           |
| M. WhatsApp username senders                                                      | `usernameSenders.test.ts` (identity, `recipient` sends, routing by id, unmatched → hand-off, shared phone, WhatsApp form), apiserver `whatsappIdentity.test.ts`, `handoffs.test.ts`, Chatwoot username lookup | —                                                                                                                                                    | ✔ with a real username account              |
| H. Staff silence                                                                  | `handleWhatsAppMessage.test.ts`                                                                                                                                                                               | —                                                                                                                                                    | ✔                                           |
| I. Hand-off (explicit phrases, passing mentions ignored, silence, 24h, feed card) | `handleCxMessage.test.ts`, `handoffs.test.ts`, integration feed test                                                                                                                                          | all three agents hand off in evals                                                                                                                   | ✔ incl. feed card                           |
| J. Kill switch                                                                    | `handleWhatsAppMessage.test.ts` (no reply, clock still restarts)                                                                                                                                              | —                                                                                                                                                    | ✔                                           |
| Meta templates unchanged                                                          | `createHandleNudgeJob.test.ts` (same template send, no abandon)                                                                                                                                               | —                                                                                                                                                    | ✔ watch no new template sends               |

**What the automated tests do not prove** (the manual checklist covers these):

- Real delivery through Meta, and the Chatwoot mirror.
- The real 24h window when a human replies late.
- Real AI answers vary between runs. Evals pass today, but wording drifts, so rerun them after any prompt change.

---

## 7. Open decisions for you

1. **FAQ copy**: Lucía and Sofía use the website FAQ text. Please read it in `agents.yaml` before turning them on.
2. **Agent names**: Lucía, Sofía and Carmen are placeholders. Rename freely.
3. **Turn-on order**: GUEST → APPLICANT → CUSTOMER, one at a time, watching the feed and Chatwoot.

Decided: returning customers keep Carmen, who also follows their new application (case G, 2026-09-25); rejected applicants get their reapply date from Lucía, no hand-off (case L, 2026-09-26); unknown username senders go to a person (case M, 2026-09-26).
