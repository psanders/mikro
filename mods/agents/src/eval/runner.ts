/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Agent, Message, ConversationTurn, EvaluationScenario } from "../llm/types.js";
import { createInvokeLLM } from "../llm/createInvokeLLM.js";
import { allTools } from "../tools/index.js";
import { similarityTest } from "./similarityJudge.js";
import { createMockToolExecutor } from "./mockToolExecutor.js";
import { logger } from "../logger.js";
import { getTextModel, getVisionModel } from "../config.js";

/**
 * Result of evaluating a single turn.
 */
export interface TurnResult {
  turnNumber: number;
  turn: ConversationTurn;
  actualAI: string;
  similarity: {
    similar: boolean;
    confidence: number;
    reason: string;
  };
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
  passed: boolean;
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
 * Run a single conversation turn.
 */
async function runTurn(
  agent: Agent,
  turn: ConversationTurn,
  turnNumber: number,
  conversationHistory: Message[],
  context?: Record<string, unknown>
): Promise<TurnResult> {
  logger.verbose("running turn", { turnNumber, agent: agent.name });

  // Determine model based on whether turn has image
  const model = turn.image ? getVisionModel() : getTextModel();

  // Create agent with selected model
  const evalAgent: Agent = {
    ...agent,
    model
  };

  // Create mock executor for this turn
  const expectedTools = turn.tools || [];
  const {
    executor: mockExecutor,
    verify: verifyTools,
    getCalls
  } = createMockToolExecutor(expectedTools);

  // Create LLM invoker with mock executor using eval agent
  const invokeLLM = createInvokeLLM(evalAgent, allTools, mockExecutor);

  // Get user message and image (both optional)
  const userMessage = turn.human || "";
  const imageUrl = turn.image || null;

  // Invoke LLM
  const actualAI = await invokeLLM(conversationHistory, userMessage, imageUrl, context);

  // Test similarity
  const similarity = await similarityTest(turn.expectedAI, actualAI);

  // Verify tools
  const toolVerification = await verifyTools();
  const actualToolNames = getCalls().map((c) => c.name);
  const expectedToolNames = expectedTools.map((t) => t.name);

  // Determine if turn passed
  const toolsPassed = toolVerification.allExpectedCalled && toolVerification.allArgsMatched;
  const responsePassed = similarity.similar;
  const passed = toolsPassed && responsePassed;

  // Update conversation history
  conversationHistory.push({ role: "user", content: userMessage });
  conversationHistory.push({ role: "assistant", content: actualAI });

  return {
    turnNumber,
    turn,
    actualAI,
    similarity,
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
    passed
  };
}

/**
 * Run a single evaluation scenario.
 */
export async function runScenario(
  agent: Agent,
  scenario: EvaluationScenario,
  context?: Record<string, unknown>
): Promise<ScenarioResult> {
  logger.verbose("running scenario", { scenario: scenario.id, agent: agent.name });

  const conversationHistory: Message[] = [];
  const turnResults: TurnResult[] = [];

  // Run each turn sequentially
  for (let i = 0; i < scenario.turns.length; i++) {
    const turn = scenario.turns[i];
    const turnNumber = i + 1;

    const result = await runTurn(agent, turn, turnNumber, conversationHistory, context);
    turnResults.push(result);
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

/**
 * Run all evaluation scenarios for an agent.
 */
export async function runAgentEval(agent: Agent): Promise<EvalResults> {
  if (!agent.evaluations) {
    throw new Error(`Agent ${agent.name} has no evaluations configured`);
  }

  logger.verbose("running agent evaluation", { agent: agent.name });

  const context = agent.evaluations.context;
  const scenarioResults: ScenarioResult[] = [];

  // Run each scenario
  for (const scenario of agent.evaluations.scenarios) {
    const result = await runScenario(agent, scenario, context);
    scenarioResults.push(result);
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
