## Context

`LoanApplication` already carries the full lifecycle enum, an advisory score, review audit columns, and reserved nullable `customerId` (String) + `loanId` (Int) columns (Phase 1) for the conversion link. The apiserver has `reviewerProcedure` (ADMIN or REVIEWER) and a `resolveReviewTransition` helper. Customer/Loan creation contracts exist: `createCustomerSchema` (phone normalized to E.164; `idNumber` must match `^\d{3}-\d{7}-\d{1}$`; `homeAddress` required; `isBusinessOwner`; optional `referredById`/`assignedCollectorId`) and `createCreateLoan` (sequential `loanId` from 10000; needs principal/termLength/paymentAmount/paymentFrequency/startingDate?/moraRate?). Accounting attachments set the file pattern: base64 in, bytes to a configured disk path, metadata (`filename`/`originalName`/`mimeType`/`size`/`sha256`) in columns; `MAX_ATTACHMENT_SIZE_BYTES` = 10 MB.

## Goals / Non-Goals

**Goals:**

- Store a signed contract PDF and move `APPROVED → SIGNED`.
- Convert a `SIGNED` application into a `Customer` (reuse-or-create) + `Loan`, atomically, with clear guards.
- Keep signing/conversion available to ADMIN or REVIEWER.

**Non-Goals:**

- Generating the contract PDF (we only store the signed upload), e-signature, dashboard UI, notifications, post-conversion edits, repayment-engine changes.

## Decisions

### Signing: PDF upload mirrors accounting attachments

`uploadSignedContract` takes `{ id|sessionId, dataBase64, originalName, mimeType }`, requires `mimeType === "application/pdf"`, enforces a size cap (reuse `MAX_ATTACHMENT_SIZE_BYTES`), and requires the app be `APPROVED`. Bytes are written to a new configured `contractsPath` as `<sha256>.pdf` (content-addressed, dedupes identical re-uploads); metadata is stored on the row: `contractFilename`, `contractOriginalName`, `contractMimeType`, `contractSize`, `contractSha256`, `signedById`, `signedAt`. Status → `SIGNED`. `getApplicationContract` reads the file back as base64 for reviewers.

### Transitions extend the existing helper

Add `sign` (`APPROVED → SIGNED`) and `convert` (`SIGNED → CONVERTED`) to the transition map alongside the review actions, so the same validation + clear-error pattern applies. Reopen already returns a row to `IN_REVIEW`; a reopened row would need re-approval + re-sign before convert, which the guards enforce naturally.

### Conversion is transactional, reuse-or-create customer

`convertApplication` takes `{ id|sessionId, principal, termLength, paymentAmount, paymentFrequency, startingDate?, moraRate?, assignedCollectorId?, referredById? }`. Steps, inside `db.$transaction`:

1. Load the app; assert status `SIGNED` and `customerId`/`loanId` both null (else `CONFLICT`: already converted / not signed).
2. Resolve the customer: look up by `idNumber` (cédula); if none, by `phone`. If found, reuse it (attach the loan); else create a new `Customer` from the app's stable fields — `name = firstName + lastName`, `phone`, `idNumber`, `homeAddress`, `isBusinessOwner = true`, optional `assignedCollectorId`/`referredById`. Validate `idNumber` matches the cédula format; if not, `BAD_REQUEST` naming the bad field (the operator must fix the application data first).
3. Create the `Loan` with the operator-supplied terms (sequential `loanId`).
4. Set `application.customerId`, `application.loanId`, status `CONVERTED`.

Doing it in a transaction means a failure (e.g. bad loan terms) leaves no orphan customer/loan and no half-converted application.

### Loan terms come from the operator

`requestedAmount`/`requestedTermWeeks` pre-fill the form, but `paymentAmount`, `paymentFrequency`, and interest are set at conversion (they are not captured at intake, and the score only assumed them). The mutation input is authoritative.

### ADMIN or REVIEWER

Signing, conversion, and contract read use `reviewerProcedure`. Conversion creates financial records, but the chosen policy lets reviewers run the whole flow.

## Risks / Trade-offs

- **Customer reuse by cédula could merge the wrong person if cédula data is dirty** → Match cédula first (strong key), phone as fallback; the operator sees the existing customer in the dashboard (Phase 4) before converting. Acceptable for v1.
- **Contract bytes on disk, metadata in DB can drift** → Content-addressed filename (`<sha256>.pdf`) + stored `sha256` lets us detect mismatch on read; missing file surfaces a clear error.
- **Reused customer keeps its existing info (no forced refresh)** → We attach the loan and do not overwrite the existing customer's fields by default, avoiding clobbering curated data; a deliberate refresh can be a later option.
- **Transaction support** → `DbClient.$transaction` exists (used elsewhere); conversion relies on it.

## Open Questions

- Should reuse refresh the existing customer's phone/address from the new application, or leave it untouched? (Defaulting to leave untouched.)
