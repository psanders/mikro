# Proposal: add-copilot-clear-history

## Why

The founder-copilot dock persists conversation history per founder indefinitely (`founder-copilot` spec, "Chat with immediate read answers and provenance"). There is no way to reset the view: exploratory or stale threads pile up in the dock with no fresh-start affordance. The requested fix is a small control that clears the visible thread while soft-deleting the underlying rows internally, so nothing is destroyed outright and the data remains inspectable if ever needed.

## What Changes

- **Clear-history control in the dock header** — a small icon button (next to the close control) that clears the visible conversation for the current founder.
- **Soft delete, not hard delete** — clearing sets a `deletedAt` timestamp on the founder's `copilot`-channel `Message` rows rather than removing them. This is a new pattern for this codebase (the existing idiom elsewhere is a `status` enum, e.g. `CopilotPendingAction`); `deletedAt` is used here because it's a bulk, all-at-once clear rather than a per-row lifecycle.
- **History reads exclude cleared rows** — `getCopilotHistory` and the chat loop's history read (`createCopilotChat`) filter out `deletedAt IS NOT NULL` rows. A cleared dock reopens empty and shows the capability chips again, same as a brand-new founder.
- **Pending actions are handled explicitly, not silently orphaned** — an unresolved (`PENDING`, unexpired) `CopilotPendingAction` is a live write waiting on the founder's confirm/reject click. Clearing history must not hide a pending write from view. Design decision needed: block the clear while a pending action exists (with a message telling the founder to resolve it first), or reject all pending actions as part of the clear. Leaning toward **block** — silently auto-rejecting a write the founder may still want feels more surprising than asking them to resolve it first.
- **Out of scope**: clearing/disabling watch rules (`WatchRule` has its own enable/disable lifecycle, unrelated to chat history), a restore/undo UI (the `deletedAt` column exists for data-recovery-by-support, not a user-facing undo), per-message deletion (this clears the whole thread at once).

## Capabilities

### Modified Capabilities

- `founder-copilot`: dock UI gains a clear-history control; new admin-only `clearCopilotHistory` procedure; history reads filter soft-deleted messages.

## Impact

- **apiserver**: Prisma migration adding nullable `Message.deletedAt`; new `src/api/copilot/createClearCopilotHistory.ts` validated function (guards: caller owns the rows, blocks when a pending unresolved action exists); new `clearCopilotHistory` adminProcedure in `protected.ts`; `createGetCopilotHistory.ts` and `createCopilotChat.ts` history queries add a `deletedAt: null` filter.
- **dashboard**: `CopilotDock` header gains a small clear-history button; `CopilotDockContainer` wires the mutation, an inline confirm step, and resets local thread state on success; new Storybook states for the button/confirm.
- No change to `business-event-log` (that log is a separate, intentionally append-only `BusinessEvent` table — untouched by this change) or to `copilot-watch-rules`.
