# customer-documents Specification

## Purpose

A document store for customers directly (signed contracts, cédula images, etc.), independent of whether the customer originated from a `LoanApplication`. Priority is storage/audit — the digital record must exist for auditing/disputes/compliance — not a browsing UI; retrieval is an occasional operator lookup via `ctl`, not a founder-facing dashboard flow.

## Requirements

### Requirement: Customers hold a list of documents independent of any application

A `Customer` SHALL be able to hold zero or more `CustomerDocument` records (`CONTRACT`, `ID_FRONT`, `ID_BACK`, `OTHER`), independent of whether the customer originated from a `LoanApplication`. Each document SHALL record its type, sha256, filename/original name/mime type/size, the customer it belongs to, who uploaded it (nullable, for system-originated documents), and its source (`DIRECT` — uploaded/generated directly against the customer — or `MIGRATED_FROM_APPLICATION` — copied at conversion time).

#### Scenario: A customer with no application can hold documents

- **WHEN** a `CustomerDocument` is created with a `customerId` for a customer that has no linked `LoanApplication`
- **THEN** the document is stored and associated with that customer

#### Scenario: Documents are immutable once created

- **WHEN** a `CustomerDocument` exists
- **THEN** there is no operation to edit its content or metadata in place — replacing a document means creating a new `CustomerDocument` record

### Requirement: Founders can list a customer's documents

The apiserver SHALL expose a founder-accessible procedure to list a customer's `CustomerDocument` records, ordered most-recent-first, without requiring a `LoanApplication` to exist.

#### Scenario: List returns all documents for a customer

- **WHEN** a founder lists documents for a `customerId` that has 3 `CustomerDocument` rows
- **THEN** all 3 are returned, most recently created first

#### Scenario: List is empty for a customer with no documents

- **WHEN** a founder lists documents for a customer with none
- **THEN** an empty list is returned, not an error

### Requirement: Document listing is restricted to founders

Listing a customer's documents SHALL be restricted to authenticated ADMIN users; other callers SHALL be rejected as forbidden.

#### Scenario: Non-admin is forbidden

- **WHEN** an authenticated non-ADMIN user requests a customer's document list
- **THEN** the request is rejected with an authorization error
