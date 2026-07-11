## Context

`loan-statement` was added as a task-automation-catalog entry (`gateFloor: "confirm"`) during the reporting unification (issue #110). Task automations exist to be _scheduled_ — `createTask` is the only copilot-facing surface that references the catalog, and it requires `frequency`/`timeOfDay`. A statement for one specific loan, requested in the moment, doesn't fit that shape: nobody wants "email me préstamo #10036's statement every Friday." Because no tool in the copilot's chat-turn tool set (`READ_TOOLS`/`WRITE_TOOLS`/`DIRECT_TOOLS` in `toolPolicy.ts`) maps to "generate the statement now," the LLM falls back to whichever bound tool's description best matches — `getLoanHealth`, whose description explicitly says to use it for balance/mora/pending-payment questions — and answers in prose. The document itself is never produced.

The underlying report logic is already correct and reused in three places today: `createGenerateLoanStatement` (`mods/apiserver/src/api/reports/createGenerateLoanStatement.ts`) is called by the `generateLoanStatement` tRPC mutation, the `ctl reports loan-statement` CLI command, and (until this change) the `loan-statement` automation's `execute`. This design keeps that shared function as the single source of truth and only changes _how the copilot reaches it_.

## Goals / Non-Goals

**Goals:**

- The founder can ask the copilot for a loan statement in natural language and get the PDF/JSON back in the same turn — no scheduling step, no confirm click (the operation is read-only).
- CLI, tRPC mutation, and copilot all keep producing equivalent output for the same loan/format, per the existing `loan-statement-report` spec's parity requirement.
- The model reliably picks the statement tool over `getLoanHealth`/`getLoanByLoanId` when the founder wants the document, not a summary.

**Non-Goals:**

- No change to `createGenerateLoanStatement`, the PDF layout, or the tRPC/CLI surfaces — they're already correct and out of scope.
- No new "scheduled statement" feature — explicitly not something a founder does; if that need ever surfaces it's a separate proposal.
- No change to how genuinely mutating automations (`pay-collector`, `record-expense`, `daily-close`) are gated or scheduled.

## Decisions

**Direct tool, not a read tool or a write tool.** The copilot tool policy has three chat-turn categories: read tools (answer immediately, no side effect, text/data result), write tools (model's call is intercepted, persisted as a `CopilotPendingAction`, executed only after the founder clicks confirm), and direct tools (`openCustomerForm`, `openLoanForm`, `createTask`, `listTasks`, `cancelTask` — execute inline, no confirm gate, because they're either reversible/configuration or, like the form-card tools, don't mutate anything themselves). Statement generation never mutates the ledger — it's a pure read that happens to produce a _document_ rather than a data answer — so it belongs with the direct tools: no confirm card makes sense for an operation with nothing to confirm, and a plain read-tool text answer can't carry a downloadable file. New tool: `generateLoanStatement`, executed inline, taking `loanId` and `format` (default `pdf`), calling `createGenerateLoanStatement` directly — the same function signature the tRPC mutation and CLI already use.

**Delivery: extend the chat-reply/thread-item pattern with a new kind — confirmed no existing one fits.** Survey of the dock (`mods/dashboard/src/founder/copilot/types.ts:97-103`, `CopilotDockContainer.tsx`) found the `CopilotMessage` union only has `user | assistant | pendingAction | rule | customerForm | loanForm` — no "here's a file, download it" kind exists yet, and the two precedents that look similar both bypass the chat channel entirely: the loan-form-card's contract download fires a separate `generateCustomerContract` tRPC call from the card's own submit handler (never touches `CopilotChatReply`), and the task-firing attachment (`ExecuteFiringResult.attachment`, `mods/apiserver/src/tasks/types.ts:68`) is consumed only by `TaskFeedCard.tsx` in the founder feed, not the copilot dock. So this change adds:

- a `document` (or `loanStatement`) field to `copilotChatReplySchema` (`mods/common/src/schemas/copilot.ts:124-142`, alongside the existing `customerForm`/`loanForm` fields) carrying `{ filename, mimeType, base64 }` — the same triple both existing attachment precedents already use;
- a new `document` variant on the `CopilotMessage` union (`types.ts:97-103`) and a case in the dock's render switch (`CopilotDockContainer.tsx:448-510`);
- a "Descargar" action reusing `saveFile`/`base64ToBytes` from `mods/dashboard/src/lib/saveFile.ts` — already imported into `CopilotDockContainer.tsx:27` for the contract-download toast, so no new frontend dependency.
  This is new surface, not a reuse of an existing "attachment" delivery path, but it follows the exact shape (`filename`/`mimeType`/`base64`) both existing precedents settled on independently, so it stays consistent with the rest of the codebase rather than inventing a third convention.

**Tool-note disambiguation over prompt rewrite.** Rather than rewriting the CONSULTAR verb guidance, add a targeted tool-disambiguation note (same mechanism used for the customer-vs-solicitud UUID ambiguity, `founder-copilot` spec's "Environment and tool-capability awareness" requirement): "use `generateLoanStatement` when the founder asks for the estado de cuenta / statement / PDF itself; use `getLoanHealth` when they're asking why a balance/mora looks a certain way." This is the smallest change that fixes the observed misrouting without risking regressions on the (correctly-handled) status-question path.

**Deletion, not deprecation, of the automation.** No evidence of any live scheduled task bound to `loan-statement` (statements aren't recurring by nature), and the task system's existing schema-drift handling (`task-automation-catalog` spec: unknown/mismatched `automationId` moves a firing to `NEEDS_INPUT` rather than crashing) covers the edge case safely if one somehow exists. Full removal avoids maintaining a second, now-pointless code path.

## Risks / Trade-offs

- **[Risk]** A founder had already scheduled a recurring loan-statement task before this ships. → **Mitigation**: task-automation-catalog's existing schema-drift behavior moves it to `NEEDS_INPUT` with an explanation instead of crashing; verify this path in testing since it's the one existing safety net being relied on here.
- **[Risk]** The model still picks `getLoanHealth` for an ambiguous ask ("cómo va el préstamo 10036") that could go either way. → **Mitigation**: not a regression — that phrasing is legitimately a status question, not a document request; the tool-note only needs to disambiguate the cases the proposal calls out (explicit "estado de cuenta"/"dame el PDF"/"descárgame" phrasing).
- **[Trade-off]** Base64-in-chat-response means large PDFs inflate the `copilotChat` response payload the same way the automation path already did — accepted, since it's the same trade-off the shipped automation and tRPC mutation already make today.

## Migration Plan

1. Add `generateLoanStatement` direct tool + dock rendering + tool notes (additive, no removal yet).
2. Verify end-to-end in the dock (ask → statement downloads) before touching the automation.
3. Remove `loan-statement` from `mods/apiserver/src/tasks/catalog.ts`'s registered array and delete `loanStatement.ts`.
4. Confirm no test/fixture still references the automation id; update `founder-feed`/task-creation UI if it hardcodes the automation list anywhere beyond the catalog.

Rollback: revert the catalog removal commit independently of the copilot-tool commit if needed — the two are separable, direct-tool addition doesn't depend on automation removal landing.

## Open Questions

- None — confirmed during design research that the dock has no existing "download this file" thread-item kind (see Decisions: Delivery), so Build adds one deliberately rather than discovering the gap mid-implementation.
