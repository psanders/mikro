/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import {
  classifierInput,
  classifyInbound,
  costOf,
  createOpenAIDecisionsProvider,
  effectiveIntent,
  isMediaOnly,
  verdictOf,
  type DecisionProvider,
  type DecisionQuestion
} from "../../src/decisions/index.js";

function fakeFetch(status: number, body: unknown) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const predicate: DecisionQuestion = {
  type: "predicate",
  name: "closing",
  instructions: "¿Se despide?"
};

describe("OpenAI Decisions provider", () => {
  it("posts model, input and questions and returns the answers with usage", async () => {
    const { impl, calls } = fakeFetch(200, {
      model: "gpt-6-luna",
      answers: [{ type: "predicate", name: "closing", probability: 0.99 }],
      usage: { input_tokens: 169, output_tokens: 0 }
    });
    const provider = createOpenAIDecisionsProvider({ apiKey: "k", fetchImpl: impl });
    const result = await provider.ask("PERSONA: gracias", [predicate]);

    expect(calls[0]!.url).to.equal("https://api.openai.com/v1/decisions");
    const sent = JSON.parse(String(calls[0]!.init.body));
    expect(sent).to.deep.equal({
      model: "gpt-6-luna",
      input: "PERSONA: gracias",
      questions: [predicate]
    });
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).to.equal("Bearer k");
    expect(result.answers[0]).to.deep.include({ probability: 0.99 });
    expect(result.model).to.equal("openai-decisions:gpt-6-luna");
    expect(result.inputTokens).to.equal(169);
  });

  it("throws with the API message on an error status", async () => {
    const { impl } = fakeFetch(403, { error: { message: "not enabled" } });
    const provider = createOpenAIDecisionsProvider({ apiKey: "k", fetchImpl: impl });
    let error: Error | undefined;
    await provider.ask("x", [predicate]).catch((e: Error) => (error = e));
    expect(error?.message).to.equal("Decisions API 403: not enabled");
  });

  it("throws when a question comes back unanswered", async () => {
    const { impl } = fakeFetch(200, { answers: [] });
    const provider = createOpenAIDecisionsProvider({ apiKey: "k", fetchImpl: impl });
    let error: Error | undefined;
    await provider.ask("x", [predicate]).catch((e: Error) => (error = e));
    expect(error?.message).to.contain("closing");
  });
});

describe("verdictOf", () => {
  const p = (probability: number) => ({ type: "predicate" as const, name: "x", probability });
  it("is yes / no only past the confidence floor, unsure in between", () => {
    expect(verdictOf(p(0.95))).to.equal("yes");
    expect(verdictOf(p(0.7))).to.equal("yes");
    expect(verdictOf(p(0.5))).to.equal("unsure");
    expect(verdictOf(p(0.3))).to.equal("no");
    expect(verdictOf(p(0.02))).to.equal("no");
  });
  it("treats refusals and missing answers as unsure", () => {
    expect(verdictOf({ type: "refusal", name: "x" })).to.equal("unsure");
    expect(verdictOf(undefined)).to.equal("unsure");
  });
});

describe("costOf", () => {
  it("prices Decisions on input tokens only", () => {
    expect(
      costOf({ model: "openai-decisions:gpt-6-luna", inputTokens: 1_000_000, outputTokens: 5 })
    ).to.equal(0.1);
  });
  it("returns null for an unpriced model", () => {
    expect(costOf({ model: "chat:openai:unknown", inputTokens: 1, outputTokens: 1 })).to.equal(
      null
    );
  });
});

describe("classifier", () => {
  const stub = (answers: unknown[]): DecisionProvider & { inputs: string[] } => {
    const inputs: string[] = [];
    return {
      id: "stub",
      inputs,
      async ask(input) {
        inputs.push(input);
        return {
          answers: answers as never,
          model: "stub",
          inputTokens: 300,
          outputTokens: 0,
          latencyMs: 5
        };
      }
    };
  };

  it("labels media without a model call", async () => {
    const provider = stub([]);
    const c = await classifyInbound(provider, { history: [], message: "[Imagen]", isMedia: true });
    expect(c.intent).to.equal("media");
    expect(provider.inputs).to.have.length(0);
    expect(isMediaOnly({ history: [], message: "mi negocio", isMedia: true })).to.equal(false);
  });

  it("reads intent and predicates from one request over the recent turns", async () => {
    const provider = stub([
      { type: "choice", name: "intent", choice: "closing", confidence: 0.96, probabilities: [] },
      { type: "predicate", name: "settled", probability: 0.94 },
      { type: "predicate", name: "affirms", probability: 0.1 },
      { type: "predicate", name: "same_request", probability: 0.01 }
    ]);
    const c = await classifyInbound(provider, {
      history: [
        { role: "INBOUND", content: "Ok" },
        { role: "AGENT", content: "¡Listo! El equipo revisará tu solicitud.\n\n^JO" }
      ],
      message: "Gracias"
    });
    expect(c).to.deep.include({ intent: "closing", confidence: 0.96, model: "stub" });
    expect(c.predicates).to.deep.equal({ settled: 0.94, affirms: 0.1, sameRequest: 0.01 });
    expect(provider.inputs[0]).to.contain("AGENTE: ¡Listo! El equipo revisará tu solicitud.");
    expect(provider.inputs[0]).not.to.contain("^JO");
    expect(provider.inputs[0]).to.contain("MENSAJE NUEVO DE LA PERSONA: Gracias");
  });

  it("keeps only the last six turns as context", () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      role: "INBOUND" as const,
      content: `m${i}`
    }));
    const input = classifierInput({ history, message: "x" });
    expect(input).not.to.contain("m3");
    expect(input).to.contain("m4");
  });

  it("acts on an intent only past the confidence floor", () => {
    expect(effectiveIntent({ intent: "closing", confidence: 0.9 })).to.equal("closing");
    expect(effectiveIntent({ intent: "closing", confidence: 0.6 })).to.equal("other");
  });
});
