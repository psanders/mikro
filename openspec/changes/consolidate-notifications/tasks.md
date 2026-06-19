## Tasks

- [x] Add `cp/toast-success` and `cp/toast-error` to Pencil Component Library
- [x] Create `mods/dashboard/src/components/ui/Toast.tsx`
- [x] Create `mods/dashboard/src/components/ui/ToastProvider.tsx` (includes `useToast`)
- [x] Create `mods/dashboard/src/components/ui/Toast.stories.tsx`
- [x] Mount `<ToastProvider>` in `App.tsx` wrapping `<BrowserRouter>`
- [x] OverviewPage: remove local Toast/ToastState, wire SendPromoModal callbacks to `useToast()`
- [x] SolicitudDetailPage: add `useToast()`, wire all mutation success/error toasts (promote, approve, reject, convert, delete)
- [x] NuevaSolicitudModal: toast "Solicitud creada" on create success before navigate
- [x] EditSolicitudModal: toast "Cambios guardados" on update success
- [x] ContabilidadPage: toast "Transacción registrada" on createTransaction success
- [x] ClienteDetailPage: toast "Pago registrado" on createPayment success
- [x] TransaccionDetailPage: toast "Transacción revertida" on reverseTx success
- [ ] Write Playwright test: `toast.spec.ts` — verify toast appears and auto-dismisses (blocked: no Playwright setup in dashboard; needs `npm install -D @playwright/test` + config)
