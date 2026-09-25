# WhatsApp CX: what happens, case by case

A plain-language guide to the `cx-role-based-agents` change. It covers what the WhatsApp number does for each kind of person, where to look to see it happening, which Meta templates are involved, what happens on rejections, and how each case is tested.

> **Status (2026-09-25):** built on branch `feat/cx-role-based-agents`, not deployed. The three new agents (Lucía, Sofía, Carmen) ship **turned off**. Until you turn one on, that audience gets no reply, which is the same as today.

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
| Rejected applicant                 | latest application is `REJECTED`                                                | **A person** (hand-off, case L)      |
| Everyone else                      | no application, withdrawn after approval, etc.                                  | **Lucía**                            |

The checks run in that order. For example, a collector who is also a customer is treated as staff.

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

1. Latest application is `DRAFT` → **José**, exactly as today (short intake, 7-turn cap, "no me interesa" closes it).
2. **New:** every message they send restarts the draft's **8-hour abandon clock** (case C).
3. **New:** if they are frustrated or ask for a person, José hands off (case I) instead of closing the application. The draft stays `DRAFT`.

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

1. → **Sofía** (APPLICANT). The old fixed "Tu solicitud ya está en revisión" text is gone.
2. On her first reply she checks the application and says the stage in plain words: _recibida_ or _en revisión_.
3. If documents are missing (cédula front, cédula back, business photos below the configured minimum, 3 by default), she asks for them **one at a time**.
4. When they send a photo, she attaches it to the application and asks for the next missing item.
5. **She can never say:** score, risk band, recommendation, reasons, who is reviewing, dates or timelines ("pronto", "24 horas"), or chances of approval. She cannot see them either: her tool only returns the stage and the missing list.
6. Anything else (change the amount, complaints, "¿por qué tarda?") → hand-off (case I).

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

**Monitor:** the feed card, then Chatwoot. Logs `human hand-off opened`, `human hand-off extended` and `human hand-off open, agent stays silent`. In the database: the `conversation_handoffs` table.

### J. Kill switch off (`whatsapp.agentRepliesEnabled: false`)

- No replies to anyone and no AI calls.
- The prospect's 8h clock **still restarts** when they write, so going quiet doesn't make drafts expire.
- Form submissions through the WhatsApp Flow are still saved (as today).
- Abandoned drafts are **not** reopened while it's off.

### L. A rejected applicant writes again

1. Their latest application is `REJECTED` → **no AI answers**.
2. A hand-off opens right away (reason "Solicitud anterior no aprobada") and a feed card appears.
3. They get one fixed reply: _"Hola, gracias por escribirnos. Vemos que tu solicitud anterior no fue aprobada. Ya le avisé al equipo; una persona te va a responder por aquí."_
4. While the hand-off is open (24h after their last message), they get no automatic replies. You decide what to tell them in Chatwoot.
5. If Lucía (GUEST) is turned off, they get no reply at all, same as other guests.
6. Applying again through the web form is still allowed.

**Monitor:** feed card with reason "Solicitud anterior no aprobada", then Chatwoot.

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

**What happens if a rejected person writes later** (decided 2026-09-25): a person takes it. See case L. The AI doesn't answer them, because it doesn't know why they were rejected and would invite them to apply again.

Not chosen, for the record: a waiting period before re-applying, and a rejection notice at the moment of rejection (that would need a new approved Meta template).

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
| What an agent said                 | Chatwoot (every bot reply is echoed there)                                                                                                                         |
| Drafts being abandoned or reopened | apiserver logs: `application auto-abandoned after stale window`, `abandoned draft reopened on prospect return`                                                     |
| Photos applicants sent             | Ops app → application → evidence (uploader `whatsapp:<phone>`)                                                                                                     |
| Why someone got no reply           | logs: `no agent assigned to profile, ignoring` (agent off), `human hand-off open, agent stays silent`, `whatsapp agent replies disabled, ignoring inbound message` |

Database checks (SQLite):

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

## 6. How each case is tested

There are three layers:

