## 1. Shared helpers + shell wiring

- [x] 1.1 Add a shared `applicationStatus` helper module in the dashboard: `STATUS_META` (status → Spanish label + Badge tone), `RISK_BAND_META` (riskBand → label + tone), and `allowedActions(status)` mirroring the backend transition map (claim/approve/reject/reopen/sign/convert)
- [x] 1.2 Add routes `/solicitudes` and `/solicitudes/:id` under the auth guard in `src/App.tsx`, importing the two new pages
- [x] 1.3 Activate the "Solicitudes" nav entry in `Layout.tsx` (`to: "/solicitudes"`, active on `/solicitudes` routes)
- [x] 1.4 Repoint `OverviewPage.tsx` "Solicitudes recientes" from `listLoans` to `trpc.listApplications` (recent, rows → `/solicitudes/:id`); remove the inert "Nueva solicitud" CTA

## 2. Solicitudes list screen (Pencil Jnc0R)

- [x] 2.1 Screenshot + read Pencil frame `Jnc0R` (`get_screenshot` + `batch_get`) and use it as the pixel reference
- [x] 2.2 Build `SolicitudesPage.tsx` shell: `PageHeader` ("Solicitudes" + subtitle), `Search`, and a status `Tab` strip (Todas / Nuevas / En revisión / Aprobadas / Firmadas / Convertidas / Rechazadas / Borradores)
- [x] 2.3 Fetch `trpc.listApplications.useQuery({ status?, limit, offset })`; derive visible rows by client-side name search; manage `statusFilter`/`search`/page state
- [x] 2.4 Build the table: applicant (name + business), monto (RD$), score + risk-band `Badge`, status `Badge`, fecha; row click → `/solicitudes/:id`
- [x] 2.5 Loading / error / empty states; a clear "no access" message when the error is FORBIDDEN
- [x] 2.6 "Cargar más" pagination (limit/offset, append)

## 3. Solicitud detail screen (Pencil hHGM9)

- [x] 3.1 Screenshot + read Pencil frame `hHGM9` and use it as the pixel reference
- [x] 3.2 Build `SolicitudDetailPage.tsx`: fetch `trpc.getApplication.useQuery({ id })` (id from `useParams`); header (name + status Badge + ISC/risk band); back link; loading/error/not-found
- [x] 3.3 Request summary (`KVRow`s: monto, plazo, propósito, provincia, fechas) + applicant/business info; collapsible `SectionCard` rendering the full `rawData` submission
- [x] 3.4 Score breakdown: ISC + recommendation; the six `scoreData.categories` as `ProgressBar`s (weight + score); `flags` as `Badge`s; `evaluator_notes` as the interview-guide list
- [x] 3.5 Actions area driven by `allowedActions(status)`: claim / approve / reject (reason prompt) / reopen wired to the review mutations; invalidate `getApplication` (+ list) via `trpc.useUtils()` after each
- [x] 3.6 Contract: file input (PDF → base64) → `uploadSignedContract` when `APPROVED`; view/download via `getApplicationContract` when present
- [x] 3.7 Convert: loan-terms form (principal/termLength/paymentAmount/paymentFrequency, prefilled from requestedAmount/requestedTermWeeks) → `convertApplication` when `SIGNED`; when `CONVERTED`, show linked customerId/loanId read-only

## 4. Verify

- [x] 4.1 `npm run typecheck` + `npm run build -w @mikro/dashboard` clean
- [ ] 4.2 Against the running apiserver with a reviewer login: list loads, status tabs + search work, pagination appends
- [ ] 4.3 From the detail screen: claim → approve → upload PDF (SIGNED) → convert (loan terms) → CONVERTED with linked customer/loan; reject-with-reason and reopen also work; the score breakdown + full submission render
- [ ] 4.4 Visual diff list vs Pencil `Jnc0R` and detail vs `hHGM9`
