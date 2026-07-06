/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
export type {
  Automation,
  AutomationDeps,
  AutomationResult,
  ResolveContext,
  SlotSpec
} from "./types.js";
export {
  getAutomation,
  listAutomationIds,
  listAutomationDescriptors,
  gateRespectsFloor
} from "./catalog.js";
export { validateSlots, slotNames } from "./validatePayload.js";
export { computeNextFireAt, localDateString, localDayRange } from "./dates.js";
export type { ScheduleFields } from "./dates.js";
export { OPEN_FIRING_STATUSES, gatherPayload, executeFiring, skipFiring } from "./firings.js";
export { processDueTasks } from "./processDueTasks.js";
export { createTaskWorker } from "./createTaskWorker.js";
