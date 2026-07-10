## Context

The loan-contract PDF is rendered by `renderContractPdf(data: ContractData)` (`mods/common/src/contracts`, server-only, pdfkit). Today its only caller is `createGenerateApplicationContract` (`mods/apiserver/src/api/applications`), which builds `ContractData` from a `LoanApplication` and is invoked from the mobile Evaluador via the `generateApplicationContract` reviewer procedure. Founders working in the dashboard have no way to produce a contract for an existing customer with no fresh application.

The founder copilot (`founder-copilot`) runs an LLM tool loop (`createCopilotChat`) with a closed tool policy (`mods/apiserver/src/api/copilot/toolPolicy.ts`) split into READ / WRITE / DIRECT lists. Reads answer inline; writes are intercepted and returned as a `pendingAction` confirm card. The chat reply schema (`copilotChatReplySchema`, `mods/common/src/schemas/copilot.ts`) is `{ reply, provenance?, pendingAction?, createdRule? }` — **no attachment channel** — and the dock (`CopilotDockContainer`) renders only `user | assistant | error | pendingAction | rule` thread items. So neither an editable multi-field form nor a returned PDF exists in the dock today.

The `Customer` row (`prisma schema`, `mods/common/src/types/customer.ts`) carries `name`, `idNumber`, `homeAddress`, `jobPosition`, `isBusinessOwner` — but **no `gender`, no `maritalStatus`**. Copilot read tools `getCustomer` / `getCustomerByPhone` already return the full row.

## Goals / Non-Goals

**Goals:**

- Founder asks the copilot for a contract → an interactive **form card** appears in the dock.
- The card collects a customer (search), gender, and loan terms; _Generá_ renders and downloads the PDF inline.
- Debtor identity is sourced from the `Customer` row; only the genuinely-missing fields (gender, terms, optional overrides) are asked.
- Each generation records a Founder-feed business event (durable record; PDF bytes stay ephemeral).
- Reuse `renderContractPdf` and the `mikro.json` contract config unchanged.

**Non-Goals:**

- No scheduled/recurring contract task (not a task-automation-catalog entry).
- No storage/attachment of the generated PDF; no application status change; signing stays in `loan-application-signing`.
- No application-sourced path (the Evaluador already covers applications).
- The copilot LLM does **not** extract the terms — the form collects them.

## Decisions

### D1 — Form card, not the confirm card

The existing `pendingAction` confirm card shows model-produced args verbatim with Confirm/Reject and submits only `{ actionId }`; it cannot collect or edit fields. Collecting a customer + gender + five terms requires a new **form-card** thread-item kind rendered client-side. The model's only job is to _open_ it.

_Alternative rejected:_ have the LLM gather all fields into a write-tool `pendingAction`. Rejected — the founder couldn't edit values, the picker couldn't search, and free-text term extraction is error-prone for a legal document.

### D2 — `openContractForm` as a DIRECT tool

Add `openContractForm` to the copilot **DIRECT** tool list (like `createWatchRule` / `createTask`). It takes no required arguments (optionally a customer hint if the founder named one), executes without an LLM confirm step, and returns a `contractForm` payload in the reply that the dock renders as the form card. Adds a `contractForm?` field to `copilotChatReplySchema` and a `contractForm` `ThreadItem` kind.

### D3 — Generation is a dedicated procedure, invoked by the card (not the LLM)

The card's _Generá_ button calls a new founder-only tRPC procedure `generateCustomerContract` directly. Input: `{ customerId, gender, principal, installments, frequency, installmentAmount, startDate, maritalStatus?, occupation? }`. It:

1. loads the `Customer` (404 if missing; BAD_REQUEST if it lacks name or `idNumber`),
2. builds `ContractData` — `name`, `cedula ← idNumber`, `city ← homeAddress`, `occupation ← occupation override ?? jobPosition`, `maritalStatus ← override ?? undefined`, `gender`/terms from input, `contractDate = today`,
3. `renderContractPdf(data)` → base64,
4. records the feed event (D5),
5. returns `{ dataBase64, filename, mimeType }`.

Factored as a validated function `createGenerateCustomerContract(db)` (DI, Zod-validated) mirroring `createGenerateApplicationContract`. A shared `buildContractDataFromCustomer` mapper keeps identity resolution in one place. Keeping generation off the LLM tool loop means the reply schema needs no PDF/attachment channel for the _generate_ step — the download comes from the direct mutation response.

### D4 — Customer search tool for the picker

The picker needs search-as-you-type. Add a `searchCustomers(query, limit)` founder read tool / API fn returning `{ id, name, phone, idNumber }[]` (matched on name or phone). Bind it in the copilot READ list so the model can also answer "¿tienes a … ?", and expose it to the dashboard for the picker (reuse the same API fn behind a tRPC query). Prefer extending an existing customer-list fn over a new query if one already covers name/phone search.

### D5 — Feed event `contract.generated`

On successful render, write a `business_events` row (type `contract.generated`) with payload `{ customerId, customerName, principal, installments, frequency, installmentAmount, startDate }` and the actor — no PDF bytes — following the event-log convention (written after the render succeeds; an event-write failure is logged, not fatal). `founder-feed` renders it as a card. Read-only w.r.t. business data, but it _does_ write an event row, so `generateCustomerContract` is a founder-authenticated procedure, not an anonymous read.

### D6 — Gender & city presentation

`gender` is a required M/F control on the card (drives Spanish grammatical agreement; not in the DB). `city` comes from `homeAddress` verbatim; the card shows it read-only once a customer is picked so the founder can spot a malformed address before generating (as seen with "San marco monterico"). Marital status / occupation are optional overrides, blank by default.

## Risks / Trade-offs

- **Net-new copilot surface (new reply field + thread-item kind + card)** → no precedent in the dock. Mitigation: keep the form card self-contained; reuse `saveFile`/`base64ToBytes` for download and the confirm card's visual frame for styling.
- **`homeAddress` is a full street address, not a city** → the contract's "domiciliado y residente en {city}" may read oddly. Mitigation: show it read-only on the card (D6) and allow the founder to eyeball it; a city-normalization pass is out of scope.
- **LLM opens the wrong card / hallucinates a contract** → mitigated because generation is a separate authenticated mutation the _card_ calls, never the model; the model can only open an empty form.
- **Customer has no gender on record** → always asked on the card; never guessed.

## Migration Plan

Additive only — no schema migration, no data backfill. New API fn + procedure, new tool-policy entries, new copilot reply field, new dashboard card. Rollback = revert; nothing persisted to migrate back. The `contract.generated` event type is new but the feed tolerates unknown/So-new event types by design (verify feed rendering handles it, add a card renderer).

## Open Questions

- Does an existing customer-list/search API fn already cover name+phone search (reuse per D4), or is a new `searchCustomers` fn needed? (Resolve in build.)
- Feed event type string: `contract.generated` vs a namespaced `copilot.contract` — pick the one matching the feed's existing event-type taxonomy during spec reconcile.
- Should the card expose the `application`-sourced path too later, or stay customer-only? (Out of scope now; note as a follow-up.)
