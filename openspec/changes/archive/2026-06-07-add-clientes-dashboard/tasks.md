## 1. Reconcile designs to code + shell wiring

- [x] 1.1 Read the real return shapes: `Customer` Prisma model and the `listCustomers` / `getCustomer` / `listLoansByCustomer` / `listPaymentsByCustomer` implementations; note exactly which fields each returns (no relation includes)
- [x] 1.2 Audit Pencil frames `wu59x` (Clientes) and `RrGyR` (Cliente Detalle) against those shapes; edit the `.pen` designs (pencil MCP tools) to drop fields the API doesn't return and reflect the ones it does — code wins on every conflict
- [x] 1.3 Add routes `/clientes` and `/clientes/:id` under the auth guard in `src/App.tsx`, importing the two new pages
- [x] 1.4 Activate the "Clientes" nav entry in `Layout.tsx` (`to: "/clientes"`, active on `/clientes` routes)

## 2. Clientes list screen (Pencil wu59x)

- [x] 2.1 Screenshot + read the reconciled Pencil frame `wu59x` and use it as the layout reference
- [x] 2.2 Build `ClientesPage.tsx` shell: `PageHeader` ("Clientes" + subtitle), `Search`, and a segment `Tab` strip (Todos / Activos / Inactivos)
- [x] 2.3 Fetch `trpc.listCustomers.useQuery({ search?, showInactive?, limit, offset })`; manage `segment` (→ `showInactive`), `search` (only sent at ≥2 chars), and page state
- [x] 2.4 Build the table with model-derived columns only: name (+ nickname), phone, cédula (`idNumber`), home address, active `Badge`; row click → `/clientes/:id`
- [x] 2.5 Loading / error / empty states
- [x] 2.6 "Cargar más" pagination (`limit`/`offset`, append)

## 3. Cliente detail screen (Pencil RrGyR)

- [x] 3.1 Screenshot + read the reconciled Pencil frame `RrGyR` and use it as the layout reference
- [x] 3.2 Build `ClienteDetailPage.tsx`: fetch `trpc.getCustomer.useQuery({ id })` (id from `useParams`); header (name + active `Badge`); back link; loading / error / not-found
- [x] 3.3 Contact & identity `SectionCard` with `KVRow`s for the real fields (nickname, phone, cédula, home address, collection point, job position, income, business-owner, ID-card-on-record, preferred payment day, notes); omit/empty for null values
- [x] 3.4 Loans section: `trpc.listLoansByCustomer.useQuery({ ... })` → one row per loan from returned fields; loans empty-state (display-only — no Préstamos screen to link to yet)
- [x] 3.5 Recent payments section: `trpc.listPaymentsByCustomer.useQuery({ ... })` → recent payments from returned fields; payments empty-state

## 4. Verify

- [x] 4.1 `npm run typecheck` + `npm run build -w @mikro/dashboard` clean
- [x] 4.2 Verified against the running apiserver (reviewer login): list loads with real customers, segments + search render, no JS errors
- [x] 4.3 Verified: detail renders contact/identity from real data, summary strip + loans + payments sections present
- [ ] 4.4 Visual diff list vs reconciled Pencil `wu59x` and detail vs reconciled `RrGyR`
