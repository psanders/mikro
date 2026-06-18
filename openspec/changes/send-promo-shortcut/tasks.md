## 1. Backend — `sendPromo` tRPC Procedure

- [x] 1.1 Add `sendPromo` input schema (zod: `{ phone: string }`) and wire a new `authenticatedProcedure` in `mods/apiserver/src/trpc/routers/protected.ts`
- [x] 1.2 In the procedure handler, generate `flowToken = randomUUID()`, resolve template config via `getWhatsAppPromoTemplate()`, instantiate `createSendApplicationPromo`, call it, and return the `PromoResult`

## 2. Frontend — `SendPromoModal` Component

- [x] 2.1 Create `mods/dashboard/src/components/SendPromoModal.tsx` with a single phone input using `applyFormat("phone", …)` and `formatError("phone", …)` for live formatting and inline validation
- [x] 2.2 Wire `trpc.sendPromo.useMutation` in the modal; close the modal immediately on submit; show success toast ("Promoción enviada") on `{ sent: true }` and error toast with `error` message on `{ sent: false }`
- [x] 2.3 Disable the send button until `formatError("phone", phone)` returns null

## 3. Frontend — Wire into OverviewPage

- [x] 3.1 Import `SendPromoModal` and a `useState` toggle into `mods/dashboard/src/pages/OverviewPage.tsx`
- [x] 3.2 Pass `<Button variant="primary" onClick={() => setOpen(true)}>Enviar Promoción</Button>` to the `action` prop of `<PageHeader>`
- [x] 3.3 Render `{open && <SendPromoModal onClose={() => setOpen(false)} />}` conditionally in the page

## 4. Verification

- [ ] 4.1 Manually send a promo from the Inicio header and confirm the WhatsApp message is received and no application appears in the dashboard
- [ ] 4.2 Confirm success toast appears on send and error toast appears when WhatsApp is unavailable (or phone is invalid at API level)
- [ ] 4.3 Complete the WhatsApp Flow after a standalone promo and confirm a normal application is created in the dashboard
