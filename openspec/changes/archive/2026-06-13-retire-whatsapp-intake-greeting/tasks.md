## 1. Router: stop routing unknown numbers to intake

- [x] 1.1 `router/types.ts`: remove the `guest_intake` variant from `RouteResult` and `isIntakeEnabled` from `RouterDependencies`.
- [x] 1.2 `router/createMessageRouter.ts`: drop `isIntakeEnabled`; unknown phone returns `ignored` (no automated response). Update the doc comment.

## 2. Handler: remove the greeting branch + throttle

- [x] 2.1 `whatsapp/handleWhatsAppMessage.ts`: remove the `guest_intake` branch, the throttle map (`intakeFlowSentAt`, `INTAKE_FLOW_RESEND_MS`, `shouldSendIntakeFlow`, `resetIntakeFlowThrottleForTesting`), and the `buildIntakeFlowMessage` / `getWhatsAppIntakeFlow` imports.
- [x] 2.2 Keep the `nfm_reply` → `processIntakeFlowSubmission` dispatch and the submission helper untouched.

## 3. Submission module rename

- [x] 3.1 Rename `whatsapp/intakeFlow.ts` → `whatsapp/loanApplicationFlowSubmission.ts`; drop `buildIntakeFlowMessage`, `INTAKE_FLOW_SCREEN`, and the greeting constants. Keep `INTAKE_RECEIVED_MESSAGE`, `mapFlowAnswersToPayload`, `normalizeFlowDate`, `DATE_KEYS`.
- [x] 3.2 Update the import in `handleWhatsAppMessage.ts`.

## 4. Config removal

- [x] 4.1 `common/config.ts`: remove `whatsappIntakeFlowSchema` and the `intakeFlow` field from `whatsappSchema` (+ default factory).
- [x] 4.2 `agents/config.ts`: remove `getWhatsAppIntakeFlow`; `agents/index.ts`: remove its export.
- [x] 4.3 `apiserver/index.ts`: remove the `getWhatsAppIntakeFlow` import and the `isIntakeEnabled` arg to `createMessageRouter`.
- [x] 4.4 Remove the `whatsapp.intakeFlow` block from `mikro.json.example` and `mikro.json`.

## 5. Tests

- [x] 5.1 Remove greeting tests ("sends the Flow form…", "does not re-send…") and the `resetIntakeFlowThrottleForTesting` setup from `handleWhatsAppMessage.test.ts`; keep the "submits a completed Flow" test.
- [x] 5.2 Rename `intakeFlow.test.ts` → `loanApplicationFlowSubmission.test.ts`; drop `buildIntakeFlowMessage` tests, keep `mapFlowAnswersToPayload` coverage.

## 6. Verify

- [x] 6.1 `@mikro/common` + `@mikro/agents` build; `@mikro/apiserver` typechecks.
- [x] 6.2 Agents tests pass for the WhatsApp + router suites; no `guest_intake`/greeting references remain.
- [x] 6.3 Sweep: no remaining `guest_intake`, `intakeFlow` (config), `buildIntakeFlowMessage`, or `isIntakeEnabled` references.
