## Why

Staff prospect businesses in person and note their phone numbers, then create a **manual loan application** from the dashboard for promising leads. What's missing is a way to reach that prospect. WhatsApp forbids free-form business-initiated messages outside the 24-hour window, so cold outreach needs an **approved template** — and one already exists: `loan_application`, whose call-to-action opens the intake Flow. We want sending that promotion to be a single, deliberate step folded into creating the application — so it happens exactly once.

## What Changes

- Add a highlighted **"Enviar promoción por WhatsApp"** checkbox to the **Nueva Solicitud** modal (Pencil design done). Unchecked by default. When checked and the application has a phone, saving the application **also sends** the approved `loan_application` template (CTA opens the intake Flow). Because it fires on the one-time create, there is no risk of double-sending.
- Extend the reviewer-gated `createApplication` mutation to accept an optional `sendPromo` flag; when set and a phone is present, it sends the template after the application is created and reports the send outcome.
- Surface a **confirmation** after save (promo sent ✓ / clear error if WhatsApp rejected it).
- **Phone-based correlation, WhatsApp-only**: when a Flow submission arrives over WhatsApp from a number that already has a loan application, the submission **updates that application** instead of creating a new `wa-<messageId>` row. The public website endpoint keeps its current upsert-by-`sessionId` behavior unchanged.
- **Canonical E.164 phone**: correlation matches on a normalized E.164 phone. Reuse `normalizeApplication`'s `parsePhone` so manual, website, and WhatsApp `from` numbers canonicalize identically.
- Add config for the promo template name (`loan_application`) and language code.
- The existing **inbound** intake flow is left intact (staff disables it manually); nothing is deleted.

Out of scope: no standalone "resend promo" action on the detail view (avoids double-send); no change to `sendTemplateMessage` (the template carries the Flow as its CTA, so it sends by name); no per-message Flow token wiring (correlation is by phone).

## Capabilities

### New Capabilities

- `loan-application-promo-send`: Reviewer-initiated sending of the approved `loan_application` WhatsApp template (the promotion, CTA = intake Flow) as an opt-in checkbox on manual application creation, sent once at save time, returning a send confirmation or a clear error to the dashboard. Includes WhatsApp-only phone-based correlation — keyed on a canonical E.164 phone — so a subsequent Flow completion merges into the originating application without affecting website submissions.

### Modified Capabilities

- `loan-application-manual-create`: The `createApplication` mutation gains an optional `sendPromo` flag that, when set and a phone is present, sends the promo template after creating the application.

## Impact

- **Dashboard**: highlighted, default-unchecked promo checkbox in the Nueva Solicitud modal; post-save confirmation/error. **Pencil design produced and approved before implementation.**
- **API**: `createApplication` (`mods/apiserver/src/trpc/routers/protected.ts`) extended with `sendPromo`; wires the WhatsApp client's `sendTemplateMessage` (client already constructed in `mods/apiserver/src/index.ts`).
- **Inbound handler**: `mods/agents/src/whatsapp/handleWhatsAppMessage.ts` Flow-submission persistence gains an E.164 phone lookup to reuse an existing application's row; website path untouched.
- **Phone normalization**: `mods/common/src/schemas/application.ts` `parsePhone` kept as the single canonical E.164 source.
- **Shared schema**: `createApplicationSchema` (`mods/common/src/schemas`) gains an optional `sendPromo` boolean.
- **Config**: promo template name + language in `mods/agents/src/config.ts` / `mods/common/src/config.ts`.
- **External / ops**: relies on the already-approved `loan_application` template in Meta WhatsApp Manager.
- **No breaking changes**: scoring and the public `POST /v1/applications` endpoint are untouched; `sendPromo` is optional and defaults off.
