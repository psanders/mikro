## Why

José (the PROSPECT agent) stops early: code caps him at 7 replies, and his prompt tells him to finalize at a simulated score of 50 and not to fill every field. The founder wants him to gather as much as possible, without losing leads to a long conversation (a draft that is never submitted is abandoned after 8h).

## What Changes

- **Submit early, then keep asking.** José still submits as soon as the score reaches 50 or the form is complete, and in any case by his 7th reply. The cap becomes a "submit by" point instead of an end point. After submitting, he keeps asking the remaining form fields in the same conversation. These questions are optional for the person.
- **"Intake open" window.** A RECEIVED application stays with José while all of these hold:
  - he hasn't closed intake;
  - form fields are still missing;
  - he replied on it within the last 24h, or it's the person's first message after a web-form submission and nobody has talked with them since.

  Otherwise the applicant agent (Sofía) answers, as today. José is reactive only: he never messages first, which fits WhatsApp's 24h window. This applies to any submission, web form included.

- **Brakes after submission:** the form is complete, the person declines, three replies in a row save nothing, 24h of quiet, a reviewer takes the application, or a hand-off. A decline or a stuck conversation after submission **never** un-submits: `finalizeApplication` on a submitted application only records `intakeClosedAt`.
- **José covers the applicant agent's basics during the window.** He gets `getMyApplicationStatus` and `attachApplicationEvidence`, with the same disclosure rules (no score, no dates).
- **Audit.** Removes the `jose_turn_cap` check. Adds José policies `envia_pronto`, `no_insiste` and `no_revela` in place of `formulario_corto`.

## Capabilities

### Modified Capabilities

- `loan-application-prospect-intake`: the 7-turn cap becomes submit-by-7; intake continues after submission within the window.
- `conversation-audit`: drops the turn-cap code check.

## Impact

- **apiserver:**
  - `LoanApplication.intake_closed_at`, plus a migration and the integration `SCHEMA_SQL`.
  - `createIsIntakeOpen`, wired into both application lookups.
  - A shared missing-fields helper.
  - `saveAnswer` closes intake when the form is complete; `finalizeApplication` guards submitted applications.
- **agents:** the router's `prospect` route gains `phase`; `handleProspectMessage` directives by phase; the handler passes the phase and image, and stops restarting the abandon clock after submission.
- **agents.yaml (José):** prompt rewritten into FASE 1 / FASE 2; two tools added; policies and evals updated.
- **common:** `intakeClosedAt` on the application types.
- **No UI or `mikro.json` change.**
