/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The tracked agents.yaml loads cleanly with the CX profiles (openspec
 * cx-role-based-agents), and a profile still cannot be claimed twice.
 */
import { expect } from "chai";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { resolve } from "path";
import { clearConfigCache, getConfig } from "@mikro/common";
import { loadAgents } from "../../src/agents/index.js";
import { assertJudged } from "../../src/eval/runner.js";

const REPO_AGENTS = resolve(process.cwd(), "../../agents.yaml");
const CONFIG_PATH = resolve(process.cwd(), "mikro-test-agents-load.json");
const DUP_AGENTS = resolve(process.cwd(), "agents-test-dup.yaml");

const BASE_CONFIG = {
  cx: {
    model: { vendor: "openai", apiKey: "test-key", model: "gpt-4o-mini" },
    visionModel: { vendor: "openai", apiKey: "test-key", model: "gpt-4o" }
  },
  copilot: { model: { vendor: "openai", apiKey: "test-key", model: "gpt-4o-mini" } },
  reports: { model: { vendor: "openai", apiKey: "test-key", model: "gpt-4o-mini" } },
  whatsapp: { phoneNumberId: "test", accessToken: "test" },
  accounting: { disbursementAccountId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1" },
  applications: {
    coveredProvinces: ["PUERTO_PLATA"],
    summaryModel: { vendor: "openai", apiKey: "test-key", model: "gpt-4o-mini" }
  }
};

function useAgentsFile(agentsFile: string) {
  writeFileSync(CONFIG_PATH, JSON.stringify({ ...BASE_CONFIG, agentsFile }));
  clearConfigCache();
  getConfig(CONFIG_PATH);
}

describe("loadAgents — CX profiles", () => {
  after(() => {
    for (const f of [CONFIG_PATH, DUP_AGENTS]) if (existsSync(f)) unlinkSync(f);
    clearConfigCache();
  });

  it("loads the tracked agents.yaml, with the CX agents enabled", () => {
    useAgentsFile(REPO_AGENTS);
    const agents = loadAgents();

    for (const profile of ["GUEST", "APPLICANT", "CUSTOMER"] as const) {
      const agent = agents.get(profile);
      expect(agent, profile).to.not.equal(undefined);
      expect(agent!.enabled, `${profile} is enabled`).to.be.true;
      expect(agent!.allowedTools).to.include("requestHumanHandoff");
    }
    expect(agents.get("PROSPECT")!.allowedTools).to.include("requestHumanHandoff");
  });

  it("judges every eval turn of the tracked agents.yaml by checks (openspec decision-judges)", () => {
    useAgentsFile(REPO_AGENTS);
    let scenarios = 0;
    for (const agent of loadAgents().values()) {
      for (const scenario of agent.evaluations?.scenarios ?? []) {
        scenarios += 1;
        expect(() => assertJudged(scenario), agent.name).to.not.throw();
      }
    }
    expect(scenarios).to.be.greaterThan(0);
  });

  it("still rejects two agents claiming the same profile", () => {
    writeFileSync(
      DUP_AGENTS,
      [
        "- name: a",
        "  profile: CUSTOMER",
        "  systemPrompt: x",
        "  allowedTools: []",
        "- name: b",
        "  profile: CUSTOMER",
        "  systemPrompt: y",
        "  allowedTools: []"
      ].join("\n")
    );
    useAgentsFile(DUP_AGENTS);
    expect(() => loadAgents()).to.throw(/CUSTOMER.*claimed by multiple agents/);
  });
});
