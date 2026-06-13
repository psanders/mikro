## 1. Config & schema

- [x] 1.1 Add `promoTemplateName` (default `loan_application`) and `promoLanguageCode` to the WhatsApp config in `mods/common/src/config.ts`, and surface via `mods/agents/src/config.ts`.
- [x] 1.2 Add an optional `sendPromo` boolean (default false) to `createApplicationSchema` in `mods/common/src/schemas`.

## 2. createApplication promo send (API)

- [x] 2.1 In `mods/apiserver/src/trpc/routers/protected.ts`, after creating the application in `createApplication`, when `sendPromo` is true and the normalized `phone` is non-null, call the WhatsApp client's `sendTemplateMessage` with the configured template name + language.
- [x] 2.2 Make the send best-effort: never roll back creation; return the application plus a promo result `{ sent, messageId?, error? }`. When `sendPromo` is false or phone is null, return `sent: false` and send nothing.
- [x] 2.3 Confirm reviewer gating already covers this path (rejects unauthenticated/non-reviewer callers before any send).

## 3. Phone-based correlation (WhatsApp Flow submissions)

- [x] 3.1 In `mods/agents/src/whatsapp/handleWhatsAppMessage.ts`, before persisting a Flow submission, look up an existing `LoanApplication` by the sender's canonical E.164 phone.
- [x] 3.2 If a match exists, update that application (reuse its sessionId) instead of creating `wa-<messageId>`; on multiple matches, pick the most recently created. If none, keep today's create behavior.
- [x] 3.3 Confirm the public `POST /v1/applications` path is untouched (still upserts strictly by `sessionId`).

## 4. Phone canonicalization

- [x] 4.1 Confirm `parsePhone` (`mods/common/src/schemas/application.ts`) yields identical E.164 for dashboard-entered and WhatsApp-`from` numbers; keep it as the single canonicalization point. (Phone-library hardening deferred — out of scope.)

## 5. Dashboard UI (per approved Pencil design `FULqF` / `TfXGP`)

- [x] 5.1 Add the highlighted, default-unchecked "Enviar promoción por WhatsApp" checkbox row to the Nueva Solicitud modal, matching the Pencil design (checkbox, label, sublabel, WhatsApp icon).
- [x] 5.2 Disable the checkbox when the phone field is empty; pass its value as `sendPromo` to `createApplication`.
- [x] 5.3 After save, render the promo outcome: confirmation when `sent` is true, clear error when the promo result carries an error; creation success is shown regardless.

## 6. Tests & verification

- [x] 6.1 Mutation tests: `sendPromo: true` with a phone sends once and returns the message id; without a phone returns `sent: false`; omitted sends nothing; WhatsApp error returns a promo error without failing creation; reviewer gating enforced.
- [x] 6.2 Correlation tests: WhatsApp Flow submission merges into the matching application by phone; no match creates a new row; most-recent wins on multiple matches.
- [x] 6.3 Regression tests: two website submissions sharing a phone stay distinct; website submission does not merge by phone.
- [ ] 6.4 Manual verify: create a manual application with the checkbox on and a test number; confirm the template (Flow CTA) arrives and the confirmation shows; complete the Flow and confirm it updates the originating application.
