## Why

Loan contracts can only be generated inside the mobile Evaluador (review) flow, which keys off a `LoanApplication`. Founders routinely need a contract for an **existing customer** taking a new loan — someone who already has a `Customer` row and no fresh application. Today they cannot produce one from the founder app at all. The generator itself (`renderContractPdf`) is already stateless, server-only, and reused; only an on-demand, customer-sourced entry point is missing.

## What Changes

- Add an **interactive contract form card** to the founder copilot dock. When the founder asks the copilot for a contract, the model calls a new `openContractForm` tool that returns a form-card thread item; the copilot replies with a short acknowledgement above it. This is a new kind of copilot card — distinct from the existing confirm card, which only displays model-produced arguments verbatim and cannot collect or edit input.
- The form card collects: a **customer** via search-as-you-type (resolving a `Customer` row), the debtor's **gender** (not stored on the customer), and the negotiated **terms** (principal, installments, frequency, installment amount, start date), plus optional marital-status / occupation overrides. `contractDate` defaults to today.
- Add a `generateCustomerContract` apiserver procedure that resolves the debtor's `ContractData` identity from the **`Customer` row** (name, cédula ← `id_number`, city ← `home_address`, occupation ← `job_position`) merged with the supplied gender + terms, renders via the existing `renderContractPdf`, and returns the PDF as base64. The dock downloads it inline on success.
- Add a **customer-search read tool** so the form card's picker can resolve customers by name/phone.
- Record a **business event** on generation (customer + terms in the payload, no PDF bytes) so the action appears in the Founder feed as a durable record — the PDF itself stays ephemeral.
- Reuse the existing `renderContractPdf` generator and `mikro.json` contract config (creditor/bank/notary) unchanged — the procedure MUST NOT reimplement contract rendering.

## Capabilities

### New Capabilities

- `contract-generation`: on-demand loan-contract generation from the founder app — resolving `ContractData` from a `Customer` reference plus founder-supplied gender and terms, rendering the PDF via the shared generator, returning it for download, and recording a feed event. Read-only with respect to business data (produces a document, changes no loan/customer/application records).

### Modified Capabilities

- `founder-copilot`: adds the interactive contract **form card** (a new thread-item kind beyond user/assistant/error/pendingAction/rule), the `openContractForm` direct tool that opens it, a customer-search read tool for its picker, and the reply/attachment channel that carries the generated PDF back to the dock for download.
- `founder-feed`: a contract-generation business event becomes a rendered feed card.

## Impact

- **Code**: `mods/common/src/contracts` (generator/types reused; new customer→`ContractData` mapper), a new `generateCustomerContract` API fn + tRPC procedure, the copilot tool policy (`openContractForm` + customer-search tools) and reply schema (`mods/common/src/schemas/copilot.ts`), and the dashboard copilot dock (new form-card + download, `saveFile`).
- **Data**: reads `customers` (identity) and `mikro.json` contract config; writes one `business_events` row per generation. No schema migration.
- **Dependencies**: none new — pdfkit already ships via `@mikro/common/contracts`.
- **Out of scope**: scheduling a recurring contract task, storing/attaching the generated PDF bytes, application-sourced generation (the review flow already covers that), and any application status transition (signing stays in `loan-application-signing`).
