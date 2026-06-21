/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Validates that the COLLECTOR agent entry in agents.yaml is structurally
 * correct and carries evaluation scenarios.  The evals themselves (LLM calls)
 * are exercised by the eval CLI; this test guards the config contract so
 * regressions are caught in the normal test suite.
 */
import { expect } from "chai";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { loadRawAgentsConfig } from "@mikro/common";
import { agentConfigSchema } from "../../src/agents/agentSchema.js";

const AGENTS_YAML = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../agents.yaml");

describe("COLLECTOR agent — agents.yaml config", () => {
  let collectorRaw: unknown;

  before(() => {
    const all = loadRawAgentsConfig(AGENTS_YAML) as Array<Record<string, unknown>>;
    collectorRaw = all.find((a) => a["profile"] === "COLLECTOR");
  });

  it("has a COLLECTOR entry in agents.yaml", () => {
    expect(collectorRaw, "no COLLECTOR agent found in agents.yaml").to.exist;
  });

  it("passes agentConfigSchema validation", () => {
    const result = agentConfigSchema.safeParse(collectorRaw);
    expect(result.success, result.error?.issues.map((i) => i.message).join(", ")).to.be.true;
  });

  it("is enabled", () => {
    const agent = agentConfigSchema.parse(collectorRaw);
    expect(agent.enabled).to.be.true;
  });

  it("has no tools — pure vision extraction, no side-effects", () => {
    const agent = agentConfigSchema.parse(collectorRaw);
    expect(agent.allowedTools).to.deep.equal([]);
  });

  it("has temperature 0 for deterministic extraction", () => {
    const agent = agentConfigSchema.parse(collectorRaw);
    expect(agent.temperature).to.equal(0);
  });

  it("has at least 3 evaluation scenarios", () => {
    const agent = agentConfigSchema.parse(collectorRaw);
    expect(agent.evaluations?.scenarios, "evaluations.scenarios missing").to.exist;
    expect(agent.evaluations!.scenarios.length).to.be.at.least(3);
  });

  it("every eval scenario has at least one turn with expectedAI", () => {
    const agent = agentConfigSchema.parse(collectorRaw);
    for (const scenario of agent.evaluations!.scenarios) {
      expect(scenario.turns.length, `scenario ${scenario.id} has no turns`).to.be.greaterThan(0);
      for (const turn of scenario.turns) {
        expect(turn.expectedAI, `scenario ${scenario.id} has a turn without expectedAI`).to.be.a(
          "string"
        );
      }
    }
  });

  it("covers the NONE (no phone visible) scenario", () => {
    const agent = agentConfigSchema.parse(collectorRaw);
    const noneScenario = agent.evaluations!.scenarios.find((s) =>
      s.turns.some((t) => t.expectedAI.toUpperCase() === "NONE")
    );
    expect(noneScenario, "no scenario tests the NONE (no phone) case").to.exist;
  });
});
