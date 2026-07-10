## 1. Retire the standalone contract form flow

- [x] 1.1 Remove `openContractFormTool` and its `COPILOT_LOCAL_TOOLS`/`DIRECT_TOOLS`/`TOOL_NOTES` entries from `toolPolicy.ts`
- [x] 1.2 Remove the `contractForm` dispatch case, local variable, and response spread from `createCopilotChat.ts`
- [x] 1.3 Remove `copilotContractFormSchema`/`contractForm` from `copilotChatReplySchema` (`schemas/copilot.ts`) and both barrels
- [x] 1.4 Delete `ContractFormCard.tsx` + `.stories.tsx`; remove its wiring (import, dispatch case, `contractCustomers`/`contractStatus` state, `handleGenerateContract`, render switch case) from `CopilotDockContainer.tsx`
- [x] 1.5 Delete the now-obsolete `contractFormTool.test.ts`; prune dead `ContractFormValues`/`ContractFormStatus`/`ContractFormMessage` types, rename `ContractCustomer` → `CustomerPickerResult` in `dashboard/src/founder/copilot/types.ts`

## 2. Make contract generation gender-neutral

- [x] 2.1 Rewrite the debtor clause in `renderContractPdf` (`mods/common/src/contracts/generator.ts`) to invariant phrasing: no honorific, "de nacionalidad dominicana", "con domicilio y residencia en" — confirmed wording with the user first
- [x] 2.2 Remove `gender` from `ContractData` (`contracts/types.ts`), `CustomerContractTerms`/`buildContractDataFromCustomer` (`contracts/customerContract.ts`)
- [x] 2.3 Remove `gender` from `generateCustomerContractSchema` (`schemas/customer.ts`) and `generateApplicationContractSchema` (`schemas/application.ts`)
- [x] 2.4 Remove gender passthrough + update doc comments in `createGenerateCustomerContract.ts` and `createGenerateApplicationContract.ts`
- [x] 2.5 Remove the gender picker from the reviewer mobile app's `generar-contrato.tsx` screen
- [x] 2.6 Update `customerContract.test.ts` and `createGenerateCustomerContract.test.ts` to drop gender fixtures/assertions
- [x] 2.7 Full-repo grep confirming no remaining `gender`/`sexo` reference outside doc comments, and confirming gender was never part of the `LoanApplication`/`Customer` data model (contract-generation-time-only)

## 3. Backend: new tool policy for customer/loan creation

- [x] 3.1 Add `openCustomerFormTool` and `openLoanFormTool` `ToolFunction` defs in `toolPolicy.ts` (Spanish description, `customerHint` optional param on the loan tool only)
- [x] 3.2 Register both in `COPILOT_LOCAL_TOOLS` and `DIRECT_TOOLS`
- [x] 3.3 Add `TOOL_NOTES` entries for `openCustomerForm` and `openLoanForm` steering the model away from calling `createCustomer`/`createLoan` directly or inventing field values

## 4. Backend: dispatch

- [x] 4.1 In `createCopilotChat.ts`, add `customerForm`/`loanForm` local variables
- [x] 4.2 Dispatch `openCustomerForm` → set `customerForm = {}`, no DB work
- [x] 4.3 Dispatch `openLoanForm` → capture optional `customerHint`, set `loanForm = { customerHint }`
- [x] 4.4 Spread `customerForm`/`loanForm` into the chat response; add matching fields to `copilotChatReplySchema`

## 5. Agent tool definitions / system prompt

- [x] 5.1 `createCustomerTool`/`createLoanTool` (`mods/agents/src/tools/definitions.ts`) are shared with the WhatsApp-agent context, so steering lives in `TOOL_NOTES` (founder-copilot-scoped), not in the shared definitions — no change needed there. Updated the ACTUAR section of `systemPrompt.ts`'s base prompt instead (it explicitly listed "crear un cliente, crear un préstamo" as directly-proposable writes) to point at `openCustomerForm`/`openLoanForm`

## 6. Dashboard: CustomerFormCard

- [x] 6.1 Add `CustomerFormCard.tsx` under `mods/dashboard/src/founder/copilot/` — fields for every `createCustomerSchema` field, required fields validated before enabling submit
- [x] 6.2 Assigned-collector field: `listUsers` filtered client-side to `roles.some(r => r.role === "COLLECTOR")` (no server-side role filter param existed)
- [x] 6.3 Wire `customerForm` thread-item kind in `CopilotDockContainer.tsx`: render switch, `createCustomer` mutation via `useMutation()`, idle/creating/done/error status handling
- [x] 6.4 Storybook stories (idle/creating/done/error) — no dashboard test runner exists (confirmed, matches prior findings), Storybook + typecheck + lint is the verification surface

## 7. Dashboard: LoanFormCard

- [x] 7.1 Add `LoanFormCard.tsx` under `mods/dashboard/src/founder/copilot/` — customer picker wired fresh to `listCustomers` search, fields for every `createLoanSchema` field except `type`, "generar contrato con estos términos" checkbox (checked by default), no gender field
- [x] 7.2 Wire `loanForm` thread-item kind in `CopilotDockContainer.tsx`: render switch, `createLoan` mutation, `customerHint` pre-seed
- [x] 7.3 On submit with the checkbox checked: call `createLoan` then `generateCustomerContract` with the same terms (falls back to today's date if `startingDate` was left blank), single flow, no second step; unchecked → `createLoan` only
- [x] 7.4 Storybook stories (idle/hint/creating/done/error)

## 8. ctl: manual contract-generation fallback

- [x] 8.1 Add `mods/ctl/src/commands/customers/generateContract.ts` (`MutationCommand`, prompts for customer + terms, calls `generateCustomerContract`, writes the PDF to `--output`)
- [x] 8.2 Verify `ctl` build/typecheck picks up the updated `generateCustomerContract` input type (gender removed) after rebuilding `apiserver`

## 9. Tests

- [x] 9.1 Integration test (`test/integration/copilot.test.ts`, describe "customer/loan form cards"): `openCustomerForm`/`openLoanForm` dispatch returns the right payload shape, performs no DB writes (`db.customer.count()`/`db.loan.count()` stay 0), and the empty-reply fallback text fires
- [x] 9.2 Unit test (`test/copilot/customerLoanFormTools.test.ts`): both bound as DIRECT tools, `createCustomer`/`createLoan` still bound as WRITE tools (fallback), `openContractForm` no longer bound
- [x] 9.3 No dashboard test runner exists (confirmed — package.json has no `test` script, only typecheck/lint/Storybook). Storybook stories + clean typecheck/lint are the verification surface, same precedent as the now-retired `ContractFormCard`
- [~] 9.4 Same no-test-harness limitation as 9.3 — verified by code reading instead: `handleCreateLoan` destructures `generateContract` off `values` before calling `createLoan`, and only calls the `generateCustomerContract` mutation inside `createLoan`'s `onSuccess` when that flag was true, with the exact terms just submitted (`installments: values.termLength`, etc.) — not re-derived. No automated test; flag as a known gap like 9.3.

## 10. Spec sync prep

- [x] 10.1 `openspec validate add-customer-loan-copilot-cards --strict` clean
- [ ] 10.2 Manual smoke: ask the copilot to create a customer and a loan (checkbox on and off), confirm both form cards render and submit correctly; run `ctl customers:generateContract` once as a smoke check — not yet run this session (no running dev server); recommend before archiving
