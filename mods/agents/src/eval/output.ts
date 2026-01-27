/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import Table from "cli-table3";
import ansis from "ansis";
import type { EvalResults, TurnResult } from "./runner.js";

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
