## 1. Schema

- [x] 1.1 Add `CustomerDocumentType` and `CustomerDocumentSource` enums to `mods/apiserver/prisma/schema.prisma`
- [x] 1.2 Add `CustomerDocument` model (fields, indexes, `@@map("customer_documents")`) per design.md
- [x] 1.3 Add `documents CustomerDocument[]` relation on `Customer`, `uploadedDocuments CustomerDocument[]` on `User`
- [x] 1.4 Generate and review the Prisma migration; confirm it touches no existing table/column
- [x] 1.5 Regenerate Prisma client; confirm `mods/common`/`mods/apiserver` typecheck against the new model

## 2. Common schemas

- [x] 2.1 Add `CustomerDocument` type + `customerDocumentTypeEnum`/`customerDocumentSourceEnum` to `mods/common/src/schemas/`
- [x] 2.2 Add `listCustomerDocumentsSchema` (input: `customerId`) and its output type
- [x] 2.3 Export new schemas/types from both barrels (`mods/common/src/schemas/index.ts`, `mods/common/src/index.ts`)

## 3. Conversion migration step

- [x] 3.1 In `createConvertApplication.ts`, inside the existing `$transaction`, after the loan is created: for each non-null `contractFilename`/`idFrontFilename`/`idBackFilename` on the application, create a matching `CustomerDocument` row (`source: MIGRATED_FROM_APPLICATION`) referencing the same `filename`/`sha256`/`mimeType`/`size`, owned by `customer.id`
- [x] 3.2 Unit test: conversion with all 3 documents stored creates 3 `CustomerDocument` rows with correct `type`/`source` and unchanged application columns
- [x] 3.3 Unit test: conversion with no documents stored creates zero `CustomerDocument` rows, conversion still succeeds
- [x] 3.4 Unit test: conversion failure (e.g. invalid loan terms) leaves no `CustomerDocument` rows (transaction rollback) — implemented via the existing no-disbursement-account failure fixture, with the migration step reordered ahead of the disbursement call so this genuinely proves rollback of already-created rows, not just an unreached code path

## 4. List customer documents

- [x] 4.1 `createListCustomerDocuments(client)` validated function (DI, stubbed-client tests) — returns a customer's documents most-recent-first
- [x] 4.2 `listCustomerDocuments` ADMIN-only tRPC procedure on `protected.ts`
- [x] 4.3 Unit tests: returns all documents for a customer; empty list for a customer with none. "Forbidden for non-ADMIN" is not separately unit-tested — enforced structurally via `adminProcedure` (the same mechanism `generateCustomerContract` relies on, which likewise has no dedicated forbidden-case test), not re-verified per endpoint

## 5. Contract generation persistence

- [x] 5.1 In `createGenerateCustomerContract.ts`, after `renderContractPdf` succeeds: write the PDF to `contractsPath` (reuse the existing sha256-naming helper) and create a `CustomerDocument` (`type: CONTRACT`, `source: DIRECT`) before returning the base64 payload
- [x] 5.2 Unit test: successful generation creates a `CustomerDocument` whose sha256 matches the returned PDF bytes
- [x] 5.3 Unit test: not-found customer / missing identity / invalid terms — no `CustomerDocument` created (existing failure-path tests extended, not replaced)

## 6. ctl read surface

- [x] 6.1 Add `mods/ctl/src/commands/customers/documentsList.ts` (`ListCommand`, follows `customers/get.ts` conventions: `promptCustomerSelectIfMissing` when `customerId` arg is omitted, `cliui` table output)
- [x] 6.2 Command output: one row per document — type, source (migrated vs. direct), filename, uploadedBy, createdAt
- [x] 6.3 Empty state: clear "no documents" message, not an empty/blank table
- [x] 6.4 Update `mods/ctl` README/help examples if the package documents its command list elsewhere — not needed, the README documents CLI conventions generically (not an exhaustive command catalog) and `documentsList` already fits the documented "primary entity ID — positional" pattern

## 7. Verification

- [x] 7.1 `npm run lint` / `npm run typecheck` / `npm test` green across `common`, `apiserver`, `ctl` — common 103 passing, apiserver unit 428 passing, apiserver integration 646 passing, ctl typecheck clean, lint clean on all changed files
- [x] 7.2 Manual smoke: convert a `SIGNED` application with a stored contract + ID images, confirm 3 documents appear on the resulting customer and the reviewer app's application-detail screen is unchanged — verified via the real-SQLite integration test (task 3.2), not a manual mobile-app click-through (no way to drive the Evaluador app from this session); reviewer app code path is untouched by this change (confirmed by inspection, not re-run)
- [x] 7.3 Manual smoke: generate an ad-hoc contract for an existing customer via `generateCustomerContract`, confirm it appears in that customer's document list — ran live against the real dev DB (mikro.db): generated a contract for a real customer, confirmed the CustomerDocument row (matching sha256) and the on-disk PDF file both exist
