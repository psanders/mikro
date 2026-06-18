## Why

Sending a promo today requires creating a full loan application first, which pollutes the Inicio dashboard with DRAFT entries that aren't real leads. Reviewers need a lightweight way to fire off a promotional message with just a phone number.

## What Changes

- New `sendPromo` tRPC procedure: takes a phone number, sends the `loan_application` WhatsApp template, returns a result — no application created
- New `SendPromoModal` component in the dashboard: single phone-number field, reuses existing phone format/validation logic
- `OverviewPage` gets a "Enviar Promoción" button in the `PageHeader` action slot that opens the modal
- Toast feedback on send success or failure
- Auth gate: any authenticated user (not reviewer-only)
- When the customer later completes the Flow form, the existing phone-correlation logic in `createSubmitApplicationFromFlow` creates a normal loan application as today

## Capabilities

### New Capabilities

- `promo-send-shortcut`: Standalone promo send from the Inicio panel — phone-only input, no application created, any authenticated user, toast feedback

### Modified Capabilities

_(none — existing application-tied promo send is unchanged)_

## Impact

- `mods/apiserver/src/trpc/routers/protected.ts` — new `sendPromo` procedure
- `mods/dashboard/src/components/SendPromoModal.tsx` — new component
- `mods/dashboard/src/pages/OverviewPage.tsx` — wire button + modal
- No DB schema changes, no new dependencies
