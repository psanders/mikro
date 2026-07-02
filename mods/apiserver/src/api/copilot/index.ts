/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Founder copilot module: chat loop, pending-action lifecycle, watch rules, and
 * their evaluator. See design.md Decisions 1–7.
 */
export {
  READ_TOOLS,
  WRITE_TOOLS,
  DIRECT_TOOLS,
  COPILOT_LOCAL_TOOLS,
  getCopilotToolDefinitions,
  getBoundToolNames,
  isReadTool,
  isWriteTool,
  isDirectTool,
  isLocalTool
} from "./toolPolicy.js";
export { computeWatchMetric, isBreached, type MetricComputationInput } from "./metrics.js";
export {
  createWatchRule,
  listWatchRules,
  setWatchRuleEnabled,
  disableWatchRule,
  type WatchRuleView
} from "./watchRules.js";
export { evaluateWatchRules, type EvaluateWatchRulesResult } from "./evaluateWatchRules.js";
export {
  createWatchRuleEvaluator,
  type WatchRuleEvaluatorOptions
} from "./createWatchRuleEvaluator.js";
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
export { setCopilotDeps, getCopilotDeps, clearCopilotDeps, type CopilotDeps } from "./deps.js";
export { summarizeAction } from "./summarizeAction.js";
export { COPILOT_SYSTEM_PROMPT } from "./systemPrompt.js";
