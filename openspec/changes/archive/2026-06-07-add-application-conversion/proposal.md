## Why

An application can now be scored and approved, but approval is a dead end — there is no way to turn an approved applicant into an actual borrower in Mikro. Phase 3 closes the pipeline: capture the signed contract, then convert the approved application into a real `Customer` + `Loan`, linking the records and marking the application `CONVERTED`.

## What Changes

- **Signing** — `uploadSignedContract` accepts a signed PDF (base64), writes the bytes to a configured contracts path (mirroring the receipts/attachments pattern), records contract metadata, and moves the application `APPROVED → SIGNED`.
- **Conversion** — `convertApplication` takes the operator-supplied loan terms (principal, term, payment amount, frequency, optional start date / mora rate), creates the `Loan`, and either **reuses an existing `Customer`** (matched by cédula, then phone) or creates a new one from the application's stable fields. It links `customerId`/`loanId` onto the application and sets status `CONVERTED`. Runs in a transaction; blocks double-conversion and unsigned conversion.
- **Read-back** — `getApplicationContract` returns the stored signed PDF (base64) for reviewers.
- Signing, conversion, and contract read are permitted for **ADMIN or REVIEWER** (`reviewerProcedure`).

### Decisions (already chosen)

- Conversion requires status `SIGNED` (approve → upload signed contract → convert).
- Loan terms are **operator input at conversion** (payment amount/frequency/interest aren't captured at intake), pre-fillable from `requestedAmount`/`requestedTermWeeks`.
- Returning borrowers (same cédula/phone) **reuse the existing `Customer`**.

## Capabilities

### New Capabilities

- `loan-application-signing`: Upload + store the signed contract PDF and the `APPROVED → SIGNED` transition, plus contract read-back
- `loan-application-conversion`: Convert a `SIGNED` application into a `Customer` (reuse-or-create) + `Loan`, link them, and set `CONVERTED`

### Modified Capabilities

- `loan-application-model`: `LoanApplication` gains contract/signing columns; the reserved `customerId`/`loanId` columns become populated on conversion

## Impact

- `mods/apiserver/prisma/schema.prisma` — contract/signing columns on `LoanApplication` + migration
- `mods/common/src/` — `contractsPath` config; `uploadSignedContractSchema`, `convertApplicationSchema`; sign/convert transition helpers; `DbClient` (customer lookup by `idNumber`, loanApplication update) + `LoanApplication` type
- `mods/apiserver/src/` — `createUploadSignedContract`, `createConvertApplication`, `createGetApplicationContract`; reviewer-gated tRPC mutations/query; contract file storage
- Out of scope: dashboard UI (Phase 4), generating the contract PDF (we only store the signed upload), notifications, e-signature integrations, post-conversion customer editing, and any changes to the loan repayment engine
