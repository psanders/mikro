## Why

Reviewers sometimes collect applications over the phone and need to enter them manually into the system. Today there is no way to create a LoanApplication from the dashboard — every record comes from the public web form. This blocks the intake workflow for offline prospects.

## What Changes

- Add a "Nueva solicitud" button to the Solicitudes page header that opens a creation modal.
- Add a `createApplication` tRPC mutation that creates a `LoanApplication` in `DRAFT` status, running the same normalization and scoring pipeline as `updateApplication`.
- Build a `NuevaSolicitudModal` component with three field groups: SOLICITANTE (Nombre, Apellido, Teléfono, Cédula), NEGOCIO (Tipo de negocio, Nombre del negocio), and CRÉDITO (Monto solicitado, Plazo). Remaining fields are filled in later via the existing edit modal.
- Remove the unused filter button from the Solicitudes toolbar (already done in Pencil and code).

## Capabilities

### New Capabilities

- `loan-application-manual-create`: Manually create a loan application from the ops dashboard, collecting minimum required intake fields and saving as DRAFT.

### Modified Capabilities

- `solicitudes-list`: Page header gains a "Nueva solicitud" primary action button.

## Impact

- **`mods/common/src/schemas/application.ts`** — new `createApplicationSchema` + type export.
- **`mods/common/src/index.ts`** — export the new schema.
- **`mods/apiserver/src/trpc/routers/protected.ts`** — new `createApplication` procedure.
- **`mods/apiserver/src/api/applications/`** — new `createCreateApplication.ts` handler.
- **`mods/dashboard/src/pages/SolicitudesPage.tsx`** — wire "Nueva solicitud" button + modal.
- **`mods/dashboard/src/components/NuevaSolicitudModal.tsx`** — new component.
- **Pencil screen 03b** (`FULqF`) — already designed; no further Pencil changes needed for this feature.
