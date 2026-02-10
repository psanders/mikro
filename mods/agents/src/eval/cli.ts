/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import fs from "fs";
import path from "path";

// Load .env from project root
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../../.env") });

import type { Agent } from "../llm/types.js";
import { loadAgents } from "../../../apiserver/src/agents/loadAgents.js";
import { clearLLMConfigCache, getLLMConfig, getEvalSimilarityThreshold } from "../config.js";
import { runAgentEval, runScenario, type EvalResults, type ScenarioResult } from "./runner.js";
import { toJSON, printEval } from "./output.js";

const EVALS_VENDORS = ["openai", "anthropic", "google"] as const;
type EvalsVendor = (typeof EVALS_VENDORS)[number];

/**
 * Get TEXT and VISION env values for a vendor. Used so scenario runs use that vendor's models.
 * Uses MIKRO_LLM_TEXT_<VENDOR> and MIKRO_LLM_VISION_<VENDOR> if set; for openai falls back to
 * MIKRO_LLM_TEXT and MIKRO_LLM_VISION.
 */
function getTextVisionEnvForVendor(vendor: EvalsVendor): {
  text: string | undefined;
  vision: string | undefined;
} {
  const textKey = `MIKRO_LLM_TEXT_${vendor.toUpperCase()}`;
  const visionKey = `MIKRO_LLM_VISION_${vendor.toUpperCase()}`;
  let text = process.env[textKey]?.trim();
  let vision = process.env[visionKey]?.trim();
  if (vendor === "openai") {
    text = text ?? process.env.MIKRO_LLM_TEXT?.trim();
    vision = vision ?? process.env.MIKRO_LLM_VISION?.trim();
  }
  return { text, vision };
}

/**
 * Parse argv for optional --vendors flag and positional args.
 * Returns { vendors: EvalsVendor[] | null, agentName?: string, scenarioId?: string }.
 * If --vendors is not present, vendors is null (single run using MIKRO_LLM_TEXT / MIKRO_LLM_VISION).
 */
function parseArgs(): {
  vendors: EvalsVendor[] | null;
  agentName?: string;
  scenarioId?: string;
} {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const vendorIdx = process.argv.indexOf("--vendors");
  let vendors: EvalsVendor[] | null = null;
  if (vendorIdx !== -1 && process.argv[vendorIdx + 1]) {
    const raw = process.argv[vendorIdx + 1].toLowerCase();
    const list = raw.split(",").map((v) => v.trim()) as string[];
    const valid = list.filter((v): v is EvalsVendor => EVALS_VENDORS.includes(v as EvalsVendor));
    if (valid.length > 0) vendors = valid;
  }
  return {
    vendors,
    agentName: args[0],
    scenarioId: args[1]
  };
}

/**
 * Print usage information.
 */
function printUsage() {
  console.log(`
Usage: npm run agents:eval [options] [agent] [scenario]

Run scenarios one at a time to debug: pass agent then scenario id.
Judge uses MIKRO_LLM_EVALS; try a different model if results are too strict.

Options:
  --vendors <list>  Run test scenarios for each vendor (comma-separated). Agent
                    responses use MIKRO_LLM_TEXT_<VENDOR> and MIKRO_LLM_VISION_<VENDOR>
                    (for openai, falls back to MIKRO_LLM_TEXT / MIKRO_LLM_VISION).
                    Judge uses MIKRO_LLM_EVALS unchanged.

Arguments:
  agent     - Optional. Name of the agent (e.g., joan, juan)
  scenario  - Optional. Run only this scenario (use with agent). Check scenario ids in agent file.

Environment:
  MIKRO_LLM_EVALS              Judge model for similarity/response (default evals LLM)
  MIKRO_EVAL_SIMILARITY_THRESHOLD  Min confidence 0-1 for "similar" (default: 0.7)

Examples:
  npm run agents:eval joan happy-path-business     # Run one scenario (recommended for debugging)
  npm run agents:eval joan                         # Run all scenarios for joan
  npm run agents:eval                              # Run all agents
  npm run agents:eval -- --vendors openai           # Run with current TEXT/VISION
`);
}

/**
 * Run evals for the current MIKRO_LLM_TEXT / MIKRO_LLM_VISION config (agent) and
 * MIKRO_LLM_EVALS (judge). Returns results and whether any failed.
 */
