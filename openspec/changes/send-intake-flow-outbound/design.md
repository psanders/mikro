## Context

The dashboard already lets reviewers create a manual loan application via the Nueva Solicitud modal (`loan-application-manual-create`, `createApplication` mutation), and the WhatsApp stack already has an approved Flow template, `loan_application`, whose CTA opens the intake Flow. Inbound Flow submissions are handled by `handleWhatsAppMessage.ts`, which today keys each submission to a fresh `wa-<messageId>` application row (`handleWhatsAppMessage.ts:607`). Phones are already normalized to canonical E.164 (`+1XXXXXXXXXX`) by `parsePhone` (`mods/common/src/schemas/application.ts:133`) on every path through `normalizeApplication`. The template-send transport `sendTemplateMessage` (`mods/agents/src/whatsapp/client/sendMessage.ts:289`) and the WhatsApp client are already constructed in `mods/apiserver/src/index.ts`.

The Pencil design for the UI is complete and approved (this change's gate): in `pencil.pen`, the Nueva Solicitud modal (`Operations / 03b Nueva Solicitud (modal)`, `FULqF`) gains a highlighted, default-unchecked "Enviar promoción por WhatsApp" row (`TfXGP`) at the end of the modal body, with a checkbox, label, sublabel, and WhatsApp icon. There is intentionally **no** standalone resend action on the detail view.

## Goals / Non-Goals

**Goals:**

- Fold the promo send into manual creation as a single, deliberate, opt-in step that fires exactly once at save time.
- Clear sent/error confirmation after save.
- A completed Flow from that prospect folds into the originating application (phone-based), with no duplicate row.
- Website intake behavior is provably unchanged.

**Non-Goals:**

- No standalone "resend promo" action (this is what removes the double-send risk).
- No change to `sendTemplateMessage` — the template carries the Flow as its CTA, so it sends by name with no button params.
- No per-message Flow-token correlation.
- No removal of the inbound greeting flow (staff disables it manually).
- No cold-list / bulk send.

## Decisions

**1. Send on create, gated by a modal checkbox.**
The promo send is an optional side effect of `createApplication`, triggered by a `sendPromo` flag the modal sets from its default-unchecked checkbox. Because creation is a one-shot action, there is no path to send twice. Alternative considered: a standalone rail action on the detail view — rejected for screen clutter and double-send risk.

**2. Send must match the template's full format (image header + Flow button).**
Initial assumption (bare send) was wrong: the approved `loan_application` template defines an **image header** and a **Flow CTA button**, and WhatsApp validates the send against that format (error 132012 otherwise). So `sendTemplateMessage` was extended to emit (a) a header **image** component (`headerImageUrl`) and (b) a **Flow button** component with a `flow_token`. Verified live against a test number: bare/partial sends return 132012; image-header + flow-button is accepted. Language is `en` (not `en_US` → 132001). The `flow_token` is opaque here (correlation is phone-based) — we pass the application id.

**2b. Promo banner is served by the API server, not an external host.**
WhatsApp re-requires the header image on every send (the template's sample image is not reused), so we need a public image URL. The banner is bundled in the repo (`mods/apiserver/assets/loan-application-promo.jpg`, exported from the Pencil "Facebook Ad (1.91:1)" frame) and served by a single dedicated API-server route (`/assets/loan-application-promo.jpg`) — the server is already public for the webhook. The send URL defaults to `publicUrl` + that route; `whatsapp.templates.loanApplicationPromoImageUrl` overrides it. Alternatives considered: WhatsApp media-id upload (id expiry/caching complexity) and the marketing site (couples sends to site deploys) — both rejected; the API server is the natural owner. A single-file route (not a static mount) keeps the rest of `assets/` private.

**3. Promo send is best-effort, non-blocking to creation.**
The application is created first; the send happens after. A WhatsApp error does not roll back creation — the mutation returns the application plus a promo result (`{ sent: boolean, messageId?, error? }`) so the dashboard can show creation success with a promo-specific confirmation or error.

**4. Correlation is phone-based and WhatsApp-only.**
On a WhatsApp Flow submission, look up an existing application by the sender's canonical E.164 phone; update it if found, else create as today. This lives in the WhatsApp Flow-submission persistence path (`handleWhatsAppMessage.ts`), **not** the public `POST /v1/applications` endpoint, which keeps strict upsert-by-`sessionId`. On multiple matches, pick the most recently created application (favors the just-created manual app).

**5. E.164 is the canonical correlation key; reuse `parsePhone`.**
`parsePhone` already yields `+1` E.164 for DR/NANP numbers across all paths, so the manual app and the WhatsApp `from` store identical values, making the lookup a plain equality match. Optionally hardened with a phone library later for non-NANP markets; null-on-unparseable is preserved.

**6. Config carries the template identity.**
Add `templates.loanApplicationPromo` (`loan_application`) to the WhatsApp config (`mods/common/src/config.ts`) plus a `getWhatsAppPromoTemplate()` getter (`mods/agents/src/config.ts`) so the name is not hard-coded in the mutation. **Temporary:** the currently approved template is English, so `templates.loanApplicationPromoLanguage` (default `en_US`) pins the promo send language independently of the shared `whatsapp.languageCode`; it falls back to the shared language when left empty. Remove the pin once a Spanish (`es_DO`) template is approved. Example keys added to `mikro.json.example`.

## Risks / Trade-offs

- **Double-send** → structurally eliminated: sending only happens inside the one-time create, and there is no resend control.
- **Wrong-row merge when two applications share a phone** → choose the most recently created match; merge scoped to WhatsApp submissions only.
- **Non-NANP phone not canonicalizing** → DR-only today; `parsePhone` returns null for unparseable input, making the app ineligible for promo send rather than mis-sending.
- **Template not approved / renamed in Meta** → mutation returns the WhatsApp error in the promo result; creation still succeeds; dashboard shows it.
- **Website regression** → covered by explicit spec scenarios; merge logic is physically separate from the public endpoint.

## Migration Plan

- Pure additive deploy: new config keys (default to `loan_application` / language), optional `sendPromo` on `createApplication`, the modal checkbox, and the phone-merge branch in the WhatsApp handler.
- No DB migration: reuses existing `LoanApplication.phone` (already indexed).
- Rollback: `sendPromo` defaults off; reverting the modal checkbox + the handler branch restores today's behavior. Inbound greeting flow untouched throughout.

## Resolved Decisions

- **Confirmation only, no persistence.** A successful send is reported in the create response and surfaced in the dashboard; nothing is stamped on the application (no `promoSentAt`, no activity entry). The promo result is transient UI state.
- **Phone-library hardening deferred.** Keep `parsePhone` as-is (`+1`/NANP, null-on-unparseable). Revisit only when a non-`+1` market is added.
