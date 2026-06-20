/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Agent evaluation CLI. Reads config from mikro.json (project root or path in
 * MIKRO_CONFIG_FILE). Run from repo root so the config file is found.
 */
import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import fs from "fs";
import path from "path";

// Optional: load root .env so MIKRO_CONFIG_FILE can override default mikro.json location
const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, "../../../../.env") });

import { getConfig, type LLMConfig } from "@mikro/common";
import type { Agent } from "../llm/types.js";
import { loadAgents } from "../agents/index.js";
import { clearLLMConfigCache, getLLMConfig, getEvalSimilarityThreshold } from "../config.js";
import { runAgentEval, runScenario, type EvalResults, type ScenarioResult } from "./runner.js";
import {
  toJSON,
  printScenarioStart,
  printTurnResult,
  printScenarioResult,
  printSummary
} from "./output.js";

const EVALS_VENDORS = ["openai", "anthropic", "google"] as const;
type EvalsVendor = (typeof EVALS_VENDORS)[number];

/**
 * Per-vendor text/vision LLM config from mikro.json (evals.vendors.<vendor>).
 * For openai, falls back to llm.text / llm.vision when no override is set.
 */
function getTextVisionForVendor(vendor: EvalsVendor): {
  text: LLMConfig | null;
  vision: LLMConfig | null;
} {
  const cfg = getConfig();
  const vendorOverrides = cfg.evals.vendors?.[vendor];
  let text = vendorOverrides?.text ?? null;
  let vision = vendorOverrides?.vision ?? null;
  if (vendor === "openai") {
    text = text ?? cfg.llm.text;
    vision = vision ?? cfg.llm.vision;
  }
  return { text, vision };
}

/**
 * Parse argv for --vendors and positional [agent] [scenario].
 * Without --vendors, a single run uses llm.text and llm.vision from mikro.json.
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

/** Print usage (config is from mikro.json; run from project root). */
function printUsage() {
  console.log(`
Usage: npm run agents:eval [options] [agent] [scenario]

Config is read from mikro.json (default: project root). Use MIKRO_CONFIG_FILE in
.env to point to a different path. Judge model: llm.evals.

Options:
  --vendors <list>  Run scenarios for each vendor. Agent models come from
                    evals.vendors.<vendor>.text/vision (openai falls back to llm.text/vision).
                    Judge always uses llm.evals.

Arguments:
  agent     - Optional. Agent name (e.g. joan, maria)
  scenario  - Optional. Single scenario id (use with agent)

Config (mikro.json):
  llm.evals                 Judge model
  evals.similarityThreshold  Min confidence for "similar" (default 0.7)
  evals.vendors.<vendor>     Optional per-vendor text/vision overrides

Examples:
  npm run agents:eval joan happy-path-business
  npm run agents:eval joan
  npm run agents:eval
  npm run agents:eval -- --vendors openai,anthropic
`);
}

/**
 * Run evals using current config: llm.text/vision for the agent, llm.evals for the judge.
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
      printScenarioStart(agent.name, 1, scenario);
      const scenarioResult: ScenarioResult = await runScenario(agent, scenario, context, {
        onTurnResult: (turnResult) => printTurnResult(agent.name, scenario, turnResult)
      });
      printScenarioResult(scenarioResult);
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
      results = await runAgentEval(agent, {
        onScenarioStart: (idx, scenario) => printScenarioStart(agent.name, idx, scenario),
        onTurnResult: (scenario, turnResult) => printTurnResult(agent.name, scenario, turnResult),
        onScenarioResult: printScenarioResult
      });
    }

    allResults.push(results);
    printSummary(results);
    if (results.summary.failedScenarios > 0 || results.summary.failedTurns > 0) {
      hasFailures = true;
    }
  }

  return { results: allResults, hasFailures };
}

/** CLI entry: load config from mikro.json, run evals, write results to eval-results/. */
async function main() {
  const { vendors, agentName: agentNameArg, scenarioId: scenarioIdArg } = parseArgs();

  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  try {
    // Log judge config
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
        const { text, vision } = getTextVisionForVendor(vendor);
        if (!text || !vision) {
          console.warn(
            `Skipping vendor "${vendor}": evals.vendors.${vendor}.text and ` +
              `.vision must be set in mikro.json` +
              (vendor === "openai" ? " (or use llm.text / llm.vision)." : ".")
          );
          continue;
        }
        // Temporarily override llm.text/vision in the cached config for this vendor's run
        const cfg = getConfig();
        const origText = cfg.llm.text;
        const origVision = cfg.llm.vision;
        cfg.llm.text = text;
        cfg.llm.vision = vision;
        console.log(`\n${"═".repeat(60)}`);
        console.log(`  Text/Vision: ${vendor.toUpperCase()} (scenario runs use these models)`);
        console.log(`${"═".repeat(60)}`);
        const { results, hasFailures } = await runEvalsForCurrentConfig(
          agentsToEval,
          scenarioIdArg
        );
        vendorResults[vendor] = results;
        if (hasFailures) exitFailures = true;
        cfg.llm.text = origText;
        cfg.llm.vision = origVision;
        clearLLMConfigCache();
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

main();
