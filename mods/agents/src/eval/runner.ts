/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Agent, Message, ConversationTurn, EvaluationScenario } from "../llm/types.js";
import { createInvokeLLM, type InvokeLLMOptions } from "../llm/createInvokeLLM.js";
import { allTools } from "../tools/index.js";
import {
  createCheckLlmJudge,
  runChecks,
  type CheckLlmJudge,
  type CheckResult,
  type CheckRunStats
} from "./checks.js";
import type { DecisionProvider } from "../decisions/index.js";
import { createMockToolExecutor } from "./mockToolExecutor.js";
import { logger } from "../logger.js";

/**
 * Result of evaluating a single turn.
 */
export interface TurnResult {
  turnNumber: number;
  turn: ConversationTurn;
  actualAI: string;
  tools: {
    expected: string[];
    actual: string[];
    verification: {
      allExpectedCalled: boolean;
      allArgsMatched: boolean;
      details: Array<{
        tool: string;
        called: boolean;
        argsMatched: boolean;
        reason?: string;
      }>;
      unexpected: string[];
    };
  };
  /** The turn's rubric checks, which decide the reply part of `passed`. */
  checks: CheckResult[];
  passed: boolean;
}

export interface EvalRunOptions {
  /** Answers the rubric checks (`evals.classifier` in mikro.json). */
  decisions: DecisionProvider;
  /** The agent's models for this run (an eval candidate); default `cx.model` / `cx.visionModel`. */
  models?: InvokeLLMOptions["models"];
  checkLlm?: CheckLlmJudge;
  /** Accumulates decision/LLM call counts across a run. */
  stats?: CheckRunStats;
}

/**
 * Result of evaluating a scenario.
 */
export interface ScenarioResult {
  scenario: EvaluationScenario;
  turns: TurnResult[];
  passed: boolean;
  summary: {
    totalTurns: number;
    passedTurns: number;
    failedTurns: number;
  };
}

/**
 * Result of evaluating all scenarios for an agent.
 */
export interface EvalResults {
  agentName: string;
  scenarios: ScenarioResult[];
  summary: {
    totalScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
    totalTurns: number;
    passedTurns: number;
    failedTurns: number;
  };
}

/**
 * Every turn is judged by its rubric checks: a turn without any can't pass or
 * fail on its reply, so the scenario is refused before anything runs.
 */
export function assertJudged(scenario: EvaluationScenario): void {
  const unjudged = scenario.turns
    .map((turn, i) => (turn.checks?.length ? null : i + 1))
    .filter((n): n is number => n !== null);
  if (unjudged.length > 0) {
    throw new Error(
      `Scenario "${scenario.id}": turn ${unjudged.join(", ")} has no checks; every turn needs at least one.`
    );
  }
}

/**
 * Run a single conversation turn.
 */
async function runTurn(
  agent: Agent,
  turn: ConversationTurn,
  turnNumber: number,
  conversationHistory: Message[],
  context?: Record<string, unknown>,
  options: EvalRunOptions
): Promise<TurnResult> {
  logger.verbose("running turn", { turnNumber, agent: agent.name });

  // Create mock executor for this turn
  const expectedTools = turn.tools || [];
  const {
    executor: mockExecutor,
    verify: verifyTools,
    getCalls
  } = createMockToolExecutor(expectedTools);

  // Create LLM invoker with mock executor
  // Model selection (text vs vision) happens automatically based on imageUrl
  const invokeLLM = createInvokeLLM(agent, allTools, mockExecutor, { models: options.models });

  // Get user message and image (both optional)
  const userMessage = turn.human || "";
  const imageUrl = turn.image || null;

  // First turn = new session (full greeting); later turns = active session
  const isNewSession = conversationHistory.length === 0;

  const { text: actualAI, toolsExecuted } = await invokeLLM(
    conversationHistory,
    userMessage,
    imageUrl,
    context,
    isNewSession
  );

  const checks = await runChecks(
    turn.checks,
    {
      history: conversationHistory.map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: typeof m.content === "string" ? m.content : ""
      })),
      human: userMessage || (imageUrl ? "[Imagen]" : ""),
      reply: actualAI,
      tools: toolsExecuted
    },
    { decisions: options.decisions, llm: options.checkLlm ?? createCheckLlmJudge() },
    options.stats
  );

  // Verify tools
  const toolVerification = await verifyTools();
  const actualToolNames = getCalls().map((c) => c.name);
  const expectedToolNames = expectedTools.map((t) => t.name);

  // Determine if turn passed (no unexpected tool calls; all expected called with matching args)
  const noUnexpectedCalls = toolVerification.unexpected.length === 0;
  const toolsPassed =
    noUnexpectedCalls && toolVerification.allExpectedCalled && toolVerification.allArgsMatched;
  const passed = toolsPassed && checks.every((c) => c.passed);

  // Update conversation history (include tools_executed so LLM sees what was actually done)
  // Use text placeholder for image-only turns to avoid: (1) empty user messages
  // (Anthropic rejects them), (2) replaying large images to text models on later
  // turns, and (3) unnecessary token usage.
  const savedUserContent = userMessage || (imageUrl ? "[Image]" : userMessage);
  conversationHistory.push({ role: "user", content: savedUserContent });
  conversationHistory.push({
    role: "assistant",
    content: actualAI,
    tools_executed: toolsExecuted.length > 0 ? toolsExecuted : undefined
  });

  return {
    turnNumber,
    turn,
    actualAI,
    tools: {
      expected: expectedToolNames,
      actual: actualToolNames,
      verification: {
        allExpectedCalled: toolVerification.allExpectedCalled,
        allArgsMatched: toolVerification.allArgsMatched,
        details: toolVerification.details.map((d) => ({
          tool: d.tool.name,
          called: d.called,
          argsMatched: d.argsMatched,
          reason: d.reason
        })),
        unexpected: toolVerification.unexpected.map((u) => u.name)
      }
    },
    checks,
    passed
  };
}