1. **Automated unit and integration tests.** They run on every PR; all pass today: agents 211, apiserver 578, integration 811.
2. **Agent evals.** A real AI model answers scripted conversations and a judge checks both the tool use and the answer. Run with `npm run agents:eval -- <agent>`.
3. **Manual staging smoke test** on a real WhatsApp. **Not done yet.** It's the one open task (6.3).

| Case                                                                              | Automated test                                                                                                                                    | Eval                                                                                                                                                 | Manual (to do)                              |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Routing table (every status → agent, staff first, reviewer role)                  | `mods/agents/test/whatsapp/createMessageRouter.test.ts`                                                                                           | —                                                                                                                                                    | ✔                                           |
| A. Guest FAQ + form link                                                          | `handleCxMessage.test.ts` (routes to GUEST)                                                                                                       | Lucía: requirements, out-of-zone, asks for person — 3/3                                                                                              | ✔                                           |
| B. José + clock restart                                                           | `handleCxMessage.test.ts`, `createRecordProspectActivity.test.ts`                                                                                 | José: existing 6 scenarios (5/6; the failing one fails on `main` too)                                                                                | ✔                                           |
| C. 8h abandon, deferred by hand-off, never for submitted                          | `createHandleAbandonJob.test.ts`, `scheduleOnUpsert.test.ts`, `createHandleNudgeJob.test.ts`                                                      | —                                                                                                                                                    | ✔ wait 8h (or set a short delay on staging) |
| D. Reopen / no reopen after withdrawal                                            | `createReopenApplication.test.ts`, `handleCxMessage.test.ts`                                                                                      | —                                                                                                                                                    | ✔                                           |
| E/F. Applicant stage, no leaks, photos only before decision                       | `selfService.test.ts` (checks no score, reasons or dates in the data), `handleCxMessage.test.ts` (photo passed through)                           | Sofía: status without dates, asks for missing doc, change amount → hand-off — 3/3                                                                    | ✔ send a real photo                         |
| G. Customer own loans only, receipt to sender, new application                    | `selfService.test.ts` (someone else's loan or payment → refused), `createMessageRouter.test.ts`, `handleCxMessage.test.ts` (application attached) | Carmen: balance, refuses brother's loan, resends receipt, new application status — behavior correct in all 4; wording judge is noisy (2–4/4 per run) | ✔                                           |
| L. Rejected applicant → person                                                    | `createMessageRouter.test.ts` (flag), `handleCxMessage.test.ts` (hand-off, fixed reply, no LLM)                                                   | — (no AI involved)                                                                                                                                   | ✔                                           |
| H. Staff silence                                                                  | `handleWhatsAppMessage.test.ts`                                                                                                                   | —                                                                                                                                                    | ✔                                           |
| I. Hand-off (explicit phrases, passing mentions ignored, silence, 24h, feed card) | `handleCxMessage.test.ts`, `handoffs.test.ts`, integration feed test                                                                              | all three agents hand off in evals                                                                                                                   | ✔ incl. feed card                           |
| J. Kill switch                                                                    | `handleWhatsAppMessage.test.ts` (no reply, clock still restarts)                                                                                  | —                                                                                                                                                    | ✔                                           |
| Meta templates unchanged                                                          | `createHandleNudgeJob.test.ts` (same template send, no abandon)                                                                                   | —                                                                                                                                                    | ✔ watch no new template sends               |

**What the automated tests do not prove** (the manual checklist covers these):

- Real delivery through Meta, and the Chatwoot mirror.
- The real 24h window when a human replies late.
- Real AI answers vary between runs. Evals pass today, but wording drifts, so rerun them after any prompt change.

---

## 7. Open decisions for you

1. **FAQ copy**: Lucía and Sofía use the website FAQ text. Please read it in `agents.yaml` before turning them on.
2. **Agent names**: Lucía, Sofía and Carmen are placeholders. Rename freely.
3. **Turn-on order**: GUEST → APPLICANT → CUSTOMER, one at a time, watching the feed and Chatwoot.

Decided on 2026-09-25: rejected applicants go to a person (case L), and returning customers keep Carmen, who also follows their new application (case G).
