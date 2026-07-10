## Context

Documents currently live only on `LoanApplication` (`contractFilename`/`contractSha256`/etc., `idFront*`/`idBack*`), with bytes on disk under `contractsPath` keyed by sha256 (`mods/apiserver/prisma/schema.prisma:518-539`). That's a dead end for two upcoming needs: ad-hoc contracts for existing customers (`generateCustomerContract`, PR #196 — currently download-only, nothing persisted) and planned direct-create-customer/create-loan copilot flows, both of which produce customers with no `LoanApplication` row to hang a document off of.

Blast-radius research (see conversation) established:

- The reviewer mobile app (`mods/mobile/app/solicitud/[id].tsx:361,384-405`) reads the application's own `contract*` columns for its "Ver contrato" tile and post-conversion customer/loan deep-links. It's read-only with respect to this change — untouched.
- `createDeleteApplicationContract.ts:28` and `createDeleteIdImage.ts:24` already refuse deletion once `status === CONVERTED`, so the application's files are frozen at conversion time independent of anything this change does.
- `REVIEW_TRANSITIONS` (`mods/common/src/schemas/application.ts:370-372`) defines no transition out of `CONVERTED` (reopen is `APPROVED`/`REJECTED` only, enforced both client and server side) — reopen-after-convert is unreachable, so the migration step in conversion runs at most once per application.

## Goals / Non-Goals

**Goals:**

