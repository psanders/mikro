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

import { getConfig } from "@mikro/common";
import type { Agent } from "../llm/types.js";
import { loadAgents } from "../agents/index.js";
import { getCxModel, getCxVisionModel, getEvalsModel } from "../config.js";
import {
  runAgentEval,
  runScenario,
  type EvalResults,
  type EvalRunOptions,
  type ScenarioResult
} from "./runner.js";
import { getEvalsDecisionProvider } from "../decisions/index.js";

/**
 * Replies are judged by each turn's rubric checks, answered by the decision
 * model (`evals.classifier`), with `evals.model` for unsure answers and failure
 * reasons. Without both there is no judge.
 */
function checkOptions(models: EvalRunOptions["models"]): EvalRunOptions {
  const decisions = getEvalsDecisionProvider();
  if (!decisions) {
    console.error(
      "Evals judge replies with rubric checks answered by a decision model: add `evals.classifier` to mikro.json."
    );
    process.exit(1);
  }
  try {
    getEvalsModel();
  } catch {
    console.error("Evals need an LLM judge too: add `evals.model` to mikro.json.");
    process.exit(1);
  }
  return {
    decisions,
    models,
    stats: { decisionCalls: 0, decisionInputTokens: 0, decisionLatencyMs: 0, llmCalls: 0 }
  };
}
import {
  toJSON,
  printScenarioStart,
  printTurnResult,
  printScenarioResult,
  printSummary
} from "./output.js";

/** The agent's models for one run: the baseline (`cx`) or a named candidate. */
interface ModelRun {
  name: string;
  models: NonNullable<EvalRunOptions["models"]>;
}

/**
 * The runs for `--candidates a,b`: the baseline (`cx.model` / `cx.visionModel`)
 * first, then each candidate from `evals.candidates`. A candidate without
 * `visionModel` uses `cx.visionModel`. Exits on an unknown candidate name.
 */
function candidateRuns(names: string[]): ModelRun[] {
  const baseline = { model: getCxModel(), visionModel: getCxVisionModel() };
  const candidates = getConfig().evals.candidates;
  const unknown = names.filter((n) => !candidates[n]);
  if (unknown.length > 0) {
    const known = Object.keys(candidates);
    console.error(
      `Unknown candidate(s): ${unknown.join(", ")}. evals.candidates has: ${known.length ? known.join(", ") : "(none)"}.`
    );
    process.exit(1);
  }
  return [
    { name: "baseline", models: baseline },
    ...names.map((name) => ({
      name,
      models: {
        model: candidates[name].model,
        visionModel: candidates[name].visionModel ?? baseline.visionModel
      }
    }))
  ];
}