async function runEvalsForCurrentConfig(
  agentsToEval: Agent[],
  scenarioIdArg?: string
): Promise<{ results: EvalResults[]; hasFailures: boolean }> {
  const allResults: EvalResults[] = [];
  let hasFailures = false;

  for (const agent of agentsToEval) {
    console.log(`\n=== Evaluating Agent: ${agent.name} ===`);
    let results: EvalResults;

    if (scenarioIdArg && agent.evaluations) {
      const scenario = agent.evaluations.scenarios.find((s) => s.id === scenarioIdArg);
      if (!scenario) continue;
      const context = agent.evaluations.context;
      const scenarioResult: ScenarioResult = await runScenario(agent, scenario, context);
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
      results = await runAgentEval(agent);
    }

    allResults.push(results);
    printEval(results);
    if (results.summary.failedScenarios > 0 || results.summary.failedTurns > 0) {
      hasFailures = true;
    }
  }

  return { results: allResults, hasFailures };
}

/**
 * Main CLI entry point for agent evaluation.
 */
async function main() {
  const { vendors, agentName: agentNameArg, scenarioId: scenarioIdArg } = parseArgs();

  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  try {
    // Log judge config so user can try different MIKRO_LLM_EVALS model if needed
    try {
      const evalsConfig = getLLMConfig("evals");
      const threshold = getEvalSimilarityThreshold();
      console.log(
        `Judge: ${evalsConfig.vendor}/${evalsConfig.model} (similarity threshold: ${threshold})`
      );
    } catch {
      // evals not configured yet
    }

    const agents = loadAgents();
    const agentsWithEvals = Array.from(agents.values()).filter(
      (agent) => agent.evaluations && agent.evaluations.scenarios.length > 0
    );

    if (agentsWithEvals.length === 0) {
      console.error("No agents with evaluations found.");
      process.exit(1);
    }

    const agentsToEval = agentNameArg
      ? agentsWithEvals.filter((a) => a.name === agentNameArg)
      : agentsWithEvals;

    if (agentNameArg && agentsToEval.length === 0) {
      console.error(`Agent "${agentNameArg}" not found or has no evaluations.`);
      console.error(`Available agents: ${agentsWithEvals.map((a) => a.name).join(", ")}`);
      process.exit(1);
    }

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

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputDir = path.join(process.cwd(), "eval-results");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    let exitFailures = false;

    if (vendors && vendors.length > 0) {
      const vendorResults: Record<string, EvalResults[]> = {};
      for (const vendor of vendors) {
        const { text, vision } = getTextVisionEnvForVendor(vendor);
        if (!text || !vision) {
          console.warn(
            `Skipping vendor "${vendor}": MIKRO_LLM_TEXT_${vendor.toUpperCase()} and ` +
              `MIKRO_LLM_VISION_${vendor.toUpperCase()} must be set` +
              (vendor === "openai" ? " (or use MIKRO_LLM_TEXT / MIKRO_LLM_VISION)." : ".")
          );
          continue;
        }
        process.env.MIKRO_LLM_TEXT = text;
        process.env.MIKRO_LLM_VISION = vision;
        clearLLMConfigCache();
        console.log(`\n${"═".repeat(60)}`);
        console.log(`  Text/Vision: ${vendor.toUpperCase()} (scenario runs use these models)`);
        console.log(`${"═".repeat(60)}`);
        const { results, hasFailures } = await runEvalsForCurrentConfig(
          agentsToEval,
          scenarioIdArg
        );
        vendorResults[vendor] = results;
        if (hasFailures) exitFailures = true;
      }
      const outputFile = path.join(outputDir, `eval-${timestamp}-vendors.json`);
      fs.writeFileSync(outputFile, JSON.stringify(vendorResults, null, 2));
      console.log(`\nResults saved to: ${outputFile}`);
    } else {
      if (scenarioIdArg && agentsToEval.length === 1) {
        console.log(`Running scenario: ${scenarioIdArg}`);
      }
      const { results, hasFailures } = await runEvalsForCurrentConfig(agentsToEval, scenarioIdArg);
      exitFailures = hasFailures;
      const outputFile = path.join(outputDir, `eval-${timestamp}.json`);
      const jsonOutput =
        results.length === 1 ? toJSON(results[0]) : JSON.stringify(results, null, 2);
      fs.writeFileSync(outputFile, jsonOutput);
      console.log(`\nResults saved to: ${outputFile}`);
    }

    process.exit(exitFailures ? 1 : 0);
  } catch (error) {
    const err = error as Error;
    console.error("Evaluation failed:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

// Run main function
main();
