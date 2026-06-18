## Context

Sending the `loan_application` WhatsApp promo template today is coupled to `createApplication`: a reviewer must fill out the Nueva Solicitud modal to get a DRAFT application, which is the only way to trigger the send. This creates throwaway DRAFT entries that clutter the Inicio dashboard.

The existing promo infrastructure (`createSendApplicationPromo`, `getWhatsAppPromoTemplate`) is already decoupled from the application record — it only needs a `phone` and a `flowToken`. The `flowToken` is required by the WhatsApp Flow button component but is never used server-side for correlation; `createSubmitApplicationFromFlow` correlates by phone, not by token.

## Goals / Non-Goals

**Goals:**

- Add a standalone `sendPromo` tRPC procedure that sends the promo template with only a phone number
- Surface a "Enviar Promoción" button in the Inicio `PageHeader` action slot
- Provide toast feedback (success/error) without navigating away
- Gate on any authenticated session (not reviewer-only)

**Non-Goals:**

- Changing the existing `createApplication` + `sendPromo` flow
- Tracking sent promos in the database (no new table)
- Deduplication / rate-limiting of repeated sends to the same phone

## Decisions

### 1. New `sendPromo` procedure on `authenticatedProcedure`, not `reviewerProcedure`

The existing `createApplication` is reviewer-gated because creating application records is a privileged write. Sending a template message is a lighter action — any staff member with a login should be able to fire one off. Using `authenticatedProcedure` matches the intent without changing existing gates.

Alternative considered: reuse `createApplication` with `sendPromo: true` and a mostly-empty patch. Rejected because it still creates a DRAFT application, which is exactly the problem we're solving.

### 2. `flowToken = randomUUID()` for standalone sends

The Flow button component requires a `flow_token`. For application-tied sends the value is the application ID (opaque to WhatsApp). For standalone sends we generate a random UUID. When the customer completes the form, `createSubmitApplicationFromFlow` ignores the token and correlates by phone — so any stable opaque value works.

### 3. Reuse `createSendApplicationPromo` as-is

The existing function already handles null phone, missing image URL, and WhatsApp API errors — returning `{ sent, error }` rather than throwing. The new procedure is a thin wrapper that calls it directly, keeps the error contract identical, and avoids duplicating the best-effort logic.

### 4. `SendPromoModal` is a new standalone component (not extending `NuevaSolicitudModal`)

The new modal has a single field and completely different semantics (no application creation, no navigation). Extending the existing modal would add conditional complexity for no reuse benefit. Shared utilities (`applyFormat`, `formatError`, input styles) are imported from existing modules.

### 5. Toast for feedback, not inline modal state

The modal closes immediately on submit (optimistic UX). The toast appears after the mutation settles. Matches the pattern used elsewhere in the dashboard for mutation outcomes.

## Risks / Trade-offs

- **Duplicate sends to same phone** — nothing prevents sending the promo twice to the same number. Mitigation: acceptable for now; reviewers control when they click.
- **flowToken has no meaning** — a random UUID is correct but slightly different from the application-ID convention. Mitigation: the value is opaque to the server and WhatsApp; no functional impact.
- **Phone correlation picks the most recent application** — if a phone already has a DRAFT, the Flow submission will fold into it. This is consistent with existing behavior and is generally desirable.
