/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolExecutor, ExpectedToolCall, ArgMatchMode } from "../llm/types.js";
import { compareArgs } from "./similarityJudge.js";
import { logger } from "../logger.js";

/**
 * Record of a tool call made during evaluation.
 */
export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  timestamp: number;
}

/**
 * Result of verifying tool calls against expectations.
 */
export interface ToolVerificationResult {
  /** Whether all expected tools were called */
  allExpectedCalled: boolean;
  /** Whether all argument verifications passed */
  allArgsMatched: boolean;
  /** Details for each expected tool */
  details: Array<{
    tool: ExpectedToolCall;
    called: boolean;
    argsMatched: boolean;
    reason?: string;
  }>;
  /** Unexpected tools that were called */
  unexpected: ToolCallRecord[];
}

/**
 * Deep equality check for objects.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;

  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);

  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (!(key in bObj)) return false;
    if (!deepEqual(aObj[key], bObj[key])) return false;
  }

  return true;
}

/**
 * Verify arguments match using specified mode.
 */
async function verifyArgs(
  expected: Record<string, unknown> | undefined,
  actual: Record<string, unknown>,
  matchMode: ArgMatchMode
): Promise<{ matched: boolean; reason: string }> {
  if (!expected) {
    // No expected args means any args are acceptable
    return { matched: true, reason: "No expected arguments specified" };
  }

  if (matchMode === "strict") {
    // Check that all expected keys are present and match
    for (const [key, expectedValue] of Object.entries(expected)) {
      if (!(key in actual)) {
        return {
          matched: false,
          reason: `Missing expected argument: ${key}`
        };
      }
      if (!deepEqual(expectedValue, actual[key])) {
        return {
          matched: false,
          reason: `Argument ${key} mismatch: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actual[key])}`
        };
      }
    }
    return { matched: true, reason: "All arguments matched strictly" };
  } else {
    // Use LLM judge for semantic comparison
    return await compareArgs(expected, actual).then((result) => ({
      matched: result.match,
      reason: result.reason
    }));
  }
}

/**
 * Create a mock tool executor for evaluation.
 *
 * @param expectedTools - Tools that are expected to be called
 * @returns Executor function and verification utilities
 */
export function createMockToolExecutor(expectedTools: ExpectedToolCall[] = []) {
  const calls: ToolCallRecord[] = [];
  const warnings: string[] = [];

  const executor: ToolExecutor = async (toolName, args) => {
    const timestamp = Date.now();
    calls.push({ name: toolName, args, timestamp });

    // Find matching expected tool
    const expectedTool = expectedTools.find((tool) => tool.name === toolName);

    if (!expectedTool) {
      // Unexpected tool call - log warning and return generic success
      const warning = `Unexpected tool call: ${toolName} with args ${JSON.stringify(args)}`;
      warnings.push(warning);
      logger.warn(warning);
      return {
        success: true,
        message: "Mock response (unexpected tool)"
      };
    }

    // Verify arguments
    const matchMode = expectedTool.matchMode || "strict";
    const verification = await verifyArgs(expectedTool.expectedArgs, args, matchMode);

    if (!verification.matched) {
      logger.warn(`Tool ${toolName} called with mismatched args: ${verification.reason}`);
    }

    // Return the mock response
    return expectedTool.mockResponse;
  };

  /**
   * Get all tool calls made during execution.
   */
  function getCalls(): ToolCallRecord[] {
    return [...calls];
  }

  /**
   * Verify that expected tools were called and arguments matched.
   */
  async function verify(): Promise<ToolVerificationResult> {
    const details: ToolVerificationResult["details"] = [];
    const unexpected: ToolCallRecord[] = [];

    // Check each expected tool
    for (const expectedTool of expectedTools) {
      const call = calls.find((c) => c.name === expectedTool.name);
      const called = !!call;

      let argsMatched = true;
      let reason: string | undefined;

      if (called && call) {
        const matchMode = expectedTool.matchMode || "strict";
        const verification = await verifyArgs(expectedTool.expectedArgs, call.args, matchMode);
        argsMatched = verification.matched;
        reason = verification.reason;
      } else {
        argsMatched = false;
        reason = "Tool was not called";
      }

      details.push({
        tool: expectedTool,
        called,
        argsMatched,
        reason
      });
    }

    // Find unexpected calls (tools called but not in expected list)
    for (const call of calls) {
      const isExpected = expectedTools.some((tool) => tool.name === call.name);
      if (!isExpected) {
        unexpected.push(call);
      }
    }

    const allExpectedCalled = details.every((d) => d.called);
    const allArgsMatched = details.every((d) => d.argsMatched);

    return {
      allExpectedCalled,
      allArgsMatched,
      details,
      unexpected
    };
  }

  /**
   * Get warnings generated during execution.
   */
  function getWarnings(): string[] {
    return [...warnings];
  }

  return {
    executor,
    getCalls,
    verify,
    getWarnings
  };
}
