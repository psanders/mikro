## Context

`createCustomer` and `createLoan` are registered in `WRITE_TOOLS` (`toolPolicy.ts:461-462`) and today go through the generic `PendingActionCard` (`mods/dashboard/src/founder/copilot/PendingActionCard.tsx:57-143`): one narrative paragraph built from whatever `key value` pairs the LLM extracted, Confirmar/Cancelar, no field editing. `ContractFormCard` (PR #196) proved a better pattern for this class of write: a DIRECT tool opens an editable form card in the dock; the card's own submit handler calls the tRPC mutation directly via `useMutation()`, fully decoupled from the LLM tool-call loop. This change applies that same pattern to customer and loan creation — and, while building the loan side, folds contract generation into it and retires the standalone contract flow (Decisions 3-5 below).

## Goals / Non-Goals

**Goals:**

- `openCustomerForm` / `openLoanForm` DIRECT tools that open editable `CustomerFormCard` / `LoanFormCard` cards, following the same tool shape/dispatch pattern `openContractForm` used.
- Both cards submit to the existing `createCustomer` / `createLoan` mutations unchanged — no schema or validation changes to those two.
- `LoanFormCard` includes a customer picker (`createLoan` requires an existing `customerId`), via the shared `searchCustomers` read tool.
- `LoanFormCard` has a "generar contrato con estos términos" checkbox, checked by default. On submit, if checked, the card calls `createLoan` then `generateCustomerContract` with the same terms, as one flow — no second step, no extra fields (see Decision 3).
- The contract text itself is rewritten to be gender-neutral, so no gender field exists anywhere in the app's contract-generation surfaces (see Decision 4).
- The standalone `openContractForm`/`ContractFormCard` flow is retired; a `ctl` command covers the rare manual-fallback case (see Decision 5).

**Non-Goals:**

- No raw file-upload capability (attaching an already-signed physical scan). Discussed and explicitly deferred — same reasoning as the retired standalone flow: no upload endpoint exists anywhere in the app today, and it would need new validation/storage-path handling out of scope here.
- No combined "create customer, then immediately create a loan for them" chained flow. The founder can open `openCustomerForm` then separately open `openLoanForm` once the customer exists; chaining is a possible later enhancement, not this change.
- No changes to `createCustomer`/`createLoan` validation, the reviewer mobile app's conversion/review flow, or the `add-customer-documents` migration/ctl work already shipped.

## Decisions

**1. Keep `createCustomer`/`createLoan` in `WRITE_TOOLS`, don't remove them.**
Removing them would require the model to always succeed at picking the new DIRECT tool with no fallback; keeping the confirm-card path alive costs nothing. Steering happens via new `TOOL_NOTES` entries (`openCustomerForm`/`openLoanForm`: "es la ÚNICA forma de crear un cliente/préstamo: solo abre el formulario, no inventes los campos").

**2. `LoanFormCard`'s customer picker is built fresh against `searchCustomers`, not extracted from a retired component.**
Since `ContractFormCard` is being deleted (Decision 5), there's nothing to extract the picker _from_ — `LoanFormCard` gets its own picker wired directly to the container's customer-search query, following the same UX (name/idNumber/phone display, `customerHint` pre-seed from the tool call) without importing dead code.

**3. Contract generation is a checkbox in the same submit, not a second step or a separate card.**
`LoanFormCard` already collects every term `generateCustomerContract` needs (principal, installments, frequency, installmentAmount, startDate) — they're identical to `createLoan`'s own terms. A checked-by-default checkbox means one submit does both: `createLoan` then `generateCustomerContract` with the same values. This was originally designed as a separate post-create offer card, then simplified twice during design review: first collapsed into a single form (no extra step), then the gender field it depended on was removed entirely once the contract text became gender-neutral (Decision 4) — at which point the checkbox needs no companion fields at all.

**4. The contract text is rewritten to be gender-neutral; the `gender` field is removed everywhere.**
`renderContractPdf` used `data.debtor.gender` to choose `el señor`/`la señora`, `dominicano`/`dominicana`, and a `domiciliado`/`domiciliada` suffix. Rewritten to invariant phrasing: no honorific, `de nacionalidad dominicana` (agrees with "nacionalidad", not the person), `con domicilio y residencia en` (no gendered suffix). This removes `gender` from `ContractData`, `generateCustomerContractSchema`, `generateApplicationContractSchema`, `ContractFormValues`/`CustomerContractTerms`, and the reviewer mobile app's "Generar contrato" gender picker — the same renderer serves both the customer contract and the application-conversion contract, so both benefit. Confirmed via a full-repo grep that no `gender`/`sexo` field exists on the `LoanApplication`/`Customer` data model itself — it was only ever asked at contract-generation time, at exactly the two call sites just listed, so this has no blast radius beyond contract generation.

**5. The standalone `openContractForm`/`ContractFormCard` flow is retired outright, not repurposed.**
Once contract generation folds into loan creation (Decision 3), the only remaining use case for a _standalone_ "generate a contract for an existing loan" flow is backfilling a loan that predates this feature or was created with the checkbox unchecked — rare enough that a `ctl` command (`customers:generateContract`, modeled on the existing `payments:generateReceipt` and `loans:create` commands) covers it without maintaining a copilot card, DIRECT tool, and dashboard component for it. `generateCustomerContract` itself is unchanged and still callable from both `LoanFormCard`'s checkbox and the new ctl command.

**6. `openLoanForm`/`openCustomerForm` do no DB work.**
Dispatch in `createCopilotChat.ts` captures an optional `customerHint` (loan form only) and returns a bare form-open signal, mirroring how `openContractForm` used to work before its removal.

## Risks / Trade-offs

- [Two form cards to maintain] → both are thin, schema-driven forms with no business logic of their own; keep field lists directly traceable to `createCustomerSchema`/`createLoanSchema` so schema changes are easy to spot as form drift.
- [Retiring a feature merged earlier the same day (PR #196)] → confirmed with the user before removing; the underlying `generateCustomerContract` procedure, its schema (minus gender), and its `CustomerDocument` persistence are all kept — only the copilot-card UX and its gender field are retired, not the capability.
- [`TOOL_NOTES` steering is a prompt-level nudge, not a hard constraint] → the `WRITE_TOOLS` fallback path means a model miss still produces a reviewable confirm card, never a silent wrong write.
- [Contract wording change touches a real legal document] → confirmed the exact replacement phrasing with the user before applying it repo-wide (neutral rephrase: "de nacionalidad dominicana" / "con domicilio y residencia en").

## Migration Plan

Additive for the two new tools/cards/ctl command; removal-only for `openContractForm`/`ContractFormCard`/the `gender` schema fields (no data migration — `gender` was never persisted, only passed through per-request). No rollback concerns beyond reverting the PR.

## Open Questions

None outstanding — customer-loan chaining and file upload were raised and explicitly deferred above; the contract-wording replacement and the standalone-flow retirement were both confirmed with the user during design.
