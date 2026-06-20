/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import Table from "cli-table3";
import ansis from "ansis";
import type { EvalResults, ScenarioResult, TurnResult } from "./runner.js";

const CONVERSATION_WIDTH = 100;

/**
 * Wrap text to a maximum line length, breaking at word boundaries.
 * Returns an array of lines (no trailing newlines).
 */
function wrap(text: string, width: number): string[] {
  if (width <= 0 || !text.trim()) return text.trim() ? [text] : [];
  const lines: string[] = [];
  const paragraphs = text.split(/\n/);
  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/);
    let current: string[] = [];
    let currentLen = 0;
    for (const word of words) {
      const need = current.length === 0 ? word.length : 1 + word.length;
      if (currentLen + need <= width && current.length > 0) {
        current.push(word);
        currentLen += need;
      } else if (current.length === 0 && word.length <= width) {
        current = [word];
        currentLen = word.length;
      } else if (current.length === 0 && word.length > width) {
        for (let i = 0; i < word.length; i += width) {
          lines.push(word.slice(i, i + width));
        }
        current = [];
        currentLen = 0;
      } else {
        lines.push(current.join(" "));
        current = [word];
        currentLen = word.length;
      }
    }
    if (current.length > 0) lines.push(current.join(" "));
  }
  return lines.length ? lines : text.trim() ? [text] : [];
}

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
 * Print scenario header at start of scenario (conversation-style).
 */
export function printScenarioStart(
  agentName: string,
  scenarioIndex: number,
  scenario: { description: string }
): void {
  process.stdout.write(`\n✅ Scenario ${scenarioIndex}: ${scenario.description}\n\n`);
  process.stdout.write(`Conversation\n\n`);
}

/**
 * Print a single turn (streaming): Human, AI (agent label), Tools lines. Call after each turn.
 * Wraps Human and AI text to CONVERSATION_WIDTH.
 */
export function printTurnResult(
  agentName: string,
  scenario: { description: string },
  turnResult: TurnResult
): void {
  const human = formatHumanInput(turnResult);
  const aiName = agentName.charAt(0).toUpperCase() + agentName.slice(1);
  const mark = turnResult.passed ? ansis.green("✔") : ansis.red("✘");

  const humanPrefix = "Human: ";
  const humanLines = wrap(human, CONVERSATION_WIDTH - humanPrefix.length);
  process.stdout.write(`${humanPrefix}${humanLines[0] ?? ""}\n`);
  for (let i = 1; i < humanLines.length; i++) {
    process.stdout.write(`${humanLines[i]}\n`);
  }

  const aiPrefix = `AI (${aiName}): `;
  const aiContentWidth = CONVERSATION_WIDTH - aiPrefix.length - 2; // -2 for " ✔"
  const aiLines = wrap(turnResult.actualAI, aiContentWidth);
  if (aiLines.length <= 1) {
    process.stdout.write(`${aiPrefix}${aiLines[0] ?? ""} ${mark}\n`);
  } else {
    process.stdout.write(`${aiPrefix}${aiLines[0]}\n`);
    for (let i = 1; i < aiLines.length - 1; i++) {
      process.stdout.write(`${aiLines[i]}\n`);
    }
    process.stdout.write(`${aiLines[aiLines.length - 1]} ${mark}\n`);
  }

  if (turnResult.tools.actual.length > 0) {
    const toolsLine = turnResult.tools.actual.map((t) => `${t}()`).join(", ");
    process.stdout.write(`Tools: ${toolsLine} ${mark}\n`);
  }

  if (!turnResult.passed) {
    const reason = turnFailureReason(turnResult);
    const reasonLines = wrap(`✘ ${reason}`, CONVERSATION_WIDTH);
    for (const line of reasonLines) {
      process.stdout.write(ansis.red(line + "\n"));
    }
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