export type RunScenarioCallbacks = {
  onScenarioStart?: () => void;
  onTurnResult?: (turnResult: TurnResult) => void;
};

/**
 * Run a single evaluation scenario.
 * Optionally invokes onScenarioStart at start and onTurnResult after each turn (for streaming output).
 */
export async function runScenario(
  agent: Agent,
  scenario: EvaluationScenario,
  context?: Record<string, unknown>,
  callbacks: RunScenarioCallbacks | undefined,
  options: EvalRunOptions
): Promise<ScenarioResult> {
  logger.verbose("running scenario", { scenario: scenario.id, agent: agent.name });
  assertJudged(scenario);

  callbacks?.onScenarioStart?.();

  const conversationHistory: Message[] = [];
  const turnResults: TurnResult[] = [];

  // Run each turn sequentially
  for (let i = 0; i < scenario.turns.length; i++) {
    const turn = scenario.turns[i];
    const turnNumber = i + 1;

    const result = await runTurn(agent, turn, turnNumber, conversationHistory, context, options);
    turnResults.push(result);
    callbacks?.onTurnResult?.(result);
  }

  // Calculate summary
  const passedTurns = turnResults.filter((r) => r.passed).length;
  const failedTurns = turnResults.length - passedTurns;
  const passed = failedTurns === 0;

  return {
    scenario,
    turns: turnResults,
    passed,
    summary: {
      totalTurns: turnResults.length,
      passedTurns,
      failedTurns
    }
  };
}

export type RunAgentEvalCallbacks = {
  onScenarioStart?: (scenarioIndex: number, scenario: EvaluationScenario) => void;
  onTurnResult?: (scenario: EvaluationScenario, turnResult: TurnResult) => void;
  onScenarioResult?: (result: ScenarioResult) => void;
};

/**
 * Run all evaluation scenarios for an agent.
 * Optionally invokes callbacks for streaming output.
 */
export async function runAgentEval(
  agent: Agent,
  callbacks: RunAgentEvalCallbacks | undefined,
  options: EvalRunOptions
): Promise<EvalResults> {
  if (!agent.evaluations) {
    throw new Error(`Agent ${agent.name} has no evaluations configured`);
  }

  logger.verbose("running agent evaluation", { agent: agent.name });

  const context = agent.evaluations.context;
  const scenarioResults: ScenarioResult[] = [];
  const scenarios = agent.evaluations.scenarios;

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    const scenarioIndex = i + 1;
    const result = await runScenario(
      agent,
      scenario,
      context,
      {
        onScenarioStart: () => callbacks?.onScenarioStart?.(scenarioIndex, scenario),
        onTurnResult: callbacks?.onTurnResult
          ? (tr) => callbacks.onTurnResult!(scenario, tr)
          : undefined
      },
      options
    );
    scenarioResults.push(result);
    callbacks?.onScenarioResult?.(result);
  }

  // Calculate overall summary
  const totalScenarios = scenarioResults.length;
  const passedScenarios = scenarioResults.filter((r) => r.passed).length;
  const failedScenarios = totalScenarios - passedScenarios;

  let totalTurns = 0;
  let passedTurns = 0;
  let failedTurns = 0;

  for (const scenarioResult of scenarioResults) {
    totalTurns += scenarioResult.summary.totalTurns;
    passedTurns += scenarioResult.summary.passedTurns;
    failedTurns += scenarioResult.summary.failedTurns;
  }

  return {
    agentName: agent.name,
    scenarios: scenarioResults,
    summary: {
      totalScenarios,
      passedScenarios,
      failedScenarios,
      totalTurns,
      passedTurns,
      failedTurns
    }
  };
}
