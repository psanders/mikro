## Architecture

Single `ToastProvider` at the app root holds one active toast. Pages/components call `useToast()` — no prop drilling.

```
App.tsx
  ToastProvider          ← mounts once, renders portal at bottom-center
    BrowserRouter
      ...pages           ← any page calls useToast()
```

## Components

### `Toast` (`components/ui/Toast.tsx`)

Presentational only. Props: `variant: "success"|"error"`, `message: string`, `onDismiss: () => void`.

- Success: `bg-ds-green` + `CircleCheck` icon
- Error: `bg-ds-red` + `CircleX` icon
- Layout: `flex items-center gap-2 rounded-[10px] px-4 py-3 text-white shadow-lg`
- Dismiss button: `X` icon, `opacity-70 hover:opacity-100`

### `ToastProvider` + `useToast` (`components/ui/ToastProvider.tsx`)

- Context: `{ success(msg), error(msg), notify({variant, message}) }`
- Single active toast (replace-on-new), 8s auto-dismiss, manual dismiss
- Portal: `fixed bottom-6 left-1/2 z-50 -translate-x-1/2`
- `useMemo` for stable API identity (prevents effect re-firing in consumers)

## Usage Sites

| Location            | Trigger                     | Variant | Message                            |
| ------------------- | --------------------------- | ------- | ---------------------------------- |
| OverviewPage        | sendPromo success           | success | "Promoción enviada"                |
| OverviewPage        | sendPromo error             | error   | err.message                        |
| SolicitudDetailPage | promote.isError             | error   | "No se pudo promover la solicitud" |
| SolicitudDetailPage | del.isError                 | error   | "No se pudo eliminar la solicitud" |
| ContabilidadPage    | createTransaction onSuccess | success | "Transacción registrada"           |
| ClienteDetailPage   | createPayment onSuccess     | success | "Pago registrado"                  |

## Pencil

`cp/toast-success` (`vZPKq`) and `cp/toast-error` (`aqLVt`) added to Component Library.
