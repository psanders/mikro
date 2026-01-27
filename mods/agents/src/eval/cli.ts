/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import fs from "fs";
import path from "path";
import { loadAgents } from "../../../apiserver/src/agents/loadAgents.js";
import { runAgentEval, type EvalResults } from "./runner.js";
import { toJSON, printEval } from "./output.js";

/**
 * Main CLI entry point for agent evaluation.
 */
async function main() {
  const agentNameArg = process.argv[2];

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
      process.exit(1);
    }

    // Run evaluations for each agent
    let hasFailures = false;
    const allResults: EvalResults[] = [];

    for (const agent of agentsToEval) {
      console.log(`\n=== Evaluating Agent: ${agent.name} ===`);

      const results = await runAgentEval(agent);
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
