## 1. Data model + config (Prisma / @mikro/common config)

- [x] 1.1 Add to `LoanApplication`: `contractFilename` String? (`@map`), `contractOriginalName` String? (`@map`), `contractMimeType` String? (`@map`), `contractSize` Int? (`@map`), `contractSha256` String? (`@map`), `signedById` String? (`@map`), `signedAt` DateTime? (`@map`)
- [x] 1.2 Add a `contractsPath` config field in `mods/common/src/config.ts` (default like `receiptsPath`); document it in `mikro.json.example`
- [x] 1.3 Generate + apply the migration (trim the unrelated `mora_rate` drift, as before); run `prisma generate`; confirm client builds

## 2. Schemas + transitions + DbClient (@mikro/common)

- [x] 2.1 Add `uploadSignedContractSchema` (id-or-sessionId + `dataBase64`, `originalName`, `mimeType` restricted to `application/pdf`, size cap via `MAX_ATTACHMENT_SIZE_BYTES`) and a `getApplicationContractSchema` (id-or-sessionId)
- [x] 2.2 Add `convertApplicationSchema` (id-or-sessionId + `principal`, `termLength`, `paymentAmount`, `paymentFrequency`, `startingDate?`, `moraRate?`, `assignedCollectorId?`, `referredById?`) reusing loan-term validation patterns
- [x] 2.3 Extend the transition map with `sign` (APPROVED→SIGNED) and `convert` (SIGNED→CONVERTED) and expose them via the existing `resolveReviewTransition`/`ReviewAction` (or a sibling helper); export new input types
- [x] 2.4 Extend `DbClient`: `customer.findFirst` by `idNumber`; ensure `loanApplication.update` covers the contract/sign/convert columns; extend `LoanApplication` type + `LoanApplicationWriteData` with the new columns; build `@mikro/common`

## 3. Signing API + read (@mikro/apiserver)

- [x] 3.1 `createUploadSignedContract(client, { contractsPath })`: assert app is `APPROVED`; decode base64; write `<sha256>.pdf` to `contractsPath`; persist contract metadata + `signedById`/`signedAt`; set status `SIGNED`
- [x] 3.2 `createGetApplicationContract(client, { contractsPath })`: load app, read the stored file, return base64 + metadata; not-found if no contract or file missing
- [x] 3.3 Register reviewer-gated tRPC `uploadSignedContract` (mutation) + `getApplicationContract` (query) in `protected.ts`

## 4. Conversion API (@mikro/apiserver)

- [x] 4.1 `createConvertApplication(client)`: in a `$transaction` — assert status `SIGNED` and `customerId`/`loanId` null; resolve customer by `idNumber` then `phone` (reuse) else create from stable fields (validate cédula format; `isBusinessOwner=true`); create the `Loan` with operator terms (sequential loanId); set `customerId`/`loanId` + status `CONVERTED`; throw clear errors for invalid status / already converted / bad applicant data
- [x] 4.2 Register reviewer-gated tRPC `convertApplication` mutation in `protected.ts`
- [x] 4.3 Export the new API functions from `api/applications/index.ts` and `api/index.ts`

## 5. Verify

- [x] 5.1 `npm run build`/`typecheck` clean across `common` and `apiserver`
- [x] 5.2 Against a running apiserver (reviewer token): approve an app → upload a small PDF → status `SIGNED`, contract metadata set; `getApplicationContract` returns the bytes
- [x] 5.3 Convert with loan terms → a `Customer` + `Loan` exist, application is `CONVERTED` with `customerId`/`loanId` set
- [x] 5.4 Converting again is blocked (already converted); converting an unsigned (APPROVED-only) app is blocked
- [x] 5.5 A returning borrower (same cédula) reuses the existing `Customer` (no duplicate); a non-reviewer is forbidden