- Give any `Customer` a document list, independent of whether it came from an application.
- On conversion, make the application's already-stored contract/ID-image documents visible as customer documents — without moving, duplicating, or mutating the underlying files or the application's own columns.
- Give `generateCustomerContract` a place to persist the PDF it renders (closes the PR #196 gap).
- Give an operator a way to see a customer's documents occasionally, via `ctl`.

**Non-Goals:**

- No change to the reviewer mobile app's application-scoped document UI or endpoints.
- No new storage backend — reuses the existing `contractsPath` sha256-keyed disk layout.
- No document _editing_/versioning; a document is immutable once created (matches the existing application-side model, where update = delete-then-reupload).
- No handling for reopen-after-convert re-running the migration — confirmed unreachable (see Context), so no duplicate-guard is built for it.
- No dashboard UI. The founder dashboard has no customer-detail page — confirmed by walking the actual screens: selecting a customer in `/founder/buscar` search results doesn't navigate anywhere, it opens the copilot with `"Muéstrame al cliente {name}"` (`BusquedaScreen.tsx:173`). Every customer-facing surface in the founder app today is conversational through the copilot, not a page. Building a real customer-detail page (or a copilot documents card) is a bigger, separate piece of work; this change's document visibility is occasional/operator-only, so it goes through `ctl` instead.

## Decisions

**1. New `CustomerDocument` model, not a generalized `Attachment`.**
`Attachment` is shaped around chat: it's 1:1 with a `Message`, no type taxonomy beyond `AttachmentType`, no sha256/dedup, no provenance. Overloading it with an optional `customerId` would couple two different concerns (ephemeral chat attachments vs. formal customer records with audit provenance) and need an XOR constraint. A dedicated model matches how the application-side fields are already shaped (sha256 + filename + mime + size) and adds only what's new: `type`, `customerId`, `uploadedById`, `source`.

```prisma
enum CustomerDocumentType {
  CONTRACT
  ID_FRONT
  ID_BACK
  OTHER
}

enum CustomerDocumentSource {
  DIRECT
  MIGRATED_FROM_APPLICATION
}

model CustomerDocument {
  id           String                 @id @default(uuid())
  type         CustomerDocumentType
  filename     String                 @map("filename") // sha256-keyed name on disk, matches LoanApplication convention
  originalName String?                @map("original_name")
  mimeType     String?                @map("mime_type")
  size         Int?
  sha256       String
  source       CustomerDocumentSource
  customer     Customer               @relation(fields: [customerId], references: [id], onDelete: Cascade)
  customerId   String                 @map("customer_id")
  uploadedBy   User?                  @relation(fields: [uploadedById], references: [id])
  uploadedById String?                @map("uploaded_by_id")
  createdAt    DateTime               @default(now()) @map("created_at")

  @@index([customerId])
  @@map("customer_documents")
}
```

**2. Migration is copy-by-reference, inside the existing conversion transaction, not a separate job.**
`createConvertApplication.ts` already runs customer/loan creation + ledger post in one `$transaction` (`createConvertApplication.ts:96-168`). Adding `CustomerDocument.create` calls there (one per non-null `contractFilename`/`idFrontFilename`/`idBackFilename` on the application) keeps everything atomic — if conversion fails, no orphaned documents; if it succeeds, the documents exist from the same moment the customer does. The new rows reference the _same_ `filename` (sha256) the application already wrote to disk — no file I/O, no new bytes, no duplication of storage.

**3. Application-side columns and files are never touched by this change.**
They stay as the immutable review-time audit trail (what was reviewed and signed, by whom, when) — already enforced by the existing CONVERTED delete-guards. `CustomerDocument` is a new read path onto the same files, not a move.

**4. `generateCustomerContract` persists via the same `CustomerDocument.create`, `source: DIRECT`.**
After `renderContractPdf` succeeds, write the PDF to `contractsPath` (existing helper, sha256-named) and create a `CustomerDocument` row (`type: CONTRACT`, `source: DIRECT`) before returning the base64 payload — download and persistence both happen, sourced from one render.

**5. The list surface is a `ctl` command, not a dashboard page or copilot card.**
The founder dashboard has no customer-detail page and no route a document list could hang off of (see Non-Goals). Two ways existed to add one: build a real customer-detail page, or add a copilot-triggered documents card (consistent with the app's existing conversational pattern). Both are real UI investment for something that, per the product owner, is checked occasionally by an operator — not a founder-facing flow. `mods/ctl` already has the exact shape needed: a `ListCommand` base class and a `customers/` command group (`get.ts`, `create.ts`, `list.ts`). Adding `customers/documentsList.ts` there costs one small file and reuses `promptCustomerSelectIfMissing` and the existing `cliui` table-rendering conventions — no new page, no new nav, no Pencil work. If founder-facing visibility is wanted later, it's a separate, explicitly-scoped change (dashboard page or copilot card), not a default of this one.

## Risks / Trade-offs

- **[Risk]** A customer converted before this change ships has no `CustomerDocument` rows even though their application has files. → **Mitigation**: none needed for new conversions going forward; a backfill script (walk `CONVERTED` applications with non-null `contract*`/`idFront*`/`idBack*`, create matching rows) is a cheap follow-up if historical parity is wanted — out of scope for this change unless requested.
- **[Risk]** Two read paths for the same physical file (application row vs. customer document row) could drift if one side's metadata is ever edited independently. → **Mitigation**: neither side supports editing (immutable-once-created on both), so drift isn't reachable today.
- **[Trade-off]** Not generalizing `Attachment` means two document-ish models in the schema long-term. Accepted: chat attachments and formal customer records have different lifecycles and it's clearer to keep them apart than to force a shared shape.

## Migration Plan

- Additive Prisma migration: two new enums, one new table, one new relation on `Customer` (`documents CustomerDocument[]`) and `User` (`uploadedDocuments CustomerDocument[]`). No changes to existing tables/columns.
- Deploy order: migration → apiserver (adds the copy step + persistence call) → dashboard (adds the document-list read). Each layer degrades gracefully if deployed out of order (missing table = 500 on the new endpoints only; old behavior on `LoanApplication` is unaffected either way).
- Rollback: drop the new table/enums/relations; no data loss to existing models since nothing existing was modified.

## Open Questions

- None blocking. Historical backfill (existing `CONVERTED` applications) is a follow-up, not a blocker for this change.