/** Parse argv for --candidates and positional [agent] [scenario]. */
function parseArgs(): {
  candidates: string[] | null;
  agentName?: string;
  scenarioId?: string;
} {
  const idx = process.argv.indexOf("--candidates");
  const value = idx !== -1 ? process.argv[idx + 1] : undefined;
  const args = process.argv
    .slice(2)
    .filter((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--candidates");
  const candidates = value
    ? value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    : null;
  return {
    candidates: candidates && candidates.length > 0 ? candidates : null,
    agentName: args[0],
    scenarioId: args[1]
  };
}

/** Print usage (config is from mikro.json; run from project root). */
function printUsage() {
  console.log(`
Usage: npm run agents:eval [options] [agent] [scenario]

Config is read from mikro.json (default: project root). Use MIKRO_CONFIG_FILE in
.env to point to a different path. Agents answer with cx.model / cx.visionModel.
Each turn's rubric checks are answered by evals.classifier (decision model);
evals.model settles unsure answers and explains failures.

Options:
  --candidates <list>  Also run with these named models from evals.candidates,
                       after the baseline (cx.model / cx.visionModel). The
                       judges stay the same.

Arguments:
  agent     - Optional. Agent name (e.g. jose, collector)
  scenario  - Optional. Single scenario id (use with agent)

Config (mikro.json):
  evals.classifier          Decision model that answers the checks (required)
  evals.model               LLM for unsure answers and failure reasons (required)
  evals.candidates.<name>   Optional agent models to compare: { model, visionModel? }

Examples:
  npm run agents:eval jose happy-path-short-isc50
  npm run agents:eval jose
  npm run agents:eval
  npm run agents:eval -- --candidates claude
`);
}

/**
 * Run evals with the given agent models (default `cx`); judged by
 * `evals.classifier` and `evals.model`.
 */
async function runEvals(
  agentsToEval: Agent[],
  scenarioIdArg?: string,
  models?: EvalRunOptions["models"]
): Promise<{ results: EvalResults[]; hasFailures: boolean }> {
  const allResults: EvalResults[] = [];
  let hasFailures = false;
  const options = checkOptions(models);

  for (const agent of agentsToEval) {
    console.log(`\n=== Evaluating Agent: ${agent.name} ===`);
    let results: EvalResults;

    if (scenarioIdArg && agent.evaluations) {
      const scenario = agent.evaluations.scenarios.find((s) => s.id === scenarioIdArg);
      if (!scenario) continue;
      const context = agent.evaluations.context;
      printScenarioStart(agent.name, 1, scenario);
      const scenarioResult: ScenarioResult = await runScenario(
        agent,
        scenario,
        context,
        {
          onTurnResult: (turnResult) => printTurnResult(agent.name, scenario, turnResult)
        },
        options
      );
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
      results = await runAgentEval(
        agent,
        {
          onScenarioStart: (idx, scenario) => printScenarioStart(agent.name, idx, scenario),
          onTurnResult: (scenario, turnResult) => printTurnResult(agent.name, scenario, turnResult),
          onScenarioResult: printScenarioResult
        },
        options
      );
    }

    allResults.push(results);
    printSummary(results);
    if (results.summary.failedScenarios > 0 || results.summary.failedTurns > 0) {
      hasFailures = true;
    }
  }

  const { stats } = options;
  if (stats && (stats.decisionCalls > 0 || stats.llmCalls > 0)) {
    const avg = stats.decisionCalls ? Math.round(stats.decisionLatencyMs / stats.decisionCalls) : 0;
    console.log(
      `\nRubric checks: ${stats.decisionCalls} decision calls (${stats.decisionInputTokens} input tokens, ${avg} ms avg), ${stats.llmCalls} LLM calls`
    );
  }

  return { results: allResults, hasFailures };
}

/** CLI entry: load config from mikro.json, run evals, write results to eval-results/. */
async function main() {
  const { candidates, agentName: agentNameArg, scenarioId: scenarioIdArg } = parseArgs();

  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  try {
    // Log judge config
    const { model: judge, classifier } = getConfig().evals;
    console.log(
      `Judge: checks by ${classifier ? `${classifier.provider}/${classifier.model}` : "(no evals.classifier)"}, LLM ${judge ? `${judge.vendor}/${judge.model}` : "(no evals.model)"}`
    );

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

    if (candidates) {
      const runResults: Record<string, EvalResults[]> = {};
      for (const run of candidateRuns(candidates)) {
        console.log(`\n${"═".repeat(60)}`);
        console.log(
          `  ${run.name}: ${run.models.model.vendor}/${run.models.model.model}, vision ${run.models.visionModel.vendor}/${run.models.visionModel.model}`
        );
        console.log(`${"═".repeat(60)}`);
        const { results, hasFailures } = await runEvals(agentsToEval, scenarioIdArg, run.models);
        runResults[run.name] = results;
        if (hasFailures) exitFailures = true;
      }
      const outputFile = path.join(outputDir, `eval-${timestamp}-candidates.json`);
      fs.writeFileSync(outputFile, JSON.stringify(runResults, null, 2));
      console.log(`\nResults saved to: ${outputFile}`);
    } else {
      if (scenarioIdArg && agentsToEval.length === 1) {
        console.log(`Running scenario: ${scenarioIdArg}`);
      }
      const { results, hasFailures } = await runEvals(agentsToEval, scenarioIdArg);
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
