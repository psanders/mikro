## Why

The ops dashboard now has the Inicio and Solicitudes screens, but the "Clientes" nav item is still inert — staff can convert an approved application into a `Customer`, yet have no way to find that customer, see their loans, or review their payment history. This is Phase 5: make the customer book operable, reusing the patterns established by the Solicitudes screens. No backend work is needed — the customer/loan/payment procedures already exist.

**Source of truth: the code.** The screens render what the Prisma models and the `listCustomers` / `getCustomer` / `listLoansByCustomer` / `listPaymentsByCustomer` procedures actually return. The Pencil frames (`wu59x`, `RrGyR`) are the layout/styling reference, but where they show fields or shapes that don't match the real data model, the **Pencil designs are updated to match the code** — we do not invent UI for data the API doesn't provide, and we do not reshape the code to fit the mockup.

## What Changes

- **Clientes list** (`/clientes`, Pencil `wu59x`) — wired to `listCustomers`: a `PageHeader` + `Search` (server-side, `search` param, ≥2 chars) + segment tabs (Todos / Activos / Inactivos via `showInactive`), a table whose columns are derived from the actual `Customer` model (name + nickname, contact, identity/cédula, collector/referrer, active state), row → detail, loading/error/empty states, and "Cargar más" pagination (`limit`/`offset`).
- **Cliente detail** (`/clientes/:id`, Pencil `RrGyR`) — wired to `getCustomer`: header (name + active state), contact & identity info as `KVRow`s drawn from the real fields, the customer's loans (`listLoansByCustomer`) and recent payments (`listPaymentsByCustomer`); loading/error/not-found.
- **Pencil reconciliation** — audit `wu59x`/`RrGyR` against the `Customer`/`Loan`/`Payment` models and the procedure return types; edit the `.pen` designs so they reflect the code (drop fields the API doesn't return, add real ones it does).
- **Shell wiring** — activate the "Clientes" nav entry and add `/clientes` + `/clientes/:id` routes under the auth guard.

## Capabilities

### New Capabilities

- `clientes-list`: The customers list screen — server-side search, active/inactive segmentation, model-derived columns, pagination, loading/error/empty handling
- `cliente-detail`: The customer detail screen — contact/identity info plus the customer's loans and recent payments, all driven by the real procedure return shapes

### Modified Capabilities

- `ops-dashboard-shell`: The Clientes nav becomes active and `/clientes` + `/clientes/:id` routes are added under the auth guard (extending the existing extensible-navigation requirement)

## Impact

- `mods/dashboard/src/pages/` — new `ClientesPage.tsx` + `ClienteDetailPage.tsx`
- `mods/dashboard/src/App.tsx` — routes for `/clientes` and `/clientes/:id` under the auth guard
- `mods/dashboard/src/components/Layout.tsx` — activate the Clientes nav entry (`to: "/clientes"`)
- `pencil.pen` — frames `wu59x` and `RrGyR` reconciled to the code (design follows code, not the reverse)
- No backend changes — `listCustomers`, `getCustomer`, `listLoansByCustomer`, `listPaymentsByCustomer` already exist on the protected router (`protectedProcedure`)
- Reuses the dashboard components and query patterns from `add-solicitudes-dashboard` (`PageHeader`, `Search`, `Tab`, `Badge`, `SectionCard`, `KVRow`, pagination)
- Out of scope: customer create/edit, the Préstamos / Contabilidad / Reportes screens, and deep loan/payment drill-downs (loan rows link out only once the Préstamos screen exists)
