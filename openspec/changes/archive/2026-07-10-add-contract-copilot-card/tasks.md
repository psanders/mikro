## 1. Shared schema + contract-data mapping (@mikro/common)

- [x] 1.1 Add `generateCustomerContractSchema` (customerId, gender, principal, installments, frequency, installmentAmount, startDate, optional maritalStatus/occupation) + exported input type in `mods/common/src/schemas`
- [x] 1.2 Add a `buildContractDataFromCustomer(customer, terms)` mapper producing `ContractData` (name, cedula←idNumber, city←homeAddress, occupation←override??jobPosition, gender/terms from input, contractDate=today). Kept decoupled from schemas (own terms type); did NOT refactor the application path (follow-up)
- [x] 1.3 Unit-test the mapper: identity from customer, terms from input, occupation override precedence, job-position fallback, marital-status passthrough, date normalization — green (6 tests)

## 2. Generation API fn + procedure (apiserver)

- [x] 2.1 `createGenerateCustomerContract(db)` validated fn: load customer (404 if missing, BAD_REQUEST if no name/idNumber), build ContractData via the mapper, `renderContractPdf`, return `{ dataBase64, filename, mimeType }`; persist no PDF bytes
- [x] 2.2 `contract.generated` event: added to enum + payload schema (`businessEvent.ts`) + mapper (`mappers.ts`) writing customerId/customerName/terms via the `.meta({ event })` middleware (log-not-fail, no event on failed resolver — inherited from eventCapture)
- [x] 2.3 Wire the founder-only (ADMIN) `generateCustomerContract` tRPC procedure (`.meta({ event: "contract.generated" })`) to the fn
- [~] 2.4 Customer search — REUSE existing `createListCustomers` (already searches name/nickname/phone with pagination). No new `searchCustomers` fn/tool. Picker will call the existing `listCustomers` query.
- [x] 2.5 Unit tests (5, green): happy path returns a real %PDF; not-found; missing identity; invalid terms → ValidationError with DB never queried; malformed id → ValidationError before lookup. apiserver typecheck clean. (non-admin forbidden = adminProcedure gate, covered by integration; noted)

## 3. Copilot tool policy + reply channel

- [x] 3.1 Add `openContractForm` to the DIRECT tool list; executor returns a `contractForm` payload (optional customer hint), generates nothing
- [~] 3.2 No new copilot READ tool: the picker calls the dashboard's existing `listCustomers` tRPC query directly (search-as-you-type). The copilot already has getCustomer/getCustomerByPhone for chat lookups; a search tool wasn't needed.
- [x] 3.3 Extend `copilotChatReplySchema` with `contractForm?` and thread the payload through `createCopilotChat` return
- [x] 3.4 Update the copilot system-prompt/tool notes so the model opens the form (never tries to gather terms or generate)
- [x] 3.5 Unit-test: contract request yields a `contractForm` reply and no generation; `openContractForm` is the only contract tool bound

## 4. Dashboard copilot form card (Storybook-first)

- [x] 4.1 Build the `ContractFormCard` component in isolation with Storybook stories (empty, customer-picked, validation-error, generating, done) — customer search picker, gender control, term inputs, optional overrides, read-only city preview from homeAddress
- [x] 4.2 Add the `contractForm` `ThreadItem` kind and render it in `CopilotDockContainer`
- [x] 4.3 Wire the generate control to the `generateCustomerContract` mutation; on success download via `saveFile`/`base64ToBytes`; show structured errors inline
- [x] 4.4 Wire the customer picker to the `searchCustomers` query (search-as-you-type, debounced)

## 5. Feed card for contract.generated

- [x] 5.1 Register the `contract.generated` event type in the feed's card catalog (icon, summary naming the customer)
- [x] 5.2 Compose the expanded narrative sentence client-side from the payload; standard Metadata / IA-insights links + ask-copilot chip; no PDF download offered

## 6. Tests, lint, typecheck, e2e

- [x] 6.1 Ensure unit suites (mapper, generation fn incl. validation-failure, copilot tool) are green
- [x] 6.2 Run repo `lint` + `typecheck`; fix to green
- [~] 6.3 E2E SKIPPED — no Playwright/e2e harness in the dashboard today (confirmed at frame). Manual app-run verification recommended before enabling for real founders.
- [x] 6.4 tasks.md checked off; specs synced to main; change archived
