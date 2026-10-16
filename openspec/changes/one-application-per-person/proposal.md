## Why

Issue #302. The same person ends up with several applications, and most of them aren't leftover drafts: they are people re-applying right after a rejection. In the 2026-10-15 production copy, 76 phones had more than one application, and 52 applications from 45 people came in within 30 days of a rejection. Reviewers rejected 39 of those 52 again (21 out of coverage area again). The 30-day reapply cooldown only existed in what Lucía tells people on WhatsApp; the website form matched applications by browser session only, so every new session started a new application.

## What Changes

- **One application per person**, checked when an application is submitted (never on autosave), on every intake path: the website's final submit, the WhatsApp intake Flow and José's `finalizeApplication`. The same person = the same normalized phone OR the same cédula as another application.
- **Rejected less than 30 days ago** (any reason, out of coverage area included): nothing is submitted. The website shows the date they may apply again; the Flow reply and José say it too. A José draft in that state is closed (ABANDONED) instead of submitted.
- **An application already in process** (RECEIVED, IN_REVIEW, PENDING_DECISION, APPROVED): no second one. The website says "Ya tienes una solicitud en proceso"; same on WhatsApp.
- **An older unsubmitted DRAFT** under another session takes the new answers (the new session's own DRAFT is removed), so the person keeps one application.
- **Out-of-area rejections get the same cooldown** (founder decision 2026-10-16). Lucía's out-of-area note now gives the date instead of inviting them to re-apply right away (this reverses part of #328).
- **WhatsApp routing:** a rejection inside the cooldown wins over a newer DRAFT or never-submitted ABANDONED application, so the person is told the date by Lucía instead of José collecting an application that can't be submitted.
- `REAPPLY_COOLDOWN_DAYS` moves to `@mikro/common` (one constant for enforcement and messaging).
- Not in scope: a "solicitudes anteriores" history in the Ops panel (later), cleaning up existing duplicates.

## Capabilities

### Modified Capabilities

- `loan-application-intake`: submissions are checked against the same person's other applications.

## Impact

- apiserver: `createFindPriorApplication` (new), intake handler, Flow submission, José finalize, application lookup for the router.
- agents: router cooldown rule, out-of-area directive, Flow replies.
- site: two new result screens (cooldown, in process), built with the existing result-screen styling; Pencil has no screens for them yet (follow-up).
- `agents.yaml`: José's send flow learns the `cooldown` / `in_process` outcomes; an eval scenario follows the new out-of-area note.
