/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import Table from "cli-table3";
import ansis from "ansis";
import type { EvalResults, ScenarioResult, TurnResult } from "./runner.js";

/**
 * Format tool calls for display.
 */
function formatToolCalls(turnResult: TurnResult): string {
  if (turnResult.tools.actual.length === 0) {
    return "";
  }

  return turnResult.tools.actual.map((toolName) => `${toolName}()`).join("\n");
}

/**
 * Format human input for display.
 * Shows "[Image]" for image-only turns.
 */
function formatHumanInput(turnResult: TurnResult): string {
  if (turnResult.turn.image && !turnResult.turn.human) {
    return "[Image]";
  }
  if (turnResult.turn.image && turnResult.turn.human) {
    return `${turnResult.turn.human} [+Image]`;
  }
  return turnResult.turn.human || "";
}

/**
 * One-line reason for a single turn failure.
 */
function turnFailureReason(turnResult: TurnResult): string {
  if (turnResult.tools.verification.unexpected.length > 0) {
    return `unexpected tools: ${turnResult.tools.verification.unexpected.join(", ")}`;
  }
  if (turnResult.tools.expected.length > 0 && !turnResult.tools.verification.allExpectedCalled) {
    const missing = turnResult.tools.verification.details
      .filter((d) => !d.called)
      .map((d) => d.tool);
    return `missing tools: ${missing.join(", ")}`;
  }
  const pct = Math.round(turnResult.similarity.confidence * 100);
  return `AI response with ${pct}% similarity`;
}

/**
 * Print scenario header at start of scenario (conversation-style, matches test.md).
 */
export function printScenarioStart(
  agentName: string,
  scenarioIndex: number,
  scenario: { description: string }
): void {
  process.stdout.write(`\n✅ Escenario ${scenarioIndex}: ${scenario.description}\n\n`);
  process.stdout.write(`Objetivo: ${scenario.description}\n\n`);
  process.stdout.write(`💬 Conversación\n\n`);
}

/**
 * Print a single turn (streaming): Human, AI (AgentName), Tools lines. Call after each turn.
 */
export function printTurnResult(
  agentName: string,
  scenario: { description: string },
  turnResult: TurnResult
): void {
  const human = formatHumanInput(turnResult);
  const aiName = agentName.charAt(0).toUpperCase() + agentName.slice(1);
  const mark = turnResult.passed ? ansis.green("✔") : ansis.red("✘");

  process.stdout.write(`Human: ${human}\n`);
  process.stdout.write(`AI (${aiName}): ${turnResult.actualAI} ${mark}\n`);

  if (turnResult.tools.actual.length > 0) {
    for (const toolName of turnResult.tools.actual) {
      process.stdout.write(`Tools: ${toolName}() ${mark}\n`);
    }
  }

  if (!turnResult.passed) {
    process.stdout.write(ansis.red(`✘ ${turnFailureReason(turnResult)}\n`));
  }

  process.stdout.write("\n");
}

/**
 * Print scenario result and separator (conversation-style). Call after all turns in scenario.
 */
export function printScenarioResult(scenarioResult: ScenarioResult): void {
  const passed = scenarioResult.passed;
  const resultText = passed ? "PASSED" : "FAILED";
  process.stdout.write(`Result: ${passed ? ansis.green(resultText) : ansis.red(resultText)}\n\n`);
  process.stdout.write("---\n");
}

/**
 * Print final summary (scenarios and turns passed/total).
 */
export function printSummary(results: EvalResults): void {
  console.log(ansis.bold.blue("\n═══ Summary ═══"));
  console.log(`Agent: ${results.agentName}`);
  console.log(
    `Scenarios: ${results.summary.passedScenarios}/${results.summary.totalScenarios} passed`
  );
  console.log(`Turns: ${results.summary.passedTurns}/${results.summary.totalTurns} passed`);
  console.log("");
}

/**
 * Print evaluation results as a formatted table.
 */
