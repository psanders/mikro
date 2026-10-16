/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Every eval turn is judged by its rubric checks (openspec decision-judges):
 * the runner refuses a turn without checks. (The tracked agents.yaml is
 * checked in test/agents/loadAgents.test.ts.)
 */
import { expect } from "chai";
import { assertJudged } from "../../src/eval/runner.js";
import type { EvaluationScenario } from "../../src/llm/types.js";

const CHECK = { id: "saluda", question: "¿Saluda a la persona?", expect: true };

describe("eval turns are judged by checks", () => {
  it("accepts a scenario whose every turn has checks", () => {
    const scenario = {
      id: "ok",
      description: "",
      turns: [{ human: "Hola", checks: [CHECK] }]
    } as EvaluationScenario;
    expect(() => assertJudged(scenario)).to.not.throw();
  });

  it("refuses a scenario with a turn that has no checks, naming the turn", () => {
    const scenario = {
      id: "missing",
      description: "",
      turns: [{ human: "Hola", checks: [CHECK] }, { human: "Gracias" }, { human: "x", checks: [] }]
    } as unknown as EvaluationScenario;
    expect(() => assertJudged(scenario)).to.throw(/"missing": turn 2, 3 has no checks/);
  });
});
