## Why

The founder copilot can already create a customer or a loan today, but only through the generic `PendingActionCard` — a single narrative paragraph of raw `key value` pairs extracted by the LLM, confirmed with just Confirmar/Cancelar. There is no field-level editing or validation before a customer or loan is created. Customer and loan creation deserve a reviewable form UX. This is items 3+4 of the original 4-item plan that started with `add-customer-documents` (PR #197, items 1+2, already shipped).

While building the loan form card, contract generation (PR #196's `ContractFormCard`/`openContractForm`) turned out to overlap almost entirely with loan creation — both collect the same terms (principal, cuotas, frequency, amount, start date) — and its gender field (needed only for Spanish grammatical agreement in the contract text) added a decision the founder shouldn't have to make. Two follow-on decisions came out of that:

- The contract text is now written to be gender-neutral (invariant phrasing instead of `dominicano/a`, `domiciliado/a`), so no gender input is needed anywhere the app asks for contract terms.
- The standalone "generate a contract without creating a loan" flow is retired: it's folded into the loan form card as a checked-by-default checkbox in the same submit. A `ctl` command is added as a manual fallback for the rare case of a loan created without checking it (or a loan that predates this flow).

## What Changes

- Add a DIRECT tool `openCustomerForm` that opens an interactive `CustomerFormCard` in the copilot dock instead of executing `createCustomer` itself.
- Add a DIRECT tool `openLoanForm` that opens an interactive `LoanFormCard` in the dock instead of executing `createLoan` itself. The card includes a customer picker (via the shared `searchCustomers` read tool) since `createLoan` requires an existing `customerId`, plus a "generar contrato con estos términos" checkbox (checked by default) that also calls `generateCustomerContract` with the same submitted terms in the same flow — no separate step.
- Both cards submit directly to the existing `createCustomer` / `createLoan` tRPC mutations via `useMutation()`, off the LLM loop — the model never fabricates field values.
- `createCustomer` and `createLoan` remain registered in `WRITE_TOOLS` as a generic fallback (unchanged mutation code, unchanged confirm-card path still reachable), but a new `TOOL_NOTES` entry steers the model to prefer the dedicated form tools over calling the write tools directly.
- **BREAKING (internal, no external callers)**: retire the standalone `openContractForm` DIRECT tool and `ContractFormCard` dashboard component entirely, along with the `gender` input field on `generateCustomerContractSchema` / `generateApplicationContractSchema`. `generateCustomerContract` itself is kept — it's now called by the loan form card's checkbox and by a new `ctl customers:generateContract` fallback command.
- The shared contract renderer (`renderContractPdf`) is rewritten to be gender-neutral: no field on the debtor drives Spanish grammatical agreement. Applies to both the customer contract and the application-conversion contract (reviewer mobile app), since both share the same renderer.
- No create-customer-then-loan chaining, no other changes to the reviewer mobile app beyond removing its now-unused gender picker on the "Generar contrato" screen.

## Capabilities

### New Capabilities

(none — this extends the existing `founder-copilot` and `contract-generation` capabilities)

### Modified Capabilities

- `founder-copilot`: adds "Customer form card" and "Loan form card" requirements (the new DIRECT tools, editable form UX, checkbox-triggered contract generation, off-the-LLM-loop execution); removes "Contract form card" and "Contract generation runs off the LLM loop" (the retired standalone flow); rewords "Customer search for the form picker" to no longer name the retired card.
- `contract-generation`: removes `gender` from `generateCustomerContract`'s input and documents gender-neutral rendering; adds a requirement for the new `ctl customers:generateContract` manual-fallback command.

## Impact

- `mods/apiserver/src/api/copilot/toolPolicy.ts` — remove `openContractFormTool`/its registrations/`TOOL_NOTES` entry; add two new DIRECT tool definitions, registrations, and `TOOL_NOTES` entries.
- `mods/apiserver/src/api/copilot/createCopilotChat.ts` — remove the `contractForm` dispatch/response field; add dispatch handling for the two new tools.
- `mods/common/src/schemas/copilot.ts` — remove `copilotContractFormSchema`/`contractForm` from `copilotChatReplySchema`.
- `mods/common/src/schemas/customer.ts`, `application.ts` — remove `gender` from the two generate-contract schemas.
- `mods/common/src/contracts/{types,generator,customerContract}.ts` — remove `gender` from `ContractData`; rewrite the debtor clause to gender-neutral phrasing.
- `mods/apiserver/src/api/customers/createGenerateCustomerContract.ts`, `applications/createGenerateApplicationContract.ts` — drop gender passthrough.
- `mods/dashboard/src/founder/copilot/` — delete `ContractFormCard.tsx`/`.stories.tsx`; remove its wiring from `CopilotDockContainer.tsx`; add new `CustomerFormCard.tsx`, `LoanFormCard.tsx` + wiring.
- `mods/mobile/app/solicitud/[id]/generar-contrato.tsx` — remove the gender picker.
- `mods/ctl/src/commands/customers/generateContract.ts` — new fallback command (added).
- `mods/agents/src/tools/definitions.ts` — tool descriptions updated so the model knows to call `openCustomerForm`/`openLoanForm` rather than `createCustomer`/`createLoan` directly.
- No Prisma schema or migration changes — `CustomerDocument` persistence from `generateCustomerContract` is unchanged.
