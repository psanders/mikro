# Tasks: add-copilot-clear-history

## 1. Data model

- [x] 1.1 Prisma migration: nullable `Message.deletedAt` (DateTime, `@map("deleted_at")`)

## 2. Backend (apiserver `src/api/copilot/`)

- [x] 2.1 `createClearCopilotHistory.ts`: validated function — resolves caller's copilot-channel messages, refuses (structured error) if a `PENDING` unexpired `CopilotPendingAction` exists for the caller, otherwise sets `deletedAt: now()` on all matching rows
- [x] 2.2 `createGetCopilotHistory.ts` + `createCopilotChat.ts` history reads: add `deletedAt: null` filter
- [x] 2.3 `clearCopilotHistory` adminProcedure in `protected.ts`

## 3. Dock UI (Storybook-first)

- [x] 3.1 `CopilotDock` header: small clear-history icon button (eraser) next to the close control
- [x] 3.2 Inline confirm step: header title row swaps for "¿Borrar conversación? Cancelar · Borrar"
- [x] 3.3 Stories: `WithClearHistoryButton` (default), `ClearHistoryConfirm` (confirm-pending), `ClearHistoryBlocked` (blocked-by-pending-action error state)

## 4. Wiring

- [x] 4.1 `CopilotDockContainer`: wire `clearCopilotHistory` mutation, confirm flow, reset local thread state + refetch on success, surface the blocked error inline (same pattern as existing `appendError`)

## 5. Tests and gates

- [x] 5.1 Integration: clear succeeds and sets `deletedAt` on all of the caller's copilot messages only (not other founders', not whatsapp-channel rows); clear refused with structured error + no mutation when a PENDING unexpired action exists; expired-pending-action case allows clearing
- [x] 5.2 Integration: `getCopilotHistory` excludes soft-deleted rows
- [x] 5.3 Repo gates: apiserver typecheck (0 new errors vs. 22 pre-existing baseline), dashboard typecheck/lint clean, apiserver unit (341) + integration (484, incl. 4 new + all-seven-procedures authorization) all green, dashboard Storybook build green
