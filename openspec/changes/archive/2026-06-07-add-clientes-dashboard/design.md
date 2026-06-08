## Context

The ops dashboard (`mods/dashboard`) is a React SPA. The Inicio, Solicitudes list, and Solicitud detail screens are already built; the Solicitudes change established the component vocabulary (`PageHeader`, `Search`, `Tab`, `Badge`, `SectionCard`, `KVRow`, pagination) and the tRPC-query patterns. The customer/loan/payment backend is fully built and battle-tested. This change wires the inert "Clientes" nav into two screens against that existing backend — no new procedures.

The governing constraint for this change: **the code is the source of truth.** The screens render exactly what `listCustomers` / `getCustomer` / `listLoansByCustomer` / `listPaymentsByCustomer` return. The Pencil frames (`wu59x`, `RrGyR`) inform layout and styling, but where they conflict with the real data model, the Pencil designs are edited to match the code — not the reverse.

## Goals / Non-Goals

**Goals:**

- A `/clientes` list with active/inactive segmentation, server-side search, model-derived columns, and pagination.
- A `/clientes/:id` detail showing contact/identity info plus the customer's loans and recent payments.
- Reconcile the Pencil frames `wu59x`/`RrGyR` to the actual data model.
- Reuse the existing dashboard components and query patterns wholesale.

**Non-Goals:**

- Customer create/edit (read-only for now).
- The Préstamos / Contabilidad / Reportes screens; deep loan/payment drill-downs.
- Any backend changes.

## Decisions

- **Server-side search, not client-side.** Unlike the Solicitudes list (which filtered names client-side), `listCustomers` already does a server-side `OR` match over name/nickname/phone. We drive the `search` param directly and only issue it at ≥2 chars (the schema's `min(2)`). _Alternative considered:_ client-side filtering of a fetched page — rejected because it would only filter the current page, not the whole book, and the backend already does it right.

- **Segments map to `showInactive`, not a status enum.** `Customer` has no lifecycle status — only `isActive`. So the tab strip is Todos / Activos / Inactivos backed by `showInactive` (default omitted = active only). _Alternative:_ mirror the Solicitudes status tabs — rejected as there is no such field on the model.

- **Columns/fields derived from the procedure return types.** `listCustomers` returns flat `Customer[]` with no relations, so collector/referrer are only IDs — we do **not** render their names. `getCustomer` returns a plain `Customer`, so loans and payments are fetched with their own queries (`listLoansByCustomer`, `listPaymentsByCustomer`) keyed on the id. _Alternative:_ expect the API to include relations — rejected; that would be reshaping expectations to the mockup rather than the code.

- **Pencil follows code.** As a deliverable, audit `wu59x`/`RrGyR` against `Customer`/`Loan`/`Payment` and edit the `.pen` frames (via pencil MCP tools) to drop fields the API doesn't return and reflect the ones it does. The implemented screens are validated against the _reconciled_ designs.

- **Mirror the Solicitudes file/route structure.** New pages `ClientesPage.tsx` + `ClienteDetailPage.tsx`; additive route entries in `App.tsx`; activate the nav `to` in `Layout.tsx`. This keeps the diff small and isolated, minimizing collision with the in-flight Solicitudes verification work (which has already finished editing those shared files).

## Risks / Trade-offs

- [Pencil frames drift from the model] → Reconcile them as an explicit task; treat code as authoritative when they disagree.
- [Shared-file edits (`App.tsx`, `Layout.tsx`) collide with the parallel Solicitudes session] → Edits are additive (one route block, one nav `to`); the Solicitudes change's nav/route tasks are already complete, so the surface is small and merge-friendly.
- [`listLoansByCustomer` / `listPaymentsByCustomer` return shapes unverified at design time] → Read their implementations during implementation and render only the fields they return; do not assume relation includes.
- [No `Préstamos` screen yet for loan rows to link to] → Loan rows are display-only for now; linking is deferred until that screen exists.
