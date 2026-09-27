## 1. Data

- [x] 1.1 Add `LoanApplication.intakeClosedAt`, with a migration, the integration `SCHEMA_SQL`, and the common types.
- [x] 1.2 Add a shared `missingApplicationFields` helper, used by `getApplicationState` and the window check.

## 2. Intake window

- [x] 2.1 Add `createIsIntakeOpen`: RECEIVED, not closed, fields missing, José's reply within 24h or a first message after submission with no applicant-agent turn since.
- [x] 2.2 Add `intakeOpen` to `createGetApplicationByPhone` and `createGetApplicationByWhatsAppUserId`, wired in index.ts.
- [x] 2.3 `saveAnswer` closes intake when the form is complete on a RECEIVED application.
- [x] 2.4 Make `finalizeApplication` on a non-DRAFT application only close intake.

## 3. Agents

- [x] 3.1 Router: DRAFT → prospect/intake; RECEIVED + `intakeOpen` → prospect/enrichment.
- [x] 3.2 `handleProspectMessage`: directives by phase (submit-by-7, and the enrichment decline, stuck and first-message directives). No cap after submission. Pass the image and the context.
- [x] 3.3 Handler: pass the phase and image to José; no abandon clock for the enrichment phase.
- [x] 3.4 Audit: remove `jose_turn_cap`.
- [x] 3.5 agents.yaml: José prompt with FASE 1 / FASE 2, the status and evidence tools, policies, and eval scenarios.

## 4. Tests & docs

- [x] 4.1 Unit tests: router, phase directives, handler, finalize guard, lookup.
- [x] 4.2 Integration tests: the window rules, and `saveAnswer`/`finalize` on RECEIVED.
- [x] 4.3 CX_EXPLAINER updated.
