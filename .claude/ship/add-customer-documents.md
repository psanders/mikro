# Ship checkpoint — add-customer-documents

Started: 2026-07-10
Current stage: DONE — shipped, archived; ready to commit

**Scope:** New `CustomerDocument` model gives any customer a document list independent of a loan application, primarily for storage/audit (not retrieval UX — physical copies are the day-to-day reference). Conversion copies (by reference, no file move/dup) the application's already-stored contract/ID-image documents onto the resulting customer inside its existing transaction. `generateCustomerContract` (PR #196) persists its rendered PDF as a customer document instead of download-only. Reviewer mobile app's application-scoped document view is untouched (reviewers still need it occasionally). Read surface is a `ctl` command (`customers:documentsList`), not dashboard UI — the founder dashboard has no customer-detail page and documents are checked occasionally, not a founder-facing flow.

**Detected surfaces:** OpenSpec: yes · Pencil: yes (`pencil.pen`) · Storybook: yes (`mods/dashboard/.storybook`, `mods/mobile/.storybook`) · E2E: no (no Playwright/e2e dir)

| #   | Stage           | Status  | Notes                                                                                                                                                                                                                                                     |
| :-- | :-------------- | :------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Frame           | done    | Change resolved; artifacts read; scope stated                                                                                                                                                                                                             |
| 1   | Design (Pencil) | skipped | No new UI surface — read path moved to `ctl` (no customer-detail page exists in the founder dashboard to design against)                                                                                                                                  |
| 2   | Spec reconcile  | done    | Design-stage finding (no dashboard customer-detail page) changed the Impact/tasks (dashboard list → ctl command) but not observable behavior — delta specs unchanged from `/opsx:propose`. `openspec validate` green                                      |
| 3   | Build           | done    | All 7 task groups complete: Prisma model+migration, common schemas, conversion migration step (reordered ahead of disbursement for a real rollback test), listCustomerDocuments fn+procedure, contract persistence, ctl `customers:documentsList` command |
| 4   | Test            | done    | common 103, apiserver unit 428 (+4), apiserver integration 646 (+3); lint clean on all changed files; live smoke against real dev DB confirmed contract persistence end-to-end (CustomerDocument row + on-disk file, sha256 verified)                     |
| 5   | Sync            | done    | 3 specs updated: `customer-documents` (new), `loan-application-conversion` + `contract-generation` (modified). `openspec validate --specs`: 38/39 pass, `no-referrals` pre-existing unrelated failure                                                     |
| 6   | Archive         | done    | Moved to `openspec/changes/archive/2026-07-10-add-customer-documents`                                                                                                                                                                                     |

Status values: `pending` · `in-progress` · `done` · `skipped` (with reason).

## Decision log

Newest first. One line per meaningful decision or stage transition.

- 2026-07-10 — Sync + Archive complete. Cleaned up the smoke-test artifact first (deleted the CustomerDocument row + PDF file) per user's choice. Change archived to `openspec/changes/archive/2026-07-10-add-customer-documents`. Not yet committed — awaiting user go-ahead.
- 2026-07-10 — Build + Test complete, all green. Live smoke test run against the real dev DB (mikro.db) left one real `CustomerDocument` row + one `contracts/<sha256>.pdf` file for a seeded test customer — harmless, not cleaned up automatically, flagged to the user. → Stage 5 gate: confirm before syncing specs.
- 2026-07-10 — User: priority is storage/audit, not retrieval UI — physical copies are the day-to-day reference; keep the reviewer app's document view as-is (still needed occasionally). Reflected in proposal.md Why.
- 2026-07-10 — Design-stage finding: founder dashboard has no customer-detail page — every customer surface is conversational via the copilot (confirmed: `BusquedaScreen.tsx:173` selecting a customer just opens the copilot, doesn't navigate). Asked user: copilot documents card vs. real customer-detail page vs. neither. User chose neither — keep the list at `ctl` only, checked occasionally. Task 6 rewritten from dashboard UI to `mods/ctl/src/commands/customers/documentsList.ts` (ListCommand, follows `customers/get.ts` conventions). No Pencil work needed as a result → stage 1 marked skipped.
- 2026-07-10 — Checkpoint created; frame done (proposal/design/specs/tasks already written and `openspec validate` green from `/opsx:propose`). → Stage 1 Design.