export function printEval(results: EvalResults): void {
  results.scenarios.forEach((scenarioResult) => {
    console.log(ansis.bold.blue(`\nScenario: ${scenarioResult.scenario.id}`));
    console.log(ansis.dim(scenarioResult.scenario.description));
    console.log(
      ansis.bold(
        `Overall: ${scenarioResult.passed ? ansis.green("✔ PASSED") : ansis.red("✘ FAILED")}`
      )
    );

    const table = new Table({
      head: ["Turn", "Human Input", "Expected", "AI Response", "Tool Calls", "Pass"],
      colWidths: [
        6, // Turn
        24, // Human Input
        24, // Expected
        24, // AI Response
        14, // Tool Calls
        6 // Pass
      ],
      wordWrap: true
    });

    scenarioResult.turns.forEach((turnResult) => {
      table.push([
        turnResult.turnNumber,
        formatHumanInput(turnResult),
        turnResult.turn.expectedAI,
        turnResult.actualAI,
        formatToolCalls(turnResult),
        turnResult.passed ? ansis.green("✔") : ansis.red("✘")
      ]);

      // Print similarity info if failed
      if (!turnResult.passed) {
        console.log(
          ansis.yellow(
            `  Turn ${turnResult.turnNumber}: ${turnResult.similarity.confidence.toFixed(0)}% similar - ${turnResult.similarity.reason}`
          )
        );
      }

      // Print tool errors if any
      if (
        turnResult.tools.expected.length > 0 &&
        !turnResult.tools.verification.allExpectedCalled
      ) {
        console.log(
          ansis.red(
            `  Turn ${turnResult.turnNumber} - Missing tool calls: ${turnResult.tools.expected.join(", ")}`
          )
        );
      }
    });

    console.log(table.toString());
  });

  // Overall summary
  console.log(ansis.bold.blue("\n═══ Summary ═══"));
  console.log(`Agent: ${results.agentName}`);
  console.log(
    `Scenarios: ${results.summary.passedScenarios}/${results.summary.totalScenarios} passed`
  );
  console.log(`Turns: ${results.summary.passedTurns}/${results.summary.totalTurns} passed`);
  console.log("");
}

/**
 * Format evaluation results as a string table (for file output).
 */
export function toTable(results: EvalResults): string {
  const lines: string[] = [];

  results.scenarios.forEach((scenarioResult) => {
    lines.push(`\nScenario: ${scenarioResult.scenario.id}`);
    lines.push(scenarioResult.scenario.description);
    lines.push(`Overall: ${scenarioResult.passed ? "PASSED" : "FAILED"}`);

    const table = new Table({
      head: ["Turn", "Human Input", "Expected", "AI Response", "Tool Calls", "Pass"],
      colWidths: [6, 24, 24, 24, 14, 6],
      wordWrap: true
    });

    scenarioResult.turns.forEach((turnResult) => {
      table.push([
        turnResult.turnNumber,
        formatHumanInput(turnResult),
        turnResult.turn.expectedAI,
        turnResult.actualAI,
        formatToolCalls(turnResult),
        turnResult.passed ? "✔" : "✘"
      ]);
    });

    lines.push(table.toString());

    // Add similarity details for failed turns
    scenarioResult.turns
      .filter((t) => !t.passed)
      .forEach((turnResult) => {
        lines.push(
          `  Turn ${turnResult.turnNumber}: ${turnResult.similarity.confidence.toFixed(0)}% similar - ${turnResult.similarity.reason}`
        );
      });
  });

  // Overall summary
  lines.push("\n═══ Summary ═══");
  lines.push(`Agent: ${results.agentName}`);
  lines.push(
    `Scenarios: ${results.summary.passedScenarios}/${results.summary.totalScenarios} passed`
  );
  lines.push(`Turns: ${results.summary.passedTurns}/${results.summary.totalTurns} passed`);
  lines.push("");

  return lines.join("\n");
}

/**
 * Format evaluation results as JSON.
 */
export function toJSON(results: EvalResults): string {
  return JSON.stringify(results, null, 2);
}
