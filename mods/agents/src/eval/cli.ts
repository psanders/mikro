/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import fs from "fs";
import path from "path";
import { loadAgents } from "../../../apiserver/src/agents/loadAgents.js";
import { runAgentEval, runScenario, type EvalResults, type ScenarioResult } from "./runner.js";
import { toJSON, printEval } from "./output.js";

/**
 * Print usage information.
 */
function printUsage() {
  console.log(`
Usage: npm run agents:eval [agent] [scenario]

Arguments:
  agent     - Optional. Name of the agent to evaluate (e.g., joan, juan)
  scenario  - Optional. ID of a specific scenario to run (requires agent)

Examples:
  npm run agents:eval              # Run all agents
  npm run agents:eval joan         # Run all scenarios for joan
  npm run agents:eval juan happy-path-register-payment  # Run specific scenario
`);
}

/**
 * Main CLI entry point for agent evaluation.
 */
async function main() {
  const agentNameArg = process.argv[2];
  const scenarioIdArg = process.argv[3];

  // Handle help flag
  if (agentNameArg === "--help" || agentNameArg === "-h") {
    printUsage();
    process.exit(0);
  }

  try {
    // Load all agents
    const agents = loadAgents();

    // Filter agents with evaluations
    const agentsWithEvals = Array.from(agents.values()).filter(
      (agent) => agent.evaluations && agent.evaluations.scenarios.length > 0
    );

    if (agentsWithEvals.length === 0) {
      console.error("No agents with evaluations found.");
      process.exit(1);
    }

    // If agent name specified, filter to that agent
    const agentsToEval = agentNameArg
      ? agentsWithEvals.filter((a) => a.name === agentNameArg)
      : agentsWithEvals;

    if (agentNameArg && agentsToEval.length === 0) {
      console.error(`Agent "${agentNameArg}" not found or has no evaluations.`);
      console.error(`Available agents: ${agentsWithEvals.map((a) => a.name).join(", ")}`);
      process.exit(1);
    }

    // If scenario ID specified, validate it exists
    if (scenarioIdArg && agentsToEval.length === 1) {
      const agent = agentsToEval[0];
      const scenario = agent.evaluations?.scenarios.find((s) => s.id === scenarioIdArg);
      if (!scenario) {
        console.error(`Scenario "${scenarioIdArg}" not found for agent "${agent.name}".`);
        console.error(
          `Available scenarios: ${agent.evaluations?.scenarios.map((s) => s.id).join(", ")}`
        );
        process.exit(1);
      }
    }

    // Run evaluations for each agent
    let hasFailures = false;
    const allResults: EvalResults[] = [];

    for (const agent of agentsToEval) {
      console.log(`\n=== Evaluating Agent: ${agent.name} ===`);

      let results: EvalResults;

      // If scenario specified, run only that scenario
      if (scenarioIdArg && agent.evaluations) {
        const scenario = agent.evaluations.scenarios.find((s) => s.id === scenarioIdArg);
        if (scenario) {
          console.log(`Running scenario: ${scenarioIdArg}`);
          const context = agent.evaluations.context;
          const scenarioResult: ScenarioResult = await runScenario(agent, scenario, context);

          // Wrap in EvalResults format
          results = {
            agentName: agent.name,
            scenarios: [scenarioResult],
            summary: {
              totalScenarios: 1,
              passedScenarios: scenarioResult.passed ? 1 : 0,
              failedScenarios: scenarioResult.passed ? 0 : 1,
              totalTurns: scenarioResult.summary.totalTurns,
              passedTurns: scenarioResult.summary.passedTurns,
              failedTurns: scenarioResult.summary.failedTurns
            }
          };
        } else {
          continue;
        }
      } else {
        results = await runAgentEval(agent);
      }

      allResults.push(results);

      // Output table to console
      printEval(results);

      // Track failures
      if (results.summary.failedScenarios > 0 || results.summary.failedTurns > 0) {
        hasFailures = true;
      }
    }

    // Save results to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputDir = path.join(process.cwd(), "eval-results");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputFile = path.join(outputDir, `eval-${timestamp}.json`);
    const jsonOutput =
      allResults.length === 1 ? toJSON(allResults[0]) : JSON.stringify(allResults, null, 2);
    fs.writeFileSync(outputFile, jsonOutput);
    console.log(`\nResults saved to: ${outputFile}`);

    process.exit(hasFailures ? 1 : 0);
  } catch (error) {
    const err = error as Error;
    console.error("Evaluation failed:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

// Run main function
main();
