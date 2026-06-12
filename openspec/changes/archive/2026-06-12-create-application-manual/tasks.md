## 1. Schema (common)

- [x] 1.1 Add `createApplicationSchema` to `mods/common/src/schemas/application.ts` — `z.object({ patch: z.record(z.string(), z.string()).default({}) })`, matching `updateApplicationSchema.patch` shape but without an application ref.
- [x] 1.2 Export `createApplicationSchema` and `CreateApplicationInput` type from `mods/common/src/index.ts`.

## 2. API handler (apiserver)

- [x] 2.1 Create `mods/apiserver/src/api/applications/createCreateApplication.ts`. Generate a UUID `sessionId`, merge `input.patch` into an empty object, run `applicationPayloadSchema.parse` → `normalizeApplication` → `scoreApplication`, then `prisma.loanApplication.create` with `status: "DRAFT"` and all normalized columns. Return the full `LoanApplication`. Follow the same structure as `createUpdateApplication.ts`.
- [x] 2.2 Export the new handler from `mods/apiserver/src/api/applications/index.ts`.

## 3. tRPC router (apiserver)

- [x] 3.1 Import `createApplicationSchema` and `CreateApplicationInput` in `mods/apiserver/src/trpc/routers/protected.ts`.
- [x] 3.2 Import `createCreateApplication` from the applications API index.
- [x] 3.3 Add a `createApplication` procedure to the protected router using `reviewerProcedure`, `createApplicationSchema` as input, and `createCreateApplication(ctx.db)` as the handler. Place it alongside the other application procedures.

## 4. Dashboard modal component

- [x] 4.1 Create `mods/dashboard/src/components/NuevaSolicitudModal.tsx`. Props: `onClose: () => void`. Internal state: a `Record<string, string>` form initialized empty. Reuse `EDIT_SECTIONS` / `ALL_EDIT_FIELDS` from `applicationFields` — or inline the 6 fields (firstName, lastName, phone, idNumber, businessType, businessName, requestedAmount, requestedTermWeeks) with the same input/select/masked rendering pattern from `EditSolicitudModal`. Call `trpc.createApplication.useMutation`; on success navigate to `/solicitudes/:id` and call `onClose`.
- [x] 4.2 Group fields into three labeled sections matching the Pencil design (SOLICITANTE, NEGOCIO, CRÉDITO) with the same 2-column row layout used in `EditSolicitudModal`. Apply phone and cédula masks via `applyFormat` / `formatError`.
- [x] 4.3 Disable the save button while any formatted field has a partial value (`hasErrors`) or while the mutation is in-flight (`update.isPending`).

## 5. Wire up in SolicitudesPage

- [x] 5.1 In `mods/dashboard/src/pages/SolicitudesPage.tsx`, add `useState(false)` for modal visibility.
- [x] 5.2 Pass an `onAction` prop (or inline handler) to `PageHeader` that sets modal open. The page-header component already renders a primary action button in its Pencil design — confirm `PageHeader` accepts an `onAction` / `actionLabel` prop or add one.
- [x] 5.3 Render `<NuevaSolicitudModal>` when `modalOpen` is true, passing `onClose={() => setModalOpen(false)}`. After a successful save the modal navigates away, so `onClose` only needs to handle the cancel path.
- [x] 5.4 After the modal closes (either path), invalidate or refetch the `listApplications` query so new records appear immediately.
