## Why

Documents (signed contracts, cédula images) can currently only be stored on a `LoanApplication` row. That's a problem because not every customer has one: ad-hoc contracts generated for existing customers (`generateCustomerContract`, PR #196) have nowhere to persist, and the planned direct-create-customer/create-loan copilot flows will produce customers with no application at all. Customers need a document home that doesn't depend on having gone through the application pipeline.

The priority here is **storage and audit trail, not retrieval UI**: physical copies exist and are the day-to-day reference, so this change is about making sure the digital record is durably captured (for auditing, disputes, compliance) rather than building a polished way to browse it. The reviewer app's existing document view is untouched — reviewers occasionally still need it and it already works.

## What Changes

- New `CustomerDocument` model: `type` (`CONTRACT` / `ID_FRONT` / `ID_BACK` / `OTHER`), sha256 + filename/mime/size, `customerId`, `uploadedById`, `source` (`DIRECT` | `MIGRATED_FROM_APPLICATION`).
- `createConvertApplication`'s existing transaction gains a copy step: on conversion, it creates `CustomerDocument` rows referencing the application's already-stored contract/ID-image files by their existing sha256 path. No file move, no byte duplication — one new DB row per existing document.
- `LoanApplication`'s own `contract*`/`idFront*`/`idBack*` columns and files are untouched. They remain the immutable review-time audit record (already enforced: `createDeleteApplicationContract`/`createDeleteIdImage` refuse deletion once `status === CONVERTED`).
- The reviewer mobile app's application-detail screen (`Ver contrato`, customer/loan deep-links) is unchanged — this is additive, not a replacement of the application-scoped view.
- New read path: list a customer's documents (`ctl`-facing — no dashboard UI; the founder dashboard has no customer-detail page today, everything customer-facing there is conversational through the copilot, and this is occasional/operator-only usage, not a founder-facing flow), and a way to persist a `CONTRACT`-type document when `generateCustomerContract` runs (closes the "nowhere to persist" gap from PR #196).
- Confirmed edge case, no code needed: `CONVERTED` has no outgoing review transition (`REVIEW_TRANSITIONS` has no `reopen`/other rule keyed off `CONVERTED`) — reopen-after-convert is unreachable, so the migration step runs at most once per application, no duplicate-guard required.

## Capabilities

### New Capabilities

- `customer-documents`: a customer-scoped document store (list/fetch documents for a customer; upload/persist a document against a customer), independent of any loan application.

### Modified Capabilities

- `loan-application-conversion`: conversion now also migrates (copies, by reference) the application's stored contract and ID-image documents onto the resulting customer as `CustomerDocument` rows.
- `contract-generation`: ad-hoc contracts generated via `generateCustomerContract` are now persisted as a `CustomerDocument` (`source: DIRECT`) instead of download-only.

## Impact

- **Schema**: new `CustomerDocument` model + migration (`mods/apiserver/prisma/schema.prisma`).
- **apiserver**: `createConvertApplication.ts` (copy step inside its existing `$transaction`), new `createGenerateCustomerContract.ts` persistence call, new `listCustomerDocuments` procedure on `protected.ts`.
- **common**: new schemas (`CustomerDocument` type, list/create input schemas) in `mods/common/src/schemas/`.
- **ctl**: new `customers:documentsList` command (`mods/ctl/src/commands/customers/documentsList.ts`), following the existing `ListCommand`/`customers/get.ts` conventions. No dashboard change — the founder dashboard has no customer-detail page; this is an occasional/operator lookup, not a founder-facing flow.
- **mobile (Evaluador)**: no change — `solicitud/[id].tsx` and its document actions are left exactly as-is.
- **Storage**: reuses the existing `contractsPath` sha256-keyed file layout; no new storage mechanism.
