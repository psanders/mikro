/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Eval rubric checks (openspec decision-judges): decision model first, LLM for
 * unsure answers and to explain failures.
 */
import { expect } from "chai";
import sinon from "sinon";
import { checkInput, runChecks, type EvalCheck } from "../../src/eval/checks.js";
import type { DecisionProvider } from "../../src/decisions/index.js";

const transcript = {
  history: [{ role: "user" as const, content: "¿Solo son semanales?" }],
  human: "¿Y quincenal?",
  reply: "Ofrecemos pagos diarios, semanales y quincenales.",
  tools: [{ name: "getFaq", args: { topic: "frecuencias" } }]
};

function decisions(probabilities: Record<string, number>): DecisionProvider & { calls: number } {
  const provider = {
    id: "stub",
    calls: 0,
    async ask(_input: string, questions: Array<{ name: string }>) {
      provider.calls += 1;
      return {
        answers: questions.map((q) => ({
          type: "predicate" as const,
          name: q.name,
          probability: probabilities[q.name] ?? 0.5
        })),
        model: "openai-decisions:gpt-6-luna",
        inputTokens: 500,
        outputTokens: 0,
        latencyMs: 150
      };
    }
  };
  return provider;
}

const checks: EvalCheck[] = [
  {
    id: "invented_frequency",
    question: "¿Menciona una frecuencia de pago distinta de semanal, quincenal o mensual?",
    expect: false
  },
  { id: "mentions_link", question: "¿Incluye el enlace de la solicitud?", expect: true }
];

describe("eval rubric checks", () => {
  it("shows the judges the conversation, the reply and the tools it ran", () => {
    const input = checkInput(transcript);
    expect(input).to.contain("PERSONA: ¿Solo son semanales?");
    expect(input).to.contain("RESPUESTA DEL AGENTE: Ofrecemos pagos diarios");
    expect(input).to.contain('getFaq({"topic":"frecuencias"})');
  });

  it("asks every check in one decision request and passes confident expected answers", async () => {
    const provider = decisions({ invented_frequency: 0.05, mentions_link: 0.92 });
    const llm = sinon.stub();
    const stats = { decisionCalls: 0, decisionInputTokens: 0, decisionLatencyMs: 0, llmCalls: 0 };
    const results = await runChecks(checks, transcript, { decisions: provider, llm }, stats);

    expect(provider.calls).to.equal(1);
    expect(results.every((r) => r.passed && r.decidedBy === "decision")).to.equal(true);
    expect(llm.called).to.equal(false);
    expect(stats).to.deep.equal({
      decisionCalls: 1,
      decisionInputTokens: 500,
      decisionLatencyMs: 150,
      llmCalls: 0
    });
  });

  it("fails an invented fact and asks the LLM for the reason", async () => {
    const provider = decisions({ invented_frequency: 0.97, mentions_link: 0.9 });
    const llm = sinon.stub().resolves({ answer: true, reason: "Menciona pagos diarios." });
    const [invented] = await runChecks(checks, transcript, { decisions: provider, llm });

    expect(invented).to.deep.include({
      passed: false,
      answer: true,
      decidedBy: "decision",
      reason: "Menciona pagos diarios.",
      llmDisagrees: false
    });
  });

  it("escalates an unsure answer to the LLM, which decides it", async () => {
    const provider = decisions({ invented_frequency: 0.05, mentions_link: 0.55 });
    const llm = sinon.stub().resolves({ answer: false, reason: "No incluye el enlace." });
    const results = await runChecks(checks, transcript, { decisions: provider, llm });

    expect(results[1]).to.deep.include({
      decidedBy: "llm",
      answer: false,
      passed: false,
      probability: 0.55
    });
    expect(llm.calledOnce).to.equal(true);
  });

  it("does nothing for a turn without checks", async () => {
    const provider = decisions({});
    expect(
      await runChecks([], transcript, { decisions: provider, llm: sinon.stub() })
    ).to.deep.equal([]);
    expect(provider.calls).to.equal(0);
  });
});
