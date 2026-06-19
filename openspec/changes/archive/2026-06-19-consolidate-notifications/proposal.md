## Why

Transient action feedback is inconsistent: OverviewPage uses an inline local Toast component, other pages show nothing on success, and some mutations silently fail without user feedback. The UX goal is a single, predictable notification channel for mutation results.

## What Changes

- Add shared `Toast` + `ToastProvider` UI components to `mods/dashboard/src/components/ui/`
- Mount `ToastProvider` once in `App.tsx` so any page can call `useToast()`
- Replace OverviewPage's local Toast state with `useToast()`
- Add toast feedback to: SolicitudDetailPage (promote error, delete error), ContabilidadPage (transaction registered), ClienteDetailPage (payment registered)
- Add `cp/toast-success` and `cp/toast-error` to Pencil Component Library (done)

## Capabilities

### New Capabilities

- `useToast()` hook — `success(msg)`, `error(msg)`, `notify({variant, message})` — available in any component under `ToastProvider`
- Single active toast (new replaces old), 8s auto-dismiss, manual close

### Modified Capabilities

- OverviewPage promo callbacks → useToast (removes local Toast state)

### Removed Capabilities

- OverviewPage local `Toast` component and `ToastState` type (replaced by shared component)

## Boundary Rule

Toast vs. inline:

- **Toast**: transient mutation results (send promo, promote error, delete error, payment saved, transaction saved)
- **Inline**: form-field validation errors, page-load/empty error states

## Out of Scope

- EditSolicitudModal update success (parent already handles via `onSaved` callback which refreshes silently — acceptable)
- GenerateContractModal (file download is the confirmation)
- NuevaSolicitudModal (navigation to new record is the confirmation)
