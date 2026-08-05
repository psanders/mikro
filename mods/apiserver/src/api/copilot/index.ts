/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Founder copilot module: chat loop and pending-action lifecycle. See design.md
 * Decisions 1–7. (Watch rules and their evaluator were retired — never used.)
 */
export {
  READ_TOOLS,
  WRITE_TOOLS,
  DIRECT_TOOLS,
  COPILOT_LOCAL_TOOLS,
  TOOL_NOTES,
  getCopilotToolDefinitions,
  getBoundToolNames,
  isReadTool,
  isWriteTool,
  isDirectTool,
  isLocalTool
} from "./toolPolicy.js";
export { computeDailyCashCollected } from "./metrics.js";
export {
  createCopilotChat,
  type CopilotChatDeps,
  type CopilotChatParams
} from "./createCopilotChat.js";
export {
  createConfirmCopilotAction,
  type ConfirmCopilotActionDeps,
  type ConfirmCopilotActionParams,
  type ConfirmCopilotActionResult
} from "./createConfirmCopilotAction.js";
export {
  createRejectCopilotAction,
  type RejectCopilotActionDeps,
  type RejectCopilotActionParams,
  type RejectCopilotActionResult
} from "./createRejectCopilotAction.js";
export {
  createGetCopilotHistory,
  type GetCopilotHistoryParams,
  type CopilotHistoryResult
} from "./createGetCopilotHistory.js";
export {
  createClearCopilotHistory,
  type ClearCopilotHistoryDeps,
  type ClearCopilotHistoryParams,
  type ClearCopilotHistoryResult
} from "./createClearCopilotHistory.js";
export { setCopilotDeps, getCopilotDeps, clearCopilotDeps, type CopilotDeps } from "./deps.js";
export { summarizeAction } from "./summarizeAction.js";
export { buildCopilotSystemPrompt } from "./systemPrompt.js";
